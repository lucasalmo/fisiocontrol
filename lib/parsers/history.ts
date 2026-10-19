/**
 * Parser for the plain-text treatment history.
 *
 * Pure and framework independent: it receives the pasted text plus options
 * (reference year, known categories…) and returns one structured line per input
 * line, with issues (errors block the import, warnings ask for attention).
 * Database-level checks (duplicates against stored data) are done elsewhere.
 *
 * Recognized shapes (spacing, case and accents are tolerated):
 *   [✓] 17 - Sexta 16/10 - Adaptado explosão
 *   [ ] 18 - Segunda 19/10
 *   [ ] ====== Cirurgia dia 31/03 ======
 *   [ ] ==== PAGAMENTO + 40 SESSÕES 26/08 ====
 *   [ ] => Sexta 05/06 => Feriado
 *   [ ] => Ganhei 3 sessões por zerar o eletro
 */

import {
  WEEKDAY_NAMES,
  diffInDays,
  isValidDateParts,
  parseIsoDate,
  toIsoDate,
  weekdayOf,
  type IsoDate,
} from "@/lib/dates/calendar";
import { normalizeText } from "@/lib/utils/text";

export type IssueLevel = "error" | "warning" | "info";
export type Issue = { level: IssueLevel; message: string };

export type ImportEventType = "surgery" | "holiday" | "pause" | "resume" | "custom";

export type ParsedData =
  | {
      kind: "session";
      number: number;
      date: IsoDate | null;
      completed: boolean;
      categoryId: number | null;
      categoryName: string | null;
      /** Set when the category does not exist yet and will be created. */
      newCategory: boolean;
      notes: string | null;
    }
  | { kind: "payment"; date: IsoDate | null; baseLimit: number; limitFromText: boolean }
  | { kind: "bonus"; date: IsoDate | null; quantity: number; reason: string }
  | { kind: "event"; type: ImportEventType; date: IsoDate | null; title: string }
  | { kind: "note"; text: string; attachToLine: number | null };

export type ParsedLine = {
  lineNumber: number;
  raw: string;
  /** `ignored` = blank/decorative line, `excluded` = removed by the user. */
  state: "parsed" | "ignored" | "excluded" | "invalid";
  data: ParsedData | null;
  /** Index of the payment segment (cycle block) the line belongs to. */
  segment: number;
  issues: Issue[];
};

export type ParsedSegment = {
  index: number;
  /** Line of the payment that opened the segment; null for the initial block. */
  paymentLine: number | null;
  paymentDate: IsoDate | null;
  baseLimit: number;
  bonusTotal: number;
  /** Extra sessions accepted beyond the paid limit (base + bonuses). */
  extraAllowance: number;
  sessionLines: number[];
};

export type ParseOptions = {
  /** Year of the first dated line without an explicit year. */
  referenceYear: number;
  /** Known categories, used for matching (accent/case insensitive). */
  categories?: { id: number; name: string }[];
  defaultCycleLimit?: number;
  /** Limit of the block before the first payment (defaults to defaultCycleLimit). */
  initialBaseLimit?: number;
  /** Extra sessions accepted beyond the paid limit in each cycle (default 3). */
  extraAllowance?: number;
  /** Line numbers (1-based) the user chose to skip. */
  excludedLines?: number[];
  /** Today's date, used to flag completed sessions in the future. */
  today?: IsoDate;
};

export type ParsedHistory = {
  lines: ParsedLine[];
  segments: ParsedSegment[];
  summary: {
    sessions: number;
    completed: number;
    pending: number;
    payments: number;
    bonuses: number;
    events: number;
    errors: number;
    warnings: number;
  };
};

// ---------------------------------------------------------------------------
// Lexical helpers
// ---------------------------------------------------------------------------

const STATUS_RE = /^\[\s*([✓✔☑✅xXvV]?)\s*\]\s*/u;
const DATE_RE = /(?<![\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{4}|\d{2}))?(?![\d/])/;
const DECORATIVE_RE = /^[\s=\-_*~.>#|]*$/;

const WEEKDAY_ALIASES: [RegExp, number][] = [
  [/^dom(ingo)?$/, 0],
  [/^seg(unda)?(-?feira)?$/, 1],
  [/^ter(ca)?(-?feira)?$/, 2],
  [/^qua(rta)?(-?feira)?$/, 3],
  [/^qui(nta)?(-?feira)?$/, 4],
  [/^sex(ta)?(-?feira)?$/, 5],
  [/^sab(ado)?$/, 6],
];

function matchWeekday(word: string): number | null {
  const w = normalizeText(word).replace(/[^a-z-]/g, "");
  for (const [re, index] of WEEKDAY_ALIASES) if (re.test(w)) return index;
  return null;
}

/** Normalization used for category matching: also ignores punctuation. */
function matchKey(value: string): string {
  return normalizeText(value.replace(/[-_/&+.,;:()]/g, " "));
}

/** Removes decoration such as `====`, `=>`, leading dashes. */
function stripDecoration(value: string): string {
  return value
    .replace(/={2,}>?|=>|->|>{1,}/g, " ")
    .replace(/^[\s\-–—=*~>.]+|[\s\-–—=*~>.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type RawDate = { day: number; month: number; year: number | null; index: number; length: number };

function findDate(text: string): RawDate | null {
  const m = DATE_RE.exec(text);
  if (!m) return null;
  let year: number | null = null;
  if (m[3]) year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return { day: Number(m[1]), month: Number(m[2]), year, index: m.index, length: m[0].length };
}

/** Looks for a weekday word immediately before the date (e.g. "Sexta 16/10"). */
function findWeekdayBefore(text: string, dateIndex: number): { weekday: number; start: number } | null {
  const before = text.slice(0, dateIndex);
  const m = /([A-Za-zÀ-ÿ-]+)[\s,]*$/.exec(before);
  if (!m) return null;
  const weekday = matchWeekday(m[1]);
  return weekday === null ? null : { weekday, start: m.index };
}

type Lexed =
  | {
      kind: "session";
      completed: boolean;
      number: number;
      date: RawDate | null;
      weekday: number | null;
      tail: string;
    }
  | { kind: "payment"; date: RawDate | null; weekday: number | null; quantity: number | null }
  | { kind: "surgery"; date: RawDate | null; weekday: number | null }
  | { kind: "bonus"; date: RawDate | null; weekday: number | null; quantity: number; reason: string }
  | { kind: "event"; type: ImportEventType; date: RawDate | null; weekday: number | null; title: string }
  | { kind: "ignored" }
  | { kind: "invalid"; message: string };

function classifyEventTitle(normalized: string): ImportEventType {
  if (/feriado/.test(normalized)) return "holiday";
  if (/\b(pausa|ferias|viagem|sem fisio|interrup|suspens)/.test(normalized)) return "pause";
  if (/\b(retorno|retomada|volta|voltei|retomei)/.test(normalized)) return "resume";
  return "custom";
}

/** Splits one raw line into tokens. Exported for unit tests. */
export function lexLine(raw: string): Lexed {
  const line = raw.trim();
  if (!line || DECORATIVE_RE.test(line)) return { kind: "ignored" };

  let completed = false;
  let body = line;
  const status = STATUS_RE.exec(line);
  if (status) {
    completed = status[1] !== "";
    body = line.slice(status[0].length);
  }
  if (!body.trim() || DECORATIVE_RE.test(body)) return { kind: "ignored" };

  const normalized = normalizeText(body);
  const date = findDate(body);
  const weekday = date ? (findWeekdayBefore(body, date.index)?.weekday ?? null) : null;

  if (/pagamento|pagou|paguei/.test(normalized)) {
    const q = /(\d+)\s*sess/.exec(normalized);
    return { kind: "payment", date, weekday, quantity: q ? Number(q[1]) : null };
  }

  if (/cirurgia/.test(normalized)) return { kind: "surgery", date, weekday };

  const bonus = /(\d+)\s*(sessoes|sessao|sess)\b/.exec(normalized);
  if (bonus && /(ganhei|ganho|bonus|bonificac|gratis|cortesia|presente)/.test(normalized)) {
    return { kind: "bonus", date, weekday, quantity: Number(bonus[1]), reason: stripDecoration(body) };
  }

  // Session: a number at the start of the body (not part of a date).
  const session = /^\s*(\d{1,3})(?!\s*\/)\s*(?:[-–—.):]\s*|\s+|$)(.*)$/.exec(body);
  if (session) {
    const rest = session[2];
    const d = findDate(rest);
    let tail = rest;
    let wd: number | null = null;
    if (d) {
      const w = findWeekdayBefore(rest, d.index);
      wd = w?.weekday ?? null;
      tail = rest.slice(d.index + d.length);
    } else {
      // Without a date, a leading weekday is still removed from the tail.
      const first = /^([A-Za-zÀ-ÿ-]+)/.exec(rest.trim());
      if (first && matchWeekday(first[1]) !== null) tail = rest.trim().slice(first[1].length);
    }
    return {
      kind: "session",
      completed,
      number: Number(session[1]),
      date: d,
      weekday: wd,
      tail: stripDecoration(tail),
    };
  }

  // Generic event: whatever text is left besides weekday and date is the title.
  let titleSource = body;
  if (date) {
    const w = findWeekdayBefore(body, date.index);
    const start = w ? w.start : date.index;
    titleSource = body.slice(0, start) + " " + body.slice(date.index + date.length);
  }
  const title = stripDecoration(titleSource.replace(/\bdia\b/i, " "));
  if (!title && !date) return { kind: "invalid", message: "Linha não reconhecida." };
  return {
    kind: "event",
    type: classifyEventTitle(normalizeText(title)),
    date,
    weekday,
    title: title || "Evento",
  };
}

// ---------------------------------------------------------------------------
// Category matching
// ---------------------------------------------------------------------------

type CategoryMatch = {
  categoryId: number | null;
  categoryName: string | null;
  newCategory: boolean;
  notes: string | null;
};

export function matchCategory(tail: string, categories: { id: number; name: string }[]): CategoryMatch {
  const text = tail.trim();
  if (!text) return { categoryId: null, categoryName: null, newCategory: false, notes: null };

  const words = text.split(/\s+/);
  const keyed = categories.map((c) => ({ ...c, key: matchKey(c.name) }));
  for (let k = words.length; k >= 1; k--) {
    const key = matchKey(words.slice(0, k).join(" "));
    const found = keyed.find((c) => c.key === key);
    if (found) {
      const notes = stripDecoration(words.slice(k).join(" ").replace(/^[\s,;:()\-–—]+/, ""));
      return { categoryId: found.id, categoryName: found.name, newCategory: false, notes: notes || null };
    }
  }

  // "Categoria - observação": a short first part is treated as a new category.
  const parts = text.split(/\s+[-–—]\s+|\s*=>\s*|\s*:\s+/);
  const head = parts[0].trim();
  const headWords = head.split(/\s+/).length;
  if (headWords <= 4 && head.length <= 40 && !/\d/.test(head)) {
    const name = head.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
    const notes = parts.slice(1).join(" - ").trim();
    return { categoryId: null, categoryName: name, newCategory: true, notes: notes || null };
  }
  return { categoryId: null, categoryName: null, newCategory: false, notes: text };
}

// ---------------------------------------------------------------------------
// Date resolution
// ---------------------------------------------------------------------------

type DateResolution = { date: IsoDate | null; issues: Issue[] };

function weekdayIssue(date: IsoDate, weekday: number | null): Issue | null {
  if (weekday === null) return null;
  const actual = weekdayOf(date);
  if (actual === weekday) return null;
  const [y, m, d] = date.split("-");
  return {
    level: "warning",
    message: `Dia da semana informado (${WEEKDAY_NAMES[weekday]}) não corresponde a ${d}/${m}/${y}, que é ${WEEKDAY_NAMES[actual]}.`,
  };
}

/** Chooses the year for a DD/MM date based on chronological context. */
function resolveDate(
  raw: RawDate,
  weekday: number | null,
  previous: IsoDate | null,
  referenceYear: number,
): DateResolution {
  const fmt = (y: number) => `${String(raw.day).padStart(2, "0")}/${String(raw.month).padStart(2, "0")}/${y}`;

  if (raw.year !== null) {
    if (!isValidDateParts(raw.year, raw.month, raw.day)) {
      return { date: null, issues: [{ level: "error", message: `Data inválida: ${fmt(raw.year)}.` }] };
    }
    const date = toIsoDate(raw.year, raw.month, raw.day);
    const wi = weekdayIssue(date, weekday);
    return { date, issues: wi ? [wi] : [] };
  }

  if (raw.month < 1 || raw.month > 12 || raw.day < 1 || raw.day > 31) {
    return {
      date: null,
      issues: [{ level: "error", message: `Data inválida: ${raw.day}/${raw.month}.` }],
    };
  }

  const issues: Issue[] = [];
  const baseYear = previous ? parseIsoDate(previous).year : referenceYear;
  let year = baseYear;

  if (previous) {
    const sameYearValid = isValidDateParts(baseYear, raw.month, raw.day);
    const sameYear = sameYearValid ? toIsoDate(baseYear, raw.month, raw.day) : null;
    // Allow small backwards steps (out-of-order lines); larger ones mean a new year.
    if (!sameYear || diffInDays(previous, sameYear) < -60) {
      year = baseYear + 1;
      const confirmedByWeekday =
        weekday !== null &&
        isValidDateParts(year, raw.month, raw.day) &&
        weekdayOf(toIsoDate(year, raw.month, raw.day)) === weekday;
      issues.push({
        level: confirmedByWeekday ? "info" : "warning",
        message: confirmedByWeekday
          ? `Virada de ano: ${fmt(year)} (confirmado pelo dia da semana).`
          : `Ano inferido como ${year} pela ordem cronológica. Confirme ou informe o ano na linha (DD/MM/AAAA).`,
      });
    } else if (diffInDays(previous, sameYear) < 0) {
      issues.push({ level: "warning", message: "Data anterior à linha anterior (fora de ordem cronológica)." });
    }
  }

  if (!isValidDateParts(year, raw.month, raw.day)) {
    return { date: null, issues: [{ level: "error", message: `Data inválida: ${fmt(year)}.` }] };
  }
  const date = toIsoDate(year, raw.month, raw.day);
  const wi = weekdayIssue(date, weekday);
  if (wi) {
    // Point out when the weekday suggests another year, without changing it silently.
    const alternatives = [year - 1, year + 1].filter(
      (y) => isValidDateParts(y, raw.month, raw.day) && weekdayOf(toIsoDate(y, raw.month, raw.day)) === weekday,
    );
    if (alternatives.length) wi.message += ` O dia da semana corresponderia ao ano ${alternatives.join(" ou ")}.`;
    issues.push(wi);
  }
  return { date, issues };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function parseHistory(text: string, options: ParseOptions): ParsedHistory {
  const categories = options.categories ?? [];
  const defaultLimit = options.defaultCycleLimit ?? 40;
  const extraAllowance = options.extraAllowance ?? 3;
  const excluded = new Set(options.excludedLines ?? []);
  const rawLines = text.replace(/\r\n?/g, "\n").split("\n");

  const lines: ParsedLine[] = [];
  const segments: ParsedSegment[] = [
    {
      index: 0,
      paymentLine: null,
      paymentDate: null,
      baseLimit: options.initialBaseLimit ?? defaultLimit,
      bonusTotal: 0,
      extraAllowance,
      sessionLines: [],
    },
  ];
  let previousDate: IsoDate | null = null;
  let lastSessionLine: ParsedLine | null = null;
  const numbersBySegment = new Map<string, number>(); // `${segment}:${number}` → line
  const eventKeys = new Map<string, number>();

  rawLines.forEach((raw, i) => {
    const lineNumber = i + 1;
    const segment = segments.length - 1;
    const line: ParsedLine = { lineNumber, raw, state: "parsed", data: null, segment, issues: [] };
    lines.push(line);

    if (excluded.has(lineNumber)) {
      line.state = raw.trim() ? "excluded" : "ignored";
      return;
    }

    const lexed = lexLine(raw);
    if (lexed.kind === "ignored") {
      line.state = "ignored";
      return;
    }
    if (lexed.kind === "invalid") {
      line.state = "invalid";
      line.issues.push({ level: "error", message: lexed.message });
      return;
    }

    let date: IsoDate | null = null;
    if (lexed.date) {
      const resolved = resolveDate(lexed.date, lexed.weekday, previousDate, options.referenceYear);
      date = resolved.date;
      line.issues.push(...resolved.issues);
      if (date) previousDate = date;
    }

    switch (lexed.kind) {
      case "session": {
        if (!lexed.date) {
          // A pending placeholder ("[ ] 19 -") is skipped; a completed one needs a date.
          line.issues.push(
            lexed.completed
              ? { level: "error", message: "Sessão concluída sem data. Use o formato DD/MM." }
              : { level: "warning", message: "Sessão pendente sem data: não será importada. Agende-a depois pelo app." },
          );
        }
        const cat = matchCategory(lexed.tail, categories);
        if (cat.newCategory) {
          line.issues.push({ level: "info", message: `Nova categoria “${cat.categoryName}” será criada.` });
        }
        if (lexed.completed && date && options.today && date > options.today) {
          line.issues.push({ level: "warning", message: "Sessão marcada como concluída com data futura." });
        }
        const seg = segments[segment];
        const key = `${segment}:${lexed.number}`;
        const firstLine = numbersBySegment.get(key);
        if (firstLine !== undefined) {
          line.issues.push({
            level: "error",
            message: `Sessão ${lexed.number} repetida neste ciclo (já aparece na linha ${firstLine}). Possível duplicata.`,
          });
        } else {
          numbersBySegment.set(key, lineNumber);
          const lastNumber = seg.sessionLines.length
            ? (lines[seg.sessionLines[seg.sessionLines.length - 1] - 1].data as { number: number }).number
            : null;
          if (lastNumber === null && seg.paymentLine !== null && lexed.number !== 1) {
            line.issues.push({
              level: "warning",
              message: `Primeira sessão após o pagamento é a ${lexed.number}; a numeração normalmente reinicia em 1.`,
            });
          } else if (lastNumber !== null && lexed.number !== lastNumber + 1) {
            line.issues.push({
              level: "warning",
              message: `Numeração não sequencial: anterior ${lastNumber}, atual ${lexed.number}.`,
            });
          }
          seg.sessionLines.push(lineNumber);
        }
        line.data = {
          kind: "session",
          number: lexed.number,
          date,
          completed: lexed.completed,
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          newCategory: cat.newCategory,
          notes: cat.notes,
        };
        lastSessionLine = line;
        break;
      }
      case "payment": {
        if (!lexed.date) line.issues.push({ level: "warning", message: "Pagamento sem data." });
        const limitFromText = lexed.quantity !== null && lexed.quantity > 0;
        const baseLimit = limitFromText ? (lexed.quantity as number) : defaultLimit;
        if (!limitFromText) {
          line.issues.push({ level: "info", message: `Quantidade não informada; usando o padrão de ${defaultLimit} sessões.` });
        }
        line.data = { kind: "payment", date, baseLimit, limitFromText };
        const index = segments.length;
        segments.push({
          index,
          paymentLine: lineNumber,
          paymentDate: date,
          baseLimit,
          bonusTotal: 0,
          extraAllowance,
          sessionLines: [],
        });
        line.segment = index;
        break;
      }
      case "surgery":
      case "event": {
        const type: ImportEventType = lexed.kind === "surgery" ? "surgery" : lexed.type;
        const title = lexed.kind === "surgery" ? "Cirurgia" : lexed.title;
        if (!lexed.date) {
          if (lexed.kind === "surgery") {
            line.issues.push({ level: "error", message: "Cirurgia sem data. Use o formato DD/MM." });
            line.data = { kind: "event", type, date: null, title };
          } else if (lastSessionLine) {
            // Undated free text: kept as an observation of the previous session.
            line.issues.push({
              level: "info",
              message: `Texto sem data: será adicionado às observações da sessão da linha ${lastSessionLine.lineNumber}.`,
            });
            line.data = { kind: "note", text: title, attachToLine: lastSessionLine.lineNumber };
          } else {
            line.state = "invalid";
            line.issues.push({ level: "error", message: "Evento sem data e sem sessão anterior para associar." });
          }
          break;
        }
        const key = `${type}:${date}:${normalizeText(title)}`;
        const first = eventKeys.get(key);
        if (first !== undefined) {
          line.issues.push({ level: "warning", message: `Evento repetido (linha ${first}); será importado apenas uma vez.` });
        } else {
          eventKeys.set(key, lineNumber);
        }
        line.data = { kind: "event", type, date, title };
        break;
      }
      case "bonus": {
        let bonusDate = date;
        if (!bonusDate) {
          bonusDate = previousDate;
          line.issues.push(
            bonusDate
              ? { level: "info", message: "Bônus sem data: usando a data da linha anterior." }
              : { level: "error", message: "Bônus sem data e sem linha anterior com data." },
          );
        }
        if (lexed.quantity <= 0) line.issues.push({ level: "error", message: "Quantidade de bônus inválida." });
        segments[segment].bonusTotal += Math.max(0, lexed.quantity);
        line.data = { kind: "bonus", date: bonusDate, quantity: lexed.quantity, reason: lexed.reason };
        break;
      }
    }
  });

  // Limit checks need the bonuses of the whole segment.
  for (const seg of segments) {
    const paid = seg.baseLimit + seg.bonusTotal;
    const max = paid + seg.extraAllowance;
    for (const ln of seg.sessionLines) {
      const line = lines[ln - 1];
      const data = line.data as { number: number };
      if (data.number > max) {
        line.issues.push({
          level: "error",
          message: `Sessão ${data.number} ultrapassa o máximo do ciclo (${max} = ${seg.baseLimit}${
            seg.bonusTotal ? ` + ${seg.bonusTotal} bônus` : ""
          } + ${seg.extraAllowance} extras).`,
        });
      } else if (data.number > paid) {
        line.issues.push({
          level: "info",
          message: `Sessão excedente: acima do limite de ${paid} sessões, dentro das ${seg.extraAllowance} extras permitidas.`,
        });
      }
    }
  }

  for (const line of lines) {
    if (line.state === "parsed" && line.issues.some((i) => i.level === "error")) line.state = "invalid";
  }

  const active = lines.filter((l) => l.state === "parsed" || l.state === "invalid");
  const of = (kind: ParsedData["kind"]) => active.filter((l) => l.data?.kind === kind);
  const sessions = of("session");
  return {
    lines,
    segments,
    summary: {
      sessions: sessions.length,
      completed: sessions.filter((l) => (l.data as { completed: boolean }).completed).length,
      pending: sessions.filter((l) => !(l.data as { completed: boolean }).completed).length,
      payments: of("payment").length,
      bonuses: of("bonus").length,
      events: of("event").length,
      errors: active.reduce((n, l) => n + l.issues.filter((i) => i.level === "error").length, 0),
      warnings: active.reduce((n, l) => n + l.issues.filter((i) => i.level === "warning").length, 0),
    },
  };
}

/** Earliest date in the text, useful to suggest a reference year. */
export function firstDatedLineHint(text: string): { day: number; month: number } | null {
  for (const raw of text.split(/\r?\n/)) {
    const lexed = lexLine(raw);
    if ("date" in lexed && lexed.date && lexed.date.year === null) {
      return { day: lexed.date.day, month: lexed.date.month };
    }
  }
  return null;
}

