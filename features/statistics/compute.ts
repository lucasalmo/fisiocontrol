/**
 * Descriptive statistics over the registered sessions. Only *completed
 * sessions* count as training activity; events are never mixed in. These are
 * frequency indicators, not clinical assessments.
 */

import {
  WEEKDAY_SHORT,
  addDays,
  diffInDays,
  monthKey,
  startOfWeek,
  weekdayOf,
  type IsoDate,
} from "@/lib/dates/calendar";

export type StatSession = {
  date: IsoDate;
  status: "pending" | "completed";
  categoryName: string | null;
  categoryColor: string | null;
  cycleNumber: number;
};

export const NO_CATEGORY = "Sem categoria";
const NO_CATEGORY_COLOR = "#94a3b8";

export type Statistics = {
  totals: { completed: number; pending: number; distinctDays: number };
  monthly: { month: string; completed: number; pending: number }[];
  weekly: { weekStart: IsoDate; completed: number; rollingAverage: number }[];
  byCategory: { name: string; color: string; count: number; share: number; lastDate: IsoDate }[];
  byWeekday: { weekday: string; index: number; completed: number }[];
  weekdayCategories: { weekday: string; top: { name: string; count: number; share: number }[]; total: number }[];
  categoryByMonth: { months: string[]; series: { name: string; color: string; values: number[] }[] };
  intervals: { averageDays: number | null; medianDays: number | null; longestGapDays: number | null };
  averagePerWeek: number | null;
  recentCategories: { name: string; color: string; lastDate: IsoDate }[];
  perCycle: { cycleNumber: number; completed: number; pending: number }[];
};

function monthRange(first: string, last: string): string[] {
  const out: string[] = [];
  let [y, m] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeStatistics(sessions: readonly StatSession[], options: { weeks?: number } = {}): Statistics {
  const completed = sessions.filter((s) => s.status === "completed").sort((a, b) => (a.date < b.date ? -1 : 1));
  const pending = sessions.filter((s) => s.status === "pending");
  const categoryOf = (s: StatSession) => s.categoryName ?? NO_CATEGORY;
  const colors = new Map<string, string>();
  for (const s of sessions) colors.set(categoryOf(s), s.categoryColor ?? NO_CATEGORY_COLOR);

  // Monthly (completed vs pending), continuous range.
  const allDates = sessions.map((s) => s.date).sort();
  const months = allDates.length ? monthRange(monthKey(allDates[0]), monthKey(allDates[allDates.length - 1])) : [];
  const monthly = months.map((month) => ({
    month,
    completed: completed.filter((s) => monthKey(s.date) === month).length,
    pending: pending.filter((s) => monthKey(s.date) === month).length,
  }));

  // Weekly completed counts with a 4-week rolling average.
  const weekly: Statistics["weekly"] = [];
  if (completed.length) {
    const firstWeek = startOfWeek(completed[0].date);
    const lastWeek = startOfWeek(completed[completed.length - 1].date);
    const counts = new Map<string, number>();
    for (const s of completed) counts.set(startOfWeek(s.date), (counts.get(startOfWeek(s.date)) ?? 0) + 1);
    for (let w = firstWeek; w <= lastWeek; w = addDays(w, 7)) {
      const value = counts.get(w) ?? 0;
      const window = [...weekly.slice(-3).map((x) => x.completed), value];
      weekly.push({
        weekStart: w,
        completed: value,
        rollingAverage: window.reduce((a, b) => a + b, 0) / window.length,
      });
    }
  }
  const weeklyLimited = options.weeks ? weekly.slice(-options.weeks) : weekly;

  // Categories.
  const catCounts = new Map<string, { count: number; lastDate: IsoDate }>();
  for (const s of completed) {
    const name = categoryOf(s);
    const cur = catCounts.get(name);
    catCounts.set(name, { count: (cur?.count ?? 0) + 1, lastDate: !cur || s.date > cur.lastDate ? s.date : cur.lastDate });
  }
  const byCategory = [...catCounts.entries()]
    .map(([name, v]) => ({
      name,
      color: colors.get(name) ?? NO_CATEGORY_COLOR,
      count: v.count,
      share: completed.length ? v.count / completed.length : 0,
      lastDate: v.lastDate,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));

  const recentCategories = byCategory
    .filter((c) => c.name !== NO_CATEGORY)
    .map(({ name, color, lastDate }) => ({ name, color, lastDate }))
    .sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1))
    .slice(0, 6);

  // Weekday distribution (Monday first) and observed categories per weekday.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const byWeekday = order.map((index) => ({
    weekday: WEEKDAY_SHORT[index],
    index,
    completed: completed.filter((s) => weekdayOf(s.date) === index).length,
  }));
  const weekdayCategories = order.map((index) => {
    const day = completed.filter((s) => weekdayOf(s.date) === index);
    const counts = new Map<string, number>();
    for (const s of day) counts.set(categoryOf(s), (counts.get(categoryOf(s)) ?? 0) + 1);
    return {
      weekday: WEEKDAY_SHORT[index],
      total: day.length,
      top: [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count, share: count / day.length })),
    };
  });

  // Category × month (completed).
  const completedMonths = completed.length
    ? monthRange(monthKey(completed[0].date), monthKey(completed[completed.length - 1].date))
    : [];
  const categoryByMonth = {
    months: completedMonths,
    series: byCategory.map((c) => ({
      name: c.name,
      color: c.color,
      values: completedMonths.map((m) => completed.filter((s) => categoryOf(s) === c.name && monthKey(s.date) === m).length),
    })),
  };

  // Intervals between distinct completed days.
  const days = [...new Set(completed.map((s) => s.date))].sort();
  const gaps = days.slice(1).map((d, i) => diffInDays(days[i], d));
  const intervals = {
    averageDays: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null,
    medianDays: median(gaps),
    longestGapDays: gaps.length ? Math.max(...gaps) : null,
  };
  const spanWeeks = days.length > 1 ? (diffInDays(days[0], days[days.length - 1]) + 1) / 7 : null;
  const averagePerWeek = spanWeeks ? completed.length / spanWeeks : null;

  // Per cycle.
  const cycles = new Map<number, { completed: number; pending: number }>();
  for (const s of sessions) {
    const c = cycles.get(s.cycleNumber) ?? { completed: 0, pending: 0 };
    c[s.status] += 1;
    cycles.set(s.cycleNumber, c);
  }
  const perCycle = [...cycles.entries()].sort((a, b) => a[0] - b[0]).map(([cycleNumber, v]) => ({ cycleNumber, ...v }));

  return {
    totals: { completed: completed.length, pending: pending.length, distinctDays: days.length },
    monthly,
    weekly: weeklyLimited,
    byCategory,
    byWeekday,
    weekdayCategories,
    categoryByMonth,
    intervals,
    averagePerWeek,
    recentCategories,
    perCycle,
  };
}
