import { describe, expect, it } from "vitest";
import { lexLine, matchCategory, parseHistory, type ParsedData } from "@/lib/parsers/history";

const CATEGORIES = [
  "TOM",
  "Intensidade",
  "Coordenação",
  "Sensório Motor",
  "Areia",
  "Areia Moreira",
  "Volume",
  "Corrida e Saltos",
  "Habilidade",
  "Explosão",
  "Adaptado Explosão",
  "Máquinas",
  "Outro",
].map((name, i) => ({ id: i + 1, name }));

const opts = { referenceYear: 2026, categories: CATEGORIES, today: "2026-10-19" };

function dataOf(text: string, extra: Partial<typeof opts> = {}) {
  return parseHistory(text, { ...opts, ...extra });
}

function only<K extends ParsedData["kind"]>(text: string, kind: K) {
  const parsed = dataOf(text);
  const line = parsed.lines.find((l) => l.data?.kind === kind);
  if (!line) throw new Error(`no ${kind} line`);
  return { line, data: line.data as Extract<ParsedData, { kind: K }>, parsed };
}

describe("history parser — sessions", () => {
  it("parses a completed session with category", () => {
    const { data, line } = only("[✓] 17 - Sexta 16/10 - Adaptado explosão", "session");
    expect(data).toMatchObject({
      number: 17,
      date: "2026-10-16",
      completed: true,
      categoryId: 11,
      categoryName: "Adaptado Explosão",
      notes: null,
    });
    expect(line.issues.filter((i) => i.level !== "info")).toHaveLength(0);
  });

  it("parses a pending session without category", () => {
    const { data } = only("[ ] 18 - Segunda 19/10", "session");
    expect(data).toMatchObject({ number: 18, date: "2026-10-19", completed: false, categoryId: null });
  });

  it("accepts [x], [X] and [✓] as completed", () => {
    for (const mark of ["x", "X", "✓"]) {
      const { data } = only(`[${mark}] 36 - Quarta 05/08 - Intensidade`, "session");
      expect(data.completed).toBe(true);
    }
  });

  it("tolerates spacing, case and missing accents in categories", () => {
    const { data } = only("[x]35-segunda   03/08   -   HABILIDADE", "session");
    expect(data).toMatchObject({ number: 35, date: "2026-08-03", categoryName: "Habilidade" });
    expect(only("[ ] 1 - Terça 04/08 - sensorio motor", "session").data.categoryName).toBe("Sensório Motor");
    expect(only("[ ] 1 - Terça 04/08 - Coordenacao", "session").data.categoryName).toBe("Coordenação");
  });

  it("prefers the longest matching category and keeps the rest as notes", () => {
    expect(matchCategory("Areia Moreira", CATEGORIES).categoryName).toBe("Areia Moreira");
    const m = matchCategory("Areia - joelho dolorido", CATEGORIES);
    expect(m).toMatchObject({ categoryName: "Areia", notes: "joelho dolorido" });
  });

  it("proposes a new category for unknown short names", () => {
    const { data, line } = only("[✓] 3 - Sexta 07/08 - Pilates", "session");
    expect(data).toMatchObject({ categoryId: null, categoryName: "Pilates", newCategory: true });
    expect(line.issues.some((i) => i.message.includes("Nova categoria"))).toBe(true);
  });

  it("checks the informed weekday against the date", () => {
    const { line } = only("[ ] 18 - Terça 19/10", "session");
    expect(line.issues.some((i) => i.level === "warning" && i.message.includes("não corresponde"))).toBe(true);
  });

  it("rejects invalid dates", () => {
    const parsed = dataOf("[ ] 5 - 31/02");
    expect(parsed.lines[0].state).toBe("invalid");
    expect(parsed.summary.errors).toBe(1);
  });

  it("rejects sessions without date", () => {
    const parsed = dataOf("[ ] 5 - Intensidade");
    expect(parsed.lines[0].state).toBe("invalid");
  });
});

describe("history parser — events", () => {
  it("recognizes the surgery", () => {
    const { data } = only("[ ] ====== Cirurgia dia 31/03 ======", "event");
    expect(data).toEqual({ kind: "event", type: "surgery", date: "2026-03-31", title: "Cirurgia" });
  });

  it("recognizes payments as cycle separators with their limit", () => {
    const text = ["[✓] 40 - Segunda 24/08", "[ ] ==== PAGAMENTO + 40 SESSÕES 26/08 ====", "[ ] 1 - Sexta 28/08"].join(
      "\n",
    );
    const parsed = dataOf(text);
    expect(parsed.lines[1].data).toMatchObject({ kind: "payment", date: "2026-08-26", baseLimit: 40 });
    expect(parsed.segments).toHaveLength(2);
    expect(parsed.lines[0].segment).toBe(0);
    expect(parsed.lines[2].segment).toBe(1);
    expect(parsed.lines[2].issues.filter((i) => i.level !== "info")).toHaveLength(0);
  });

  it("supports a custom payment limit", () => {
    const { data } = only("==== PAGAMENTO + 20 SESSÕES 26/08 ====", "payment");
    expect(data.baseLimit).toBe(20);
  });

  it("recognizes holidays and does not turn them into sessions", () => {
    const parsed = dataOf("[ ] => Sexta 05/06 => Feriado");
    expect(parsed.lines[0].data).toEqual({ kind: "event", type: "holiday", date: "2026-06-05", title: "Feriado" });
    expect(parsed.summary.sessions).toBe(0);
  });

  it("recognizes bonuses and uses the previous date when none is given", () => {
    const text = ["[✓] 39 - Quarta 19/08 - Volume", "[ ] => Ganhei 3 sessões por zerar o eletro"].join("\n");
    const parsed = dataOf(text);
    expect(parsed.lines[1].data).toMatchObject({ kind: "bonus", quantity: 3, date: "2026-08-19" });
    expect((parsed.lines[1].data as { reason: string }).reason).toContain("zerar o eletro");
    expect(parsed.segments[0].bonusTotal).toBe(3);
  });

  it("lets bonuses raise the limit for the same cycle", () => {
    const lines = ["[ ] => Ganhei 3 sessões por zerar o eletro 01/08"];
    for (let n = 1; n <= 43; n++) lines.push(`[✓] ${n} - 02/08`);
    const parsed = dataOf(lines.join("\n"));
    expect(parsed.summary.errors).toBe(0);
    const over = dataOf([...lines, "[ ] 44 - 03/08"].join("\n"));
    expect(over.lines.at(-1)?.state).toBe("invalid");
  });

  it("ignores blank and decorative lines and preserves order", () => {
    const parsed = dataOf(["", "=======", "[ ] 1 - 01/08", "   ", "[ ] 2 - 03/08"].join("\n"));
    expect(parsed.lines.map((l) => l.state)).toEqual(["ignored", "ignored", "parsed", "ignored", "parsed"]);
    expect(parsed.summary.sessions).toBe(2);
  });
});

describe("history parser — years and validation", () => {
  it("uses the reference year for dates without year", () => {
    expect(only("[ ] 1 - 10/03", "session").data.date).toBe("2026-03-10");
    expect(parseHistory("[ ] 1 - 10/03", { ...opts, referenceYear: 2025 }).lines[0].data).toMatchObject({
      date: "2025-03-10",
    });
  });

  it("accepts explicit years", () => {
    expect(only("[ ] 1 - 10/03/2027", "session").data.date).toBe("2027-03-10");
    expect(only("[ ] 1 - 10/03/27", "session").data.date).toBe("2027-03-10");
  });

  it("rolls over the year chronologically and warns when not confirmed", () => {
    const parsed = dataOf(["[ ] 1 - 28/12", "[ ] 2 - 04/01"].join("\n"));
    expect(parsed.lines[1].data).toMatchObject({ date: "2027-01-04" });
    expect(parsed.lines[1].issues.some((i) => i.level === "warning" && i.message.includes("2027"))).toBe(true);
  });

  it("confirms a year rollover with the weekday", () => {
    // 04/01/2027 is a Monday.
    const parsed = dataOf(["[ ] 1 - 28/12", "[ ] 2 - Segunda 04/01"].join("\n"));
    expect(parsed.lines[1].issues.every((i) => i.level === "info")).toBe(true);
  });

  it("flags duplicate session numbers within a cycle", () => {
    const parsed = dataOf(["[✓] 17 - Sexta 16/10", "[✓] 17 - Sexta 16/10"].join("\n"));
    expect(parsed.lines[1].state).toBe("invalid");
    expect(parsed.lines[1].issues[0].message).toContain("repetida");
  });

  it("allows the same number in different cycles", () => {
    const parsed = dataOf(["[✓] 1 - 03/08", "== PAGAMENTO + 40 SESSÕES 26/08 ==", "[ ] 1 - 28/08"].join("\n"));
    expect(parsed.summary.errors).toBe(0);
  });

  it("warns when numbering does not restart after a payment", () => {
    const parsed = dataOf(["== PAGAMENTO + 40 SESSÕES 26/08 ==", "[ ] 5 - 28/08"].join("\n"));
    expect(parsed.lines[1].issues.some((i) => i.message.includes("reinicia"))).toBe(true);
  });

  it("reports unknown lines as invalid", () => {
    expect(lexLine("[ ] ???").kind).toBe("event");
    const parsed = dataOf("=> sem data nem sessão");
    expect(parsed.lines[0].state).toBe("invalid");
  });

  it("excludes lines chosen by the user", () => {
    const parsed = dataOf(["[✓] 17 - Sexta 16/10", "[✓] 17 - Sexta 16/10"].join("\n"), { excludedLines: [2] } as never);
    expect(parsed.lines[1].state).toBe("excluded");
    expect(parsed.summary.errors).toBe(0);
  });

  it("flags completed sessions dated in the future", () => {
    const { line } = only("[✓] 20 - 30/10", "session");
    expect(line.issues.some((i) => i.message.includes("futura"))).toBe(true);
  });

  it("parses the full example list", () => {
    const text = `[ ] ====== Cirurgia dia 31/03 ======
[ ] => Sexta 05/06 => Feriado
[✓] 35 - Segunda 03/08 - Habilidade
[✓] 36 - Quarta 05/08 - Intensidade
[ ] => Ganhei 3 sessões por zerar o eletro
[ ] ==== PAGAMENTO + 40 SESSÕES 26/08 ====
[✓] 17 - Sexta 16/10 - Adaptado explosão
[ ] 18 - Segunda 19/10`;
    const parsed = dataOf(text);
    expect(parsed.summary).toMatchObject({ sessions: 4, completed: 3, pending: 1, payments: 1, bonuses: 1, events: 2, errors: 0 });
  });
});
