import "server-only";
import { db, withTransaction, type Queryable } from "../client";
import { UserFacingError } from "../errors";
import { checkSessionNumber } from "@/features/cycles/rules";
import type { Session, SessionStatus } from "@/types/domain";
import type { SessionFilters, SessionInput } from "@/lib/validation/schemas";

type SessionRow = {
  id: number;
  cycle_id: number;
  cycle_number: number;
  number_in_cycle: number;
  global_number: number | null;
  session_date: string;
  status: SessionStatus;
  completed_at: string | null;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function map(r: SessionRow): Session {
  return {
    id: r.id,
    cycleId: r.cycle_id,
    cycleNumber: r.cycle_number,
    numberInCycle: r.number_in_cycle,
    globalNumber: r.global_number,
    sessionDate: r.session_date,
    status: r.status,
    completedAt: r.completed_at,
    categoryId: r.category_id,
    categoryName: r.category_name,
    categoryColor: r.category_color,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_SESSIONS = `
  SELECT s.id, s.cycle_id, c.cycle_number, s.number_in_cycle, s.global_number, s.session_date,
         s.status, s.completed_at, s.category_id, cat.name AS category_name, cat.color AS category_color,
         s.notes, s.created_at, s.updated_at
    FROM sessions s
    JOIN payment_cycles c ON c.id = s.cycle_id
    LEFT JOIN session_categories cat ON cat.id = s.category_id`;

export const SESSIONS_PAGE_SIZE = 50;

export async function listSessions(filters: SessionFilters = {}): Promise<{ items: Session[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    params.push(term);
    const p = `$${params.length}`;
    const numeric = /^\d+$/.test(filters.q) ? ` OR s.number_in_cycle = ${Number(filters.q)} OR s.global_number = ${Number(filters.q)}` : "";
    where.push(`(s.notes ILIKE ${p} OR cat.name ILIKE ${p} OR to_char(s.session_date, 'DD/MM/YYYY') LIKE ${p}${numeric})`);
  }
  if (filters.status) add(`s.status = ?`, filters.status);
  if (filters.category === "none") where.push(`s.category_id IS NULL`);
  else if (filters.category) add(`s.category_id = ?`, filters.category);
  if (filters.cycle) add(`s.cycle_id = ?`, filters.cycle);
  if (filters.from) add(`s.session_date >= ?`, filters.from);
  if (filters.to) add(`s.session_date <= ?`, filters.to);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const direction = filters.sort === "asc" ? "ASC" : "DESC";
  const page = filters.page ?? 1;
  const [{ rows }, count] = await Promise.all([
    db.query<SessionRow>(
      `${SELECT_SESSIONS} ${whereSql}
       ORDER BY s.session_date ${direction}, c.cycle_number ${direction}, s.number_in_cycle ${direction}
       LIMIT ${SESSIONS_PAGE_SIZE} OFFSET ${(page - 1) * SESSIONS_PAGE_SIZE}`,
      params,
    ),
    db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM sessions s LEFT JOIN session_categories cat ON cat.id = s.category_id ${whereSql}`,
      params,
    ),
  ]);
  return { items: rows.map(map), total: count.rows[0].total };
}

export async function getSession(id: number, tx: Queryable = db): Promise<Session | null> {
  const { rows } = await tx.query<SessionRow>(`${SELECT_SESSIONS} WHERE s.id = $1`, [id]);
  return rows[0] ? map(rows[0]) : null;
}

export async function listSessionsBetween(from: string, to: string): Promise<Session[]> {
  const { rows } = await db.query<SessionRow>(
    `${SELECT_SESSIONS} WHERE s.session_date BETWEEN $1 AND $2 ORDER BY s.session_date, s.number_in_cycle`,
    [from, to],
  );
  return rows.map(map);
}

export async function listUpcomingSessions(today: string, limit: number): Promise<Session[]> {
  const { rows } = await db.query<SessionRow>(
    `${SELECT_SESSIONS} WHERE s.status = 'pending' AND s.session_date >= $1
     ORDER BY s.session_date, s.number_in_cycle LIMIT $2`,
    [today, limit],
  );
  return rows.map(map);
}

export async function listRecentCompleted(limit: number): Promise<Session[]> {
  const { rows } = await db.query<SessionRow>(
    `${SELECT_SESSIONS} WHERE s.status = 'completed'
     ORDER BY s.session_date DESC, s.number_in_cycle DESC LIMIT $1`,
    [limit],
  );
  return rows.map(map);
}

export async function listOverduePending(today: string): Promise<Session[]> {
  const { rows } = await db.query<SessionRow>(
    `${SELECT_SESSIONS} WHERE s.status = 'pending' AND s.session_date < $1 ORDER BY s.session_date`,
    [today],
  );
  return rows.map(map);
}

/** Raised when the chosen number collides; carries a suggestion for the UI. */
export class SessionNumberError extends UserFacingError {
  constructor(
    message: string,
    public suggestion: number | null,
  ) {
    super(message);
  }
}

async function lockCycleForSessions(tx: Queryable, cycleId: number) {
  const { rows } = await tx.query<{ base_limit: number; cycle_number: number }>(
    `SELECT base_limit, cycle_number FROM payment_cycles WHERE id = $1 FOR UPDATE`,
    [cycleId],
  );
  if (!rows[0]) throw new UserFacingError("Ciclo não encontrado.");
  const bonus = await tx.query<{ total: number }>(
    `SELECT COALESCE(SUM(quantity), 0)::int AS total FROM bonuses WHERE cycle_id = $1`,
    [cycleId],
  );
  return { limit: rows[0].base_limit + bonus.rows[0].total, cycleNumber: rows[0].cycle_number };
}

async function numbersInCycle(tx: Queryable, cycleId: number, excludeId?: number) {
  const { rows } = await tx.query<{ n: number }>(
    `SELECT number_in_cycle AS n FROM sessions WHERE cycle_id = $1 AND ($2::bigint IS NULL OR id <> $2)`,
    [cycleId, excludeId ?? null],
  );
  return rows.map((r) => r.n);
}

/** Resolves and validates the number of a session inside a locked cycle. */
async function resolveNumber(tx: Queryable, cycleId: number, requested: number | undefined, excludeId?: number) {
  const { limit, cycleNumber } = await lockCycleForSessions(tx, cycleId);
  const existing = await numbersInCycle(tx, cycleId, excludeId);
  const free = existing.length ? Math.max(...existing) + 1 : 1;
  const number = requested ?? free;
  const check = checkSessionNumber(number, existing, limit);
  if (!check.ok) {
    if (check.reason === "duplicate") {
      throw new SessionNumberError(`A sessão ${number} já existe no ciclo ${cycleNumber}.`, check.suggestion);
    }
    if (check.reason === "over-limit") {
      throw new SessionNumberError(
        check.suggestion === null
          ? `O ciclo ${cycleNumber} está completo (${limit} sessões). Registre um novo pagamento ou um bônus.`
          : `A sessão ${number} ultrapassa o limite do ciclo ${cycleNumber} (${limit} sessões).`,
        check.suggestion,
      );
    }
    throw new UserFacingError("Número de sessão inválido.");
  }
  return number;
}

/** Global numbers are assigned once, sequentially, and never renumbered. */
export async function nextGlobalNumber(tx: Queryable): Promise<number> {
  await tx.query(`SELECT pg_advisory_xact_lock(727202)`);
  const { rows } = await tx.query<{ next: number }>(
    `SELECT COALESCE(MAX(global_number), 0)::int + 1 AS next FROM sessions`,
  );
  return rows[0].next;
}

export async function insertSession(
  tx: Queryable,
  input: SessionInput & { numberInCycle: number },
  importKey: string | null = null,
): Promise<number> {
  const globalNumber = await nextGlobalNumber(tx);
  const { rows } = await tx.query<{ id: number }>(
    `INSERT INTO sessions (cycle_id, number_in_cycle, global_number, session_date, status, completed_at,
                           category_id, notes, import_key)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 = 'completed' THEN now() END, $6, $7, $8)
     RETURNING id`,
    [
      input.cycleId,
      input.numberInCycle,
      globalNumber,
      input.sessionDate,
      input.status,
      input.categoryId ?? null,
      input.notes ?? null,
      importKey,
    ],
  );
  return rows[0].id;
}

export async function createSession(input: SessionInput): Promise<number> {
  return withTransaction(async (tx) => {
    const numberInCycle = await resolveNumber(tx, input.cycleId, input.numberInCycle);
    return insertSession(tx, { ...input, numberInCycle });
  });
}

export async function updateSession(id: number, input: SessionInput): Promise<void> {
  await withTransaction(async (tx) => {
    const current = await getSession(id, tx);
    if (!current) throw new UserFacingError("Sessão não encontrada.");
    let numberInCycle = current.numberInCycle;
    const requested = input.numberInCycle ?? current.numberInCycle;
    if (input.cycleId !== current.cycleId || requested !== current.numberInCycle) {
      numberInCycle = await resolveNumber(
        tx,
        input.cycleId,
        input.cycleId !== current.cycleId ? input.numberInCycle : requested,
        id,
      );
    }
    await tx.query(
      `UPDATE sessions
          SET cycle_id = $2, number_in_cycle = $3, session_date = $4, status = $5,
              completed_at = CASE WHEN $5 = 'pending' THEN NULL ELSE COALESCE(completed_at, now()) END,
              category_id = $6, notes = $7
        WHERE id = $1`,
      [id, input.cycleId, numberInCycle, input.sessionDate, input.status, input.categoryId ?? null, input.notes ?? null],
    );
  });
}

/** One-click complete / reopen. */
export async function setSessionStatus(id: number, status: SessionStatus): Promise<void> {
  const { rowCount } = await db.query(
    `UPDATE sessions
        SET status = $2,
            completed_at = CASE WHEN $2 = 'completed' THEN COALESCE(completed_at, now()) ELSE NULL END
      WHERE id = $1`,
    [id, status],
  );
  if (!rowCount) throw new UserFacingError("Sessão não encontrada.");
}

export async function deleteSession(id: number): Promise<void> {
  const { rowCount } = await db.query(`DELETE FROM sessions WHERE id = $1`, [id]);
  if (!rowCount) throw new UserFacingError("Sessão não encontrada.");
}
