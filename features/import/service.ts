import "server-only";
import { withTransaction, db, type Queryable } from "@/lib/db/client";
import { UserFacingError } from "@/lib/db/errors";
import { createCategory, listCategories } from "@/lib/db/repositories/categories";
import { createBonus, insertCycle, listCycles, lockCycles } from "@/lib/db/repositories/cycles";
import { createEvent } from "@/lib/db/repositories/events";
import { getSettings } from "@/lib/db/repositories/settings";
import { insertSession } from "@/lib/db/repositories/sessions";
import { todayIso } from "@/lib/dates/calendar";
import { parseHistory, type Issue, type ParsedData, type ParsedLine } from "@/lib/parsers/history";
import { normalizeText } from "@/lib/utils/text";
import type { Cycle } from "@/types/domain";

export type ImportOptions = {
  referenceYear: number;
  excludedLines: number[];
  /** Cycle for lines before the first payment: "auto", "new" or an existing cycle id. */
  initialCycle: "auto" | "new" | number;
  initialBaseLimit?: number;
  createCategories: boolean;
};

export type DbStatus = "new" | "duplicate" | "skip";

export type PreviewLine = ParsedLine & {
  db: DbStatus;
  cycleLabel: string | null;
};

export type PreviewSegment = {
  index: number;
  label: string;
  action: "new" | "existing" | "none";
  cycleId: number | null;
  cycleNumber: number;
  baseLimit: number;
  limit: number;
};

export type ImportPreview = {
  lines: PreviewLine[];
  segments: PreviewSegment[];
  counts: {
    sessions: number;
    cycles: number;
    bonuses: number;
    events: number;
    categories: number;
    duplicates: number;
    errors: number;
    warnings: number;
  };
  newCategories: string[];
  canImport: boolean;
  existingCycles: { id: number; cycleNumber: number }[];
};

type ExistingSession = {
  id: number;
  cycle_id: number;
  number_in_cycle: number;
  session_date: string;
  import_key: string | null;
};
type ExistingEvent = { type: string; event_date: string; title: string; import_key: string | null };
type ExistingBonus = { cycle_id: number; granted_on: string; quantity: number; import_key: string | null };

const sessionKey = (date: string, number: number) => `session:${date}:${number}`;
const eventKey = (type: string, date: string, title: string) =>
  type === "surgery" ? `surgery:${date}` : `${type}:${date}:${normalizeText(title)}`;
const bonusKey = (date: string, quantity: number, reason: string) => `bonus:${date}:${quantity}:${normalizeText(reason)}`;

function addIssue(line: PreviewLine, issue: Issue) {
  line.issues.push(issue);
  if (issue.level === "error" && line.state === "parsed") line.state = "invalid";
}

async function analyze(tx: Queryable, text: string, options: ImportOptions): Promise<ImportPreview> {
  const [settings, categories, cycles] = await Promise.all([
    getSettings(tx),
    listCategories({}, tx),
    listCycles(tx),
  ]);
  const parsed = parseHistory(text, {
    referenceYear: options.referenceYear,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    defaultCycleLimit: settings.defaultCycleLimit,
    excludedLines: options.excludedLines,
    today: todayIso(settings.timeZone),
  });
  if (options.initialBaseLimit) parsed.segments[0].baseLimit = options.initialBaseLimit;

  const [sessionsRes, eventsRes, bonusesRes] = await Promise.all([
    tx.query<ExistingSession>(`SELECT id, cycle_id, number_in_cycle, session_date, import_key FROM sessions`),
    tx.query<ExistingEvent>(`SELECT type, event_date, title, import_key FROM events`),
    tx.query<ExistingBonus>(`SELECT cycle_id, granted_on, quantity, import_key FROM bonuses`),
  ]);
  const existingSessions = sessionsRes.rows;
  const existingByKey = new Map(existingSessions.map((s) => [sessionKey(s.session_date, s.number_in_cycle), s]));
  // Records imported earlier and edited afterwards keep their original import key.
  for (const s of existingSessions) if (s.import_key && !existingByKey.has(s.import_key)) existingByKey.set(s.import_key, s);
  const existingEventKeys = new Set(eventsRes.rows.map((e) => eventKey(e.type, e.event_date, e.title)));
  for (const e of eventsRes.rows) if (e.import_key) existingEventKeys.add(e.import_key);
  const existingBonusKeys = new Set(bonusesRes.rows.map((b) => b.import_key).filter(Boolean));
  const cycleById = new Map(cycles.map((c) => [c.id, c]));

  const lines: PreviewLine[] = parsed.lines.map((l) => ({ ...l, issues: [...l.issues], db: "new", cycleLabel: null }));
  const active = (l: PreviewLine) => l.state === "parsed" || l.state === "invalid";

  // --- Resolve the target cycle of each segment -----------------------------
  let plannedNumber = cycles.reduce((m, c) => Math.max(m, c.cycleNumber), 0);
  const segments: PreviewSegment[] = parsed.segments.map((seg) => {
    const segLines = lines.filter((l) => active(l) && l.segment === seg.index);
    const hasContent = segLines.some((l) => l.data && l.data.kind !== "payment");
    let existing: Cycle | null = null;

    if (seg.paymentLine !== null) {
      existing = cycles.find((c) => seg.paymentDate && c.paymentDate === seg.paymentDate) ?? null;
    } else {
      if (!hasContent) {
        return { index: 0, label: "—", action: "none", cycleId: null, cycleNumber: 0, baseLimit: seg.baseLimit, limit: seg.baseLimit };
      }
      // Re-import: a session already stored tells us which cycle this block is.
      for (const l of segLines) {
        if (l.data?.kind === "session" && l.data.date) {
          const match = existingByKey.get(sessionKey(l.data.date, l.data.number));
          if (match) {
            existing = cycleById.get(match.cycle_id) ?? null;
            break;
          }
        }
      }
      if (!existing) {
        if (typeof options.initialCycle === "number") {
          existing = cycleById.get(options.initialCycle) ?? null;
          if (!existing) throw new UserFacingError("Ciclo selecionado para o primeiro bloco não existe.");
        } else if (options.initialCycle === "auto" && cycles.length) {
          existing = cycles[cycles.length - 1];
        }
      }
    }

    if (existing) {
      const newBonus = segLines.reduce(
        (sum, l) =>
          l.data?.kind === "bonus" && l.data.date && !existingBonusKeys.has(bonusKey(l.data.date, l.data.quantity, l.data.reason))
            ? sum + l.data.quantity
            : sum,
        0,
      );
      return {
        index: seg.index,
        label: `Ciclo ${existing.cycleNumber} (existente)`,
        action: "existing",
        cycleId: existing.id,
        cycleNumber: existing.cycleNumber,
        baseLimit: existing.baseLimit,
        limit: existing.totalLimit + newBonus,
      };
    }
    plannedNumber += 1;
    return {
      index: seg.index,
      label: `Novo ciclo ${plannedNumber}`,
      action: "new",
      cycleId: null,
      cycleNumber: plannedNumber,
      baseLimit: seg.baseLimit,
      limit: seg.baseLimit + seg.bonusTotal,
    };
  });

  // --- Per-line database checks ---------------------------------------------
  const sessionLineStatus = new Map<number, DbStatus>();
  for (const line of lines) {
    if (!active(line) || !line.data) continue;
    const seg = segments[line.segment];
    line.cycleLabel = seg?.label ?? null;
    const data: ParsedData = line.data;

    switch (data.kind) {
      case "session": {
        if (!data.date) break;
        const dup = existingByKey.get(sessionKey(data.date, data.number));
        if (dup) {
          line.db = "duplicate";
          addIssue(line, { level: "info", message: "Sessão já cadastrada (mesma data e número); será ignorada." });
        } else if (seg.action === "existing") {
          const clash = existingSessions.find((s) => s.cycle_id === seg.cycleId && s.number_in_cycle === data.number);
          if (clash) {
            addIssue(line, {
              level: "error",
              message: `O ciclo ${seg.cycleNumber} já tem a sessão ${data.number} em outra data (${clash.session_date.split("-").reverse().join("/")}).`,
            });
          } else if (data.number > seg.limit) {
            addIssue(line, {
              level: "error",
              message: `Sessão ${data.number} ultrapassa o limite do ciclo ${seg.cycleNumber} (${seg.limit}).`,
            });
          }
        }
        sessionLineStatus.set(line.lineNumber, line.db);
        break;
      }
      case "payment": {
        if (seg.action === "existing") {
          line.db = "duplicate";
          addIssue(line, { level: "info", message: `Pagamento já registrado (ciclo ${seg.cycleNumber}); as sessões serão vinculadas a ele.` });
        }
        break;
      }
      case "bonus": {
        if (data.date && existingBonusKeys.has(bonusKey(data.date, data.quantity, data.reason))) {
          line.db = "duplicate";
          addIssue(line, { level: "info", message: "Bônus já importado anteriormente; será ignorado." });
        }
        break;
      }
      case "event": {
        if (data.date && existingEventKeys.has(eventKey(data.type, data.date, data.title))) {
          line.db = "duplicate";
          addIssue(line, { level: "info", message: "Evento já cadastrado; será ignorado." });
        }
        break;
      }
      case "note": {
        const target = data.attachToLine ? sessionLineStatus.get(data.attachToLine) : undefined;
        if (target === "duplicate") {
          line.db = "skip";
          addIssue(line, { level: "info", message: "A sessão associada já existe; a observação não será alterada." });
        }
        break;
      }
    }
  }

  // --- Categories to create ---------------------------------------------------
  const known = new Set(categories.map((c) => c.normalizedName));
  const newCategories = new Map<string, string>();
  for (const line of lines) {
    if (active(line) && line.db === "new" && line.data?.kind === "session" && line.data.newCategory && line.data.categoryName) {
      const key = normalizeText(line.data.categoryName);
      if (!known.has(key) && !newCategories.has(key)) newCategories.set(key, line.data.categoryName);
    }
  }

  const willImport = lines.filter((l) => l.state === "parsed" && l.db === "new");
  const kindCount = (k: ParsedData["kind"]) => willImport.filter((l) => l.data?.kind === k).length;
  const errors = lines.filter(active).reduce((n, l) => n + l.issues.filter((i) => i.level === "error").length, 0);
  const warnings = lines.filter(active).reduce((n, l) => n + l.issues.filter((i) => i.level === "warning").length, 0);

  return {
    lines,
    segments,
    counts: {
      sessions: kindCount("session"),
      cycles: segments.filter((s) => s.action === "new").length,
      bonuses: kindCount("bonus"),
      events: kindCount("event"),
      categories: options.createCategories ? newCategories.size : 0,
      duplicates: lines.filter((l) => active(l) && l.db === "duplicate").length,
      errors,
      warnings,
    },
    newCategories: [...newCategories.values()],
    canImport: errors === 0 && willImport.length > 0,
    existingCycles: cycles.map((c) => ({ id: c.id, cycleNumber: c.cycleNumber })),
  };
}

/** Builds the preview without writing anything. */
export async function previewImport(text: string, options: ImportOptions): Promise<ImportPreview> {
  return analyze(db, text, options);
}

export type ImportResult = {
  sessions: number;
  cycles: number;
  bonuses: number;
  events: number;
  categories: number;
  skipped: number;
};

/**
 * Re-validates on the server and writes everything in a single transaction:
 * either the whole history is stored or nothing is.
 */
export async function executeImport(text: string, options: ImportOptions): Promise<ImportResult> {
  return withTransaction(async (tx) => {
    await tx.query(`SELECT pg_advisory_xact_lock(727203)`); // one import at a time
    await lockCycles(tx);
    const preview = await analyze(tx, text, options);
    if (!preview.canImport) {
      const bad = preview.lines
        .filter((l) => l.issues.some((i) => i.level === "error"))
        .map((l) => l.lineNumber);
      throw new UserFacingError(
        bad.length
          ? `Corrija ou exclua as linhas com erro antes de importar: ${bad.slice(0, 15).join(", ")}${bad.length > 15 ? "…" : ""}.`
          : "Nada novo para importar.",
      );
    }

    const result: ImportResult = { sessions: 0, cycles: 0, bonuses: 0, events: 0, categories: 0, skipped: preview.counts.duplicates };

    // Categories.
    const categoryIds = new Map<string, number>();
    if (options.createCategories) {
      for (const name of preview.newCategories) {
        categoryIds.set(normalizeText(name), await createCategory(name, "#64748b", tx));
        result.categories += 1;
      }
    }

    // Cycles, in order. Previous cycles are never modified.
    const cycleIds = new Map<number, number>();
    for (const seg of preview.segments) {
      if (seg.action === "existing" && seg.cycleId) cycleIds.set(seg.index, seg.cycleId);
      if (seg.action !== "new") continue;
      const segLines = preview.lines.filter((l) => l.segment === seg.index && l.state === "parsed");
      const payment = segLines.find((l) => l.data?.kind === "payment")?.data as Extract<ParsedData, { kind: "payment" }> | undefined;
      const firstSession = segLines.find((l) => l.data?.kind === "session")?.data as
        | Extract<ParsedData, { kind: "session" }>
        | undefined;
      const created = await insertCycle(tx, {
        paymentDate: payment?.date ?? null,
        startDate: firstSession?.date ?? null,
        baseLimit: seg.baseLimit,
        notes: "Importado do histórico em texto",
      });
      cycleIds.set(seg.index, created.id);
      result.cycles += 1;
    }

    const toWrite = preview.lines.filter((l) => l.state === "parsed" && l.db === "new" && l.data);

    // Bonuses first, so sessions above the base limit fit the cycle.
    for (const line of toWrite) {
      if (line.data?.kind !== "bonus" || !line.data.date) continue;
      await createBonus(
        {
          cycleId: cycleIds.get(line.segment)!,
          quantity: line.data.quantity,
          grantedOn: line.data.date,
          reason: line.data.reason,
          notes: undefined,
        },
        tx,
        bonusKey(line.data.date, line.data.quantity, line.data.reason),
      );
      result.bonuses += 1;
    }

    // Notes from undated lines are appended to their session.
    const extraNotes = new Map<number, string[]>();
    for (const line of toWrite) {
      if (line.data?.kind === "note" && line.data.attachToLine) {
        extraNotes.set(line.data.attachToLine, [...(extraNotes.get(line.data.attachToLine) ?? []), line.data.text]);
      }
    }

    const seenEvents = new Set<string>();
    for (const line of toWrite) {
      const data = line.data!;
      if (data.kind === "session" && data.date) {
        let categoryId = data.categoryId;
        let notes = data.notes;
        if (!categoryId && data.newCategory && data.categoryName) {
          const id = categoryIds.get(normalizeText(data.categoryName));
          if (id) categoryId = id;
          else notes = [data.categoryName, notes].filter(Boolean).join(" — ");
        }
        const extra = extraNotes.get(line.lineNumber);
        if (extra) notes = [notes, ...extra].filter(Boolean).join("\n");
        await insertSession(
          tx,
          {
            cycleId: cycleIds.get(line.segment)!,
            numberInCycle: data.number,
            sessionDate: data.date,
            status: data.completed ? "completed" : "pending",
            categoryId: categoryId ?? undefined,
            notes: notes ?? undefined,
          },
          sessionKey(data.date, data.number),
        );
        result.sessions += 1;
      } else if (data.kind === "event" && data.date) {
        const key = eventKey(data.type, data.date, data.title);
        if (seenEvents.has(key)) continue;
        seenEvents.add(key);
        await createEvent({ title: data.title, type: data.type, eventDate: data.date }, tx, key);
        result.events += 1;
      }
    }
    return result;
  });
}
