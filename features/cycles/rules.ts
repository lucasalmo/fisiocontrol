/**
 * Pure business rules for payment cycles and session numbering.
 * The database enforces the same invariants (unique number per cycle, limit
 * trigger); these functions give early, friendly feedback and drive the UI.
 */

export const DEFAULT_CYCLE_LIMIT = 40;

export type CycleCounts = {
  baseLimit: number;
  bonusTotal: number;
  completedCount: number;
  pendingCount: number;
  /** Highest session number registered (any status). */
  maxNumber?: number;
  /** Highest completed session number. */
  maxCompletedNumber?: number;
};

export type CycleProgress = {
  totalLimit: number;
  completed: number;
  pending: number;
  /** Sessions registered (completed + pending). */
  registered: number;
  /** Slots in use; numbers are positional, so the highest number counts. */
  used: number;
  /** Sessions considered done (count or highest completed number). */
  done: number;
  /** Slots not yet used: can still be scheduled. */
  available: number;
  /** Paid sessions not yet performed: total - done. */
  balance: number;
  /** Done / total, 0..1. */
  progress: number;
  isFull: boolean;
};

export function totalLimit(baseLimit: number, bonuses: readonly { quantity: number }[]): number {
  return baseLimit + bonuses.reduce((sum, b) => sum + b.quantity, 0);
}

export function computeCycleProgress(c: CycleCounts): CycleProgress {
  const total = c.baseLimit + c.bonusTotal;
  const registered = c.completedCount + c.pendingCount;
  // A history imported from the middle of a cycle (e.g. sessions 35–41) still
  // used slots 1–34, so the highest number wins over the count.
  const used = Math.max(registered, c.maxNumber ?? 0);
  const done = Math.max(c.completedCount, c.maxCompletedNumber ?? 0);
  return {
    totalLimit: total,
    completed: c.completedCount,
    pending: c.pendingCount,
    registered,
    used,
    done,
    available: Math.max(0, total - used),
    balance: Math.max(0, total - done),
    progress: total > 0 ? Math.min(1, done / total) : 0,
    isFull: used >= total,
  };
}

/** Next number for a new session: highest existing + 1, or null if the cycle is full. */
export function nextNumberInCycle(existingNumbers: readonly number[], limit: number): number | null {
  const next = existingNumbers.length ? Math.max(...existingNumbers) + 1 : 1;
  if (next <= limit) return next;
  // Fill a gap left by a deleted session before declaring the cycle full.
  const used = new Set(existingNumbers);
  for (let n = 1; n <= limit; n++) if (!used.has(n)) return n;
  return null;
}

export type NumberCheck =
  | { ok: true }
  | { ok: false; reason: "duplicate"; suggestion: number | null }
  | { ok: false; reason: "over-limit"; suggestion: number | null }
  | { ok: false; reason: "invalid" };

export function checkSessionNumber(
  number: number,
  existingNumbers: readonly number[],
  limit: number,
): NumberCheck {
  if (!Number.isInteger(number) || number < 1) return { ok: false, reason: "invalid" };
  const suggestion = nextNumberInCycle(existingNumbers, limit);
  if (number > limit) return { ok: false, reason: "over-limit", suggestion };
  if (existingNumbers.includes(number)) return { ok: false, reason: "duplicate", suggestion };
  return { ok: true };
}

/** The current cycle is the one with the highest cycle number. */
export function currentCycle<T extends { cycleNumber: number }>(cycles: readonly T[]): T | null {
  return cycles.reduce<T | null>((cur, c) => (!cur || c.cycleNumber > cur.cycleNumber ? c : cur), null);
}

export function nextCycleNumber(cycles: readonly { cycleNumber: number }[]): number {
  return cycles.reduce((max, c) => Math.max(max, c.cycleNumber), 0) + 1;
}
