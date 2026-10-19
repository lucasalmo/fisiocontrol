import { describe, expect, it } from "vitest";
import { NO_CATEGORY, computeStatistics, type StatSession } from "@/features/statistics/compute";

const s = (date: string, status: "completed" | "pending", categoryName: string | null = null, cycleNumber = 1): StatSession => ({
  date,
  status,
  categoryName,
  categoryColor: categoryName ? "#ff0000" : null,
  cycleNumber,
});

describe("computeStatistics", () => {
  const data = [
    s("2026-08-03", "completed", "Habilidade"), // Mon
    s("2026-08-05", "completed", "Intensidade"), // Wed
    s("2026-08-10", "completed", "Habilidade"), // Mon
    s("2026-09-02", "completed", null, 2), // Wed
    s("2026-09-04", "pending", "Volume", 2),
  ];
  const stats = computeStatistics(data);

  it("counts only completed sessions as activity", () => {
    expect(stats.totals).toEqual({ completed: 4, pending: 1, distinctDays: 4 });
    expect(stats.byCategory.reduce((n, c) => n + c.count, 0)).toBe(4);
  });

  it("builds a continuous monthly series", () => {
    expect(stats.monthly).toEqual([
      { month: "2026-08", completed: 3, pending: 0 },
      { month: "2026-09", completed: 1, pending: 1 },
    ]);
  });

  it("ranks categories and includes sessions without category", () => {
    expect(stats.byCategory[0]).toMatchObject({ name: "Habilidade", count: 2, share: 0.5, lastDate: "2026-08-10" });
    expect(stats.byCategory.some((c) => c.name === NO_CATEGORY)).toBe(true);
  });

  it("distributes by weekday starting on Monday", () => {
    expect(stats.byWeekday[0]).toMatchObject({ weekday: "Seg", completed: 2 });
    expect(stats.byWeekday[2]).toMatchObject({ weekday: "Qua", completed: 2 });
    expect(stats.weekdayCategories[0].top[0]).toMatchObject({ name: "Habilidade", count: 2, share: 1 });
  });

  it("computes intervals between completed sessions", () => {
    // Gaps: 2, 5, 23 days.
    expect(stats.intervals.averageDays).toBeCloseTo(10);
    expect(stats.intervals.medianDays).toBe(5);
    expect(stats.intervals.longestGapDays).toBe(23);
  });

  it("builds weekly series with empty weeks", () => {
    expect(stats.weekly[0]).toMatchObject({ weekStart: "2026-08-03", completed: 2 });
    expect(stats.weekly.find((w) => w.weekStart === "2026-08-17")?.completed).toBe(0);
  });

  it("groups by cycle", () => {
    expect(stats.perCycle).toEqual([
      { cycleNumber: 1, completed: 3, pending: 0 },
      { cycleNumber: 2, completed: 1, pending: 1 },
    ]);
  });

  it("handles no data", () => {
    const empty = computeStatistics([]);
    expect(empty.totals.completed).toBe(0);
    expect(empty.intervals.averageDays).toBeNull();
    expect(empty.monthly).toEqual([]);
  });
});
