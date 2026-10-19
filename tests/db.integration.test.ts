import { beforeAll, describe, expect, it } from "vitest";
import { hasTestDatabase, resetDatabase } from "./helpers/db";

const d = hasTestDatabase ? describe : describe.skip;

d("database integration", async () => {
  // Imported lazily so the suite can be skipped without DATABASE_URL.
  const sessions = await import("@/lib/db/repositories/sessions");
  const cycles = await import("@/lib/db/repositories/cycles");
  const settings = await import("@/lib/db/repositories/settings");
  const events = await import("@/lib/db/repositories/events");
  const categories = await import("@/lib/db/repositories/categories");
  const backup = await import("@/lib/db/repositories/backup");
  const importer = await import("@/features/import/service");
  const { toUserMessage } = await import("@/lib/db/errors");

  beforeAll(async () => {
    await resetDatabase();
  }, 30_000);

  const options = {
    referenceYear: 2026,
    excludedLines: [],
    initialCycle: "auto" as const,
    createCategories: true,
  };

  it("seeds settings with the surgery date as a DATE", async () => {
    const s = await settings.getSettings();
    expect(s.surgeryDate).toBe("2026-03-31");
    expect(s.defaultCycleLimit).toBe(40);
  });

  it("registers a payment as a new cycle with 40 sessions", async () => {
    const created = await cycles.registerPayment({ paymentDate: "2026-04-01", baseLimit: 40 });
    expect(created.cycleNumber).toBe(1);
    const c = await cycles.getCycle(created.id);
    expect(c).toMatchObject({ cycleNumber: 1, baseLimit: 40, totalLimit: 40, completedCount: 0 });
  });

  it("numbers sessions automatically and independently of status", async () => {
    const cycle = (await cycles.getCurrentCycle())!;
    const a = await sessions.createSession({ cycleId: cycle.id, sessionDate: "2026-04-02", status: "completed" });
    const b = await sessions.createSession({ cycleId: cycle.id, sessionDate: "2026-04-06", status: "pending" });
    const sa = await sessions.getSession(a);
    const sb = await sessions.getSession(b);
    expect([sa?.numberInCycle, sb?.numberInCycle]).toEqual([1, 2]);
    expect([sa?.globalNumber, sb?.globalNumber]).toEqual([1, 2]);
    expect(sa?.completedAt).not.toBeNull();
    expect(sb?.completedAt).toBeNull();
  });

  it("rejects duplicate numbers in the same cycle with a suggestion", async () => {
    const cycle = (await cycles.getCurrentCycle())!;
    await expect(
      sessions.createSession({ cycleId: cycle.id, numberInCycle: 2, sessionDate: "2026-04-08", status: "pending" }),
    ).rejects.toMatchObject({ suggestion: 3 });
  });

  it("completes and reopens a session", async () => {
    const list = await sessions.listSessions({ status: "pending" });
    const id = list.items[0].id;
    await sessions.setSessionStatus(id, "completed");
    expect((await sessions.getSession(id))?.status).toBe("completed");
    await sessions.setSessionStatus(id, "pending");
    const reopened = await sessions.getSession(id);
    expect(reopened?.status).toBe("pending");
    expect(reopened?.completedAt).toBeNull();
  });

  it("accepts up to 43 sessions in a default 40-session cycle", async () => {
    const c = await cycles.registerPayment({ paymentDate: "2026-04-20", baseLimit: 40 });
    const created = await cycles.getCycle(c.id);
    expect(created).toMatchObject({ baseLimit: 40, extraAllowance: 3, totalLimit: 40, maxAllowed: 43 });
    await sessions.createSession({ cycleId: c.id, numberInCycle: 43, sessionDate: "2026-04-21", status: "completed" });
    await expect(
      sessions.createSession({ cycleId: c.id, numberInCycle: 44, sessionDate: "2026-04-22", status: "pending" }),
    ).rejects.toThrow(/máximo/);
    // Lowering the allowance below a session in use is refused.
    await expect(cycles.updateCycle({ id: c.id, baseLimit: 40, extraAllowance: 2 })).rejects.toBeDefined();
  });

  it("enforces the cycle limit and counts bonuses once", async () => {
    const small = await cycles.registerPayment({ paymentDate: "2026-05-01", baseLimit: 2, extraAllowance: 0 });
    await sessions.createSession({ cycleId: small.id, sessionDate: "2026-05-02", status: "completed" });
    await sessions.createSession({ cycleId: small.id, sessionDate: "2026-05-03", status: "completed" });
    await expect(
      sessions.createSession({ cycleId: small.id, sessionDate: "2026-05-04", status: "pending" }),
    ).rejects.toThrow(/completo/);

    await cycles.createBonus({ cycleId: small.id, quantity: 3, grantedOn: "2026-05-04", reason: "zerar o eletro" });
    const c = await cycles.getCycle(small.id);
    expect(c).toMatchObject({ baseLimit: 2, bonusTotal: 3, totalLimit: 5, maxAllowed: 5 });
    await sessions.createSession({ cycleId: small.id, sessionDate: "2026-05-05", status: "pending" });
    expect((await cycles.getCycle(small.id))?.totalLimit).toBe(5);
  });

  it("refuses to drop a limit or bonus already in use", async () => {
    const first = (await cycles.listCycles())[0]; // sessions 1 and 2
    await expect(cycles.updateCycle({ id: first.id, baseLimit: 1, extraAllowance: 0 })).rejects.toSatisfy(
      (e: unknown) => toUserMessage(e).includes("limite"),
    );
    const c = (await cycles.getCurrentCycle())!; // base 2 + bonus 3, session 3 in use
    const bonus = (await cycles.listBonuses()).find((b) => b.cycleId === c.id)!;
    await expect(cycles.deleteBonus(bonus.id)).rejects.toBeDefined();
  });

  it("restarts numbering in a new cycle and keeps previous cycles intact", async () => {
    const before = await cycles.listCycles();
    const next = await cycles.registerPayment({ paymentDate: "2026-06-01", baseLimit: 40 });
    const id = await sessions.createSession({ cycleId: next.id, sessionDate: "2026-06-02", status: "pending" });
    expect((await sessions.getSession(id))?.numberInCycle).toBe(1);
    const after = await cycles.listCycles();
    expect(after.slice(0, before.length)).toEqual(before);
  });

  it("changes the surgery date without touching sessions or other events", async () => {
    const snapshot = await sessions.listSessions({ sort: "asc" });
    await settings.updateSurgeryDate("2026-04-15");
    expect((await settings.getSettings()).surgeryDate).toBe("2026-04-15");
    expect(await sessions.listSessions({ sort: "asc" })).toEqual(snapshot);
    await settings.updateSurgeryDate("2026-03-31");
  });

  it("keeps categories used by sessions (deactivate instead of delete)", async () => {
    const id = await categories.createCategory("Pilates Teste", "#123456");
    const cycle = (await cycles.getCurrentCycle())!;
    await sessions.createSession({ cycleId: cycle.id, sessionDate: "2026-06-03", status: "completed", categoryId: id });
    await expect(categories.deleteUnusedCategory(id)).rejects.toThrow(/Desative/);
    await categories.setCategoryActive(id, false);
    const all = await categories.listCategories();
    expect(all.find((c) => c.id === id)).toMatchObject({ active: false, usageCount: 1 });
  });

  it("merges sessions, payments, bonuses and events in the timeline", async () => {
    const items = await events.listTimeline({ order: "asc" });
    const kinds = new Set(items.map((i) => i.kind));
    for (const k of ["surgery", "payment", "bonus", "session-completed", "session-pending"]) expect(kinds).toContain(k);
    expect(items[0].kind).toBe("surgery");
  });

  describe("history import", () => {
    const text = `[ ] ====== Cirurgia dia 31/03 ======
[ ] => Sexta 05/06 => Feriado
[ ] ==== PAGAMENTO + 40 SESSÕES 26/08 ====
[✓] 1 - Sexta 28/08 - Habilidade
[✓] 2 - Segunda 31/08 - Pilates novo
[ ] => Ganhei 3 sessões por zerar o eletro
[ ] 3 - Quarta 02/09`;

    it("previews without writing", async () => {
      const before = await backup.countTreatmentData();
      const preview = await importer.previewImport(text, options);
      expect(await backup.countTreatmentData()).toEqual(before);
      expect(preview.canImport).toBe(true);
      expect(preview.counts).toMatchObject({ sessions: 3, cycles: 1, bonuses: 1, events: 1, categories: 1 });
      // The surgery already exists → duplicate.
      expect(preview.lines[0].db).toBe("duplicate");
    });

    it("imports in one transaction and is idempotent", async () => {
      const result = await importer.executeImport(text, options);
      expect(result).toMatchObject({ sessions: 3, cycles: 1, bonuses: 1, events: 1, categories: 1 });
      const imported = (await cycles.listCycles()).at(-1)!;
      expect(imported).toMatchObject({ paymentDate: "2026-08-26", baseLimit: 40, bonusTotal: 3, totalLimit: 43 });

      const again = await importer.previewImport(text, options);
      expect(again.counts.sessions).toBe(0);
      expect(again.canImport).toBe(false);
      await expect(importer.executeImport(text, options)).rejects.toThrow(/Nada novo/);
      expect((await cycles.listCycles()).length).toBe((await cycles.listCycles()).length);
    });

    it("reports conflicting lines and writes nothing", async () => {
      const before = await backup.countTreatmentData();
      const bad = `==== PAGAMENTO + 40 SESSÕES 26/08 ====
[ ] 3 - Sexta 04/09`;
      const preview = await importer.previewImport(bad, options);
      expect(preview.canImport).toBe(false);
      expect(preview.lines[1].issues.some((i) => i.level === "error")).toBe(true);
      await expect(importer.executeImport(bad, options)).rejects.toThrow(/linhas com erro/);
      expect(await backup.countTreatmentData()).toEqual(before);
    });
  });

  it("exports and restores a backup", async () => {
    const data = await backup.exportBackup();
    const parsed = backup.parseBackup(JSON.parse(JSON.stringify(data)));
    await expect(backup.restoreBackup(parsed, "empty")).rejects.toThrow(/Substituir/);
    await backup.restoreBackup(parsed, "replace");
    const again = await backup.exportBackup();
    expect(again.data).toEqual(data.data);
    // Identity sequences continue after restored ids.
    const cycle = (await cycles.getCurrentCycle())!;
    await sessions.createSession({ cycleId: cycle.id, sessionDate: "2026-09-10", status: "pending" });
  });

  it("rejects malformed backups", () => {
    expect(() => backup.parseBackup({ format: "x" })).toThrow(/inválido/);
  });
});
