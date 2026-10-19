import { describe, expect, it } from "vitest";
import {
  DEFAULT_CYCLE_LIMIT,
  checkSessionNumber,
  computeCycleProgress,
  currentCycle,
  nextCycleNumber,
  nextNumberInCycle,
  totalLimit,
} from "@/features/cycles/rules";

describe("cycle rules", () => {
  it("creates a cycle with 40 sessions by default", () => {
    expect(DEFAULT_CYCLE_LIMIT).toBe(40);
    const p = computeCycleProgress({ baseLimit: 40, bonusTotal: 0, completedCount: 10, pendingCount: 5 });
    expect(p.totalLimit).toBe(40);
    expect(p.registered).toBe(15);
    expect(p.available).toBe(25);
    expect(p.balance).toBe(30);
    expect(p.progress).toBeCloseTo(0.25);
    expect(p.isFull).toBe(false);
  });

  it("supports a custom limit", () => {
    const p = computeCycleProgress({ baseLimit: 20, bonusTotal: 0, completedCount: 20, pendingCount: 0 });
    expect(p.totalLimit).toBe(20);
    expect(p.isFull).toBe(true);
    expect(p.progress).toBe(1);
  });

  it("adds bonus sessions to the limit exactly once", () => {
    const bonuses = [{ quantity: 3 }];
    expect(totalLimit(40, bonuses)).toBe(43);
    // Computing again from the same source does not accumulate.
    expect(totalLimit(40, bonuses)).toBe(43);
    const p = computeCycleProgress({ baseLimit: 40, bonusTotal: 3, completedCount: 40, pendingCount: 0 });
    expect(p.totalLimit).toBe(43);
    expect(p.available).toBe(3);
  });

  it("numbers sessions independently of their status and restarts per cycle", () => {
    // Session 17 completed, 18 and 19 pending: next is 20.
    expect(nextNumberInCycle([17, 18, 19], 40)).toBe(20);
    // A brand-new cycle starts at 1, regardless of previous cycles.
    expect(nextNumberInCycle([], 40)).toBe(1);
  });

  it("returns null when the cycle is full and fills gaps first", () => {
    const full = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(nextNumberInCycle(full, 40)).toBeNull();
    expect(nextNumberInCycle(full, 43)).toBe(41);
    const withGap = full.filter((n) => n !== 7);
    expect(nextNumberInCycle(withGap, 40)).toBe(7);
  });

  it("rejects duplicate numbers in the same cycle and suggests the next free one", () => {
    expect(checkSessionNumber(18, [17, 18], 40)).toEqual({ ok: false, reason: "duplicate", suggestion: 19 });
    expect(checkSessionNumber(41, [1, 2], 40)).toMatchObject({ ok: false, reason: "over-limit" });
    expect(checkSessionNumber(0, [], 40)).toEqual({ ok: false, reason: "invalid" });
    expect(checkSessionNumber(19, [17, 18], 40)).toEqual({ ok: true });
  });

  it("preserves previous cycles when a new one is opened", () => {
    const cycles = [
      { cycleNumber: 1, baseLimit: 40 },
      { cycleNumber: 2, baseLimit: 40 },
    ];
    const snapshot = structuredClone(cycles);
    const next = { cycleNumber: nextCycleNumber(cycles), baseLimit: 30 };
    const all = [...cycles, next];
    expect(next.cycleNumber).toBe(3);
    expect(currentCycle(all)?.cycleNumber).toBe(3);
    expect(all.slice(0, 2)).toEqual(snapshot);
  });
});

describe("partial history", () => {
  it("treats numbers below the highest registered one as used", () => {
    // Imported sessions 35–41 (all completed) in a 40 + 3 cycle.
    const p = computeCycleProgress({
      baseLimit: 40,
      bonusTotal: 3,
      completedCount: 7,
      pendingCount: 0,
      maxNumber: 41,
      maxCompletedNumber: 41,
    });
    expect(p.used).toBe(41);
    expect(p.available).toBe(2);
    expect(p.balance).toBe(2);
    expect(p.progress).toBeCloseTo(41 / 43);
  });

  it("does not count pending numbers as done", () => {
    const p = computeCycleProgress({
      baseLimit: 40,
      bonusTotal: 0,
      completedCount: 6,
      pendingCount: 2,
      maxNumber: 19,
      maxCompletedNumber: 17,
    });
    expect(p.done).toBe(17);
    expect(p.used).toBe(19);
    expect(p.available).toBe(21);
    expect(p.balance).toBe(23);
  });
});
