import "server-only";
import { db, withTransaction, type Queryable } from "../client";
import { UserFacingError } from "../errors";
import type { Bonus, Cycle } from "@/types/domain";
import type { BonusInput, CycleUpdate, PaymentInput } from "@/lib/validation/schemas";

type CycleRow = {
  id: number;
  cycle_number: number;
  payment_date: string | null;
  start_date: string | null;
  base_limit: number;
  bonus_total: number;
  total_limit: number;
  completed_count: number;
  pending_count: number;
  max_number: number;
  max_completed_number: number;
  extra_allowance: number;
  max_allowed: number;
  first_session_date: string | null;
  last_session_date: string | null;
  notes: string | null;
  created_at: string;
};

function mapCycle(r: CycleRow): Cycle {
  return {
    id: r.id,
    cycleNumber: r.cycle_number,
    paymentDate: r.payment_date,
    startDate: r.start_date,
    baseLimit: r.base_limit,
    bonusTotal: r.bonus_total,
    totalLimit: r.total_limit,
    completedCount: r.completed_count,
    pendingCount: r.pending_count,
    maxNumber: r.max_number,
    maxCompletedNumber: r.max_completed_number,
    extraAllowance: r.extra_allowance,
    maxAllowed: r.max_allowed,
    firstSessionDate: r.first_session_date,
    lastSessionDate: r.last_session_date,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

const CYCLE_COLUMNS = `id, cycle_number, payment_date, start_date, base_limit, bonus_total, total_limit,
  completed_count, pending_count, max_number, max_completed_number, extra_allowance, max_allowed, first_session_date, last_session_date, notes, created_at`;

export async function listCycles(tx: Queryable = db): Promise<Cycle[]> {
  const { rows } = await tx.query<CycleRow>(`SELECT ${CYCLE_COLUMNS} FROM cycle_overview ORDER BY cycle_number`);
  return rows.map(mapCycle);
}

export async function getCycle(id: number, tx: Queryable = db): Promise<Cycle | null> {
  const { rows } = await tx.query<CycleRow>(`SELECT ${CYCLE_COLUMNS} FROM cycle_overview WHERE id = $1`, [id]);
  return rows[0] ? mapCycle(rows[0]) : null;
}

export async function getCurrentCycle(tx: Queryable = db): Promise<Cycle | null> {
  const { rows } = await tx.query<CycleRow>(
    `SELECT ${CYCLE_COLUMNS} FROM cycle_overview ORDER BY cycle_number DESC LIMIT 1`,
  );
  return rows[0] ? mapCycle(rows[0]) : null;
}

/** Serializes cycle creation so two payments can never get the same number. */
export async function lockCycles(tx: Queryable) {
  await tx.query(`SELECT pg_advisory_xact_lock(727201)`);
}

/** Inserts a new cycle with the next number. Must run inside a transaction. */
export async function insertCycle(
  tx: Queryable,
  input: {
    paymentDate: string | null;
    startDate: string | null;
    baseLimit: number;
    notes: string | null;
    /** Omitted: uses the default from settings. */
    extraAllowance?: number;
  },
): Promise<{ id: number; cycleNumber: number }> {
  await lockCycles(tx);
  const { rows } = await tx.query<{ id: number; cycle_number: number }>(
    `INSERT INTO payment_cycles (cycle_number, payment_date, start_date, base_limit, notes, extra_allowance)
     SELECT COALESCE(MAX(cycle_number), 0) + 1, $1, $2, $3, $4,
            COALESCE($5::int, (SELECT default_extra_allowance FROM app_settings WHERE id = 1), 3)
       FROM payment_cycles
     RETURNING id, cycle_number`,
    [input.paymentDate, input.startDate, input.baseLimit, input.notes, input.extraAllowance ?? null],
  );
  return { id: rows[0].id, cycleNumber: rows[0].cycle_number };
}

/**
 * Registers a payment: opens a new cycle in one transaction. Previous cycles
 * and their sessions are left untouched.
 */
export async function registerPayment(input: PaymentInput) {
  return withTransaction((tx) =>
    insertCycle(tx, {
      paymentDate: input.paymentDate,
      startDate: input.startDate ?? null,
      baseLimit: input.baseLimit,
      notes: input.notes ?? null,
      extraAllowance: input.extraAllowance,
    }),
  );
}

export async function updateCycle(input: CycleUpdate) {
  // The database trigger refuses a limit lower than the highest session number.
  const { rowCount } = await db.query(
    `UPDATE payment_cycles
        SET payment_date = $2, start_date = $3, base_limit = $4, notes = $5, extra_allowance = $6
      WHERE id = $1`,
    [input.id, input.paymentDate ?? null, input.startDate ?? null, input.baseLimit, input.notes ?? null, input.extraAllowance],
  );
  if (!rowCount) throw new UserFacingError("Ciclo não encontrado.");
}

/** Only empty cycles (no sessions, no bonuses) can be deleted. */
export async function deleteCycle(id: number) {
  await withTransaction(async (tx) => {
    const { rows } = await tx.query<{ sessions: number; bonuses: number }>(
      `SELECT (SELECT COUNT(*) FROM sessions WHERE cycle_id = $1)::int AS sessions,
              (SELECT COUNT(*) FROM bonuses WHERE cycle_id = $1)::int AS bonuses`,
      [id],
    );
    if (rows[0].sessions || rows[0].bonuses) {
      throw new UserFacingError("Só é possível excluir ciclos sem sessões e sem bônus.");
    }
    await tx.query(`DELETE FROM payment_cycles WHERE id = $1`, [id]);
  });
}

// ---------------------------------------------------------------------------
// Bonuses
// ---------------------------------------------------------------------------

type BonusRow = {
  id: number;
  cycle_id: number;
  cycle_number: number;
  quantity: number;
  granted_on: string;
  reason: string;
  notes: string | null;
  created_at: string;
};

function mapBonus(r: BonusRow): Bonus {
  return {
    id: r.id,
    cycleId: r.cycle_id,
    cycleNumber: r.cycle_number,
    quantity: r.quantity,
    grantedOn: r.granted_on,
    reason: r.reason,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

export async function listBonuses(tx: Queryable = db): Promise<Bonus[]> {
  const { rows } = await tx.query<BonusRow>(
    `SELECT b.id, b.cycle_id, c.cycle_number, b.quantity, b.granted_on, b.reason, b.notes, b.created_at
       FROM bonuses b JOIN payment_cycles c ON c.id = b.cycle_id
      ORDER BY b.granted_on DESC, b.id DESC`,
  );
  return rows.map(mapBonus);
}

/**
 * Each bonus is a single row; the cycle limit is always derived from the sum
 * of its rows, so a bonus is counted exactly once.
 */
export async function createBonus(input: BonusInput, tx: Queryable = db, importKey: string | null = null) {
  const { rows } = await tx.query<{ id: number }>(
    `INSERT INTO bonuses (cycle_id, quantity, granted_on, reason, notes, import_key)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.cycleId, input.quantity, input.grantedOn, input.reason, input.notes ?? null, importKey],
  );
  return rows[0].id;
}

export async function deleteBonus(id: number) {
  // Trigger refuses the delete if sessions already use the extra slots.
  await db.query(`DELETE FROM bonuses WHERE id = $1`, [id]);
}
