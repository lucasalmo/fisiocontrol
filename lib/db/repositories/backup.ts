import "server-only";
import { z } from "zod";
import { db, withTransaction, type Queryable } from "../client";
import { UserFacingError } from "../errors";
import { isIsoDate } from "@/lib/dates/calendar";

export const BACKUP_FORMAT = "fisiocontrol-backup";
export const BACKUP_VERSION = 1;

const date = z.string().refine(isIsoDate, "data inválida");
const nullableDate = date.nullable();
const ts = z.string().min(1);
const id = z.number().int().positive();

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  data: z.object({
    session_categories: z.array(
      z.object({
        id,
        name: z.string().min(1),
        normalized_name: z.string().min(1),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        active: z.boolean(),
        created_at: ts,
        updated_at: ts,
      }),
    ),
    payment_cycles: z.array(
      z.object({
        id,
        cycle_number: z.number().int().positive(),
        payment_date: nullableDate,
        start_date: nullableDate,
        base_limit: z.number().int().positive(),
        notes: z.string().nullable(),
        created_at: ts,
        updated_at: ts,
      }),
    ),
    bonuses: z.array(
      z.object({
        id,
        cycle_id: id,
        quantity: z.number().int().positive(),
        granted_on: date,
        reason: z.string().min(1),
        notes: z.string().nullable(),
        import_key: z.string().nullable(),
        created_at: ts,
        updated_at: ts,
      }),
    ),
    sessions: z.array(
      z.object({
        id,
        cycle_id: id,
        number_in_cycle: z.number().int().positive(),
        global_number: z.number().int().positive().nullable(),
        session_date: date,
        status: z.enum(["pending", "completed"]),
        completed_at: z.string().nullable(),
        category_id: id.nullable(),
        notes: z.string().nullable(),
        import_key: z.string().nullable(),
        created_at: ts,
        updated_at: ts,
      }),
    ),
    events: z.array(
      z.object({
        id,
        title: z.string().min(1),
        type: z.enum(["surgery", "holiday", "pause", "resume", "custom"]),
        event_date: date,
        description: z.string().nullable(),
        import_key: z.string().nullable(),
        created_at: ts,
        updated_at: ts,
      }),
    ),
    milestones: z.array(z.object({ id, days: z.number().int().positive(), label: z.string().nullable(), created_at: ts })),
    app_settings: z.array(
      z.object({
        id: z.literal(1),
        surgery_event_id: id.nullable(),
        default_cycle_limit: z.number().int().positive(),
        time_zone: z.string().min(1),
        updated_at: ts,
      }),
    ),
  }),
});
export type Backup = z.infer<typeof backupSchema>;

// Insert order respects foreign keys; delete order is the reverse.
const TABLES = [
  "session_categories",
  "payment_cycles",
  "bonuses",
  "sessions",
  "events",
  "milestones",
  "app_settings",
] as const;

export async function exportBackup(): Promise<Backup> {
  const data: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const { rows } = await db.query(`SELECT * FROM ${table} ORDER BY id`);
    data[table] = rows;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: data as Backup["data"],
  };
}

export function parseBackup(json: unknown): Backup {
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new UserFacingError(`Arquivo de backup inválido (${issue.path.join(".") || "raiz"}: ${issue.message}).`);
  }
  return result.data;
}

async function insertRows(tx: Queryable, table: string, rows: Record<string, unknown>[]) {
  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    await tx.query(
      `INSERT INTO ${table} (${columns.join(", ")}) OVERRIDING SYSTEM VALUE VALUES (${placeholders.join(", ")})`,
      columns.map((c) => row[c]),
    );
  }
  if (table !== "app_settings") {
    await tx.query(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${table}`,
    );
  }
}

export async function countTreatmentData(tx: Queryable = db) {
  const { rows } = await tx.query<{ sessions: number; cycles: number; bonuses: number; events: number }>(
    `SELECT (SELECT COUNT(*) FROM sessions)::int AS sessions,
            (SELECT COUNT(*) FROM payment_cycles)::int AS cycles,
            (SELECT COUNT(*) FROM bonuses)::int AS bonuses,
            (SELECT COUNT(*) FROM events)::int AS events`,
  );
  return rows[0];
}

/**
 * Restores a backup.
 * - "empty": only allowed when there are no sessions/cycles/bonuses; existing
 *   defaults (categories, milestones, surgery) are replaced by the backup's.
 * - "replace": wipes all treatment data first. Requires explicit confirmation
 *   in the UI.
 */
export async function restoreBackup(backup: Backup, mode: "empty" | "replace") {
  await withTransaction(async (tx) => {
    const counts = await countTreatmentData(tx);
    if (mode === "empty" && (counts.sessions || counts.cycles || counts.bonuses)) {
      throw new UserFacingError(
        "O banco já possui sessões ou ciclos. Use “Substituir todos os dados” com confirmação explícita.",
      );
    }
    for (const table of [...TABLES].reverse()) await tx.query(`DELETE FROM ${table}`);
    for (const table of TABLES) {
      await insertRows(tx, table, backup.data[table] as unknown as Record<string, unknown>[]);
    }
  });
}
