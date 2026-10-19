import {
  addDays,
  diffInDays,
  diffInMonthsAndDays,
  type IsoDate,
} from "@/lib/dates/calendar";

export const DEFAULT_MILESTONES = [30, 60, 90, 180, 365] as const;

export type Milestone = { days: number; label?: string | null };

export type ReachedMilestone = Milestone & { date: IsoDate };

export type SurgeryCounter =
  | {
      status: "future";
      surgeryDate: IsoDate;
      today: IsoDate;
      /** Days until the surgery day. */
      daysUntil: number;
      milestones: MilestoneSummary;
    }
  | {
      status: "past";
      surgeryDate: IsoDate;
      today: IsoDate;
      /** Complete days elapsed; the surgery day itself is day 0. */
      elapsedDays: number;
      /** Inclusive calendar count: the surgery day is day 1 of the post-op calendar. */
      postOpCalendarDay: number;
      weeks: number;
      remainingDaysInWeek: number;
      months: number;
      remainingDaysInMonth: number;
      milestones: MilestoneSummary;
    };

export type MilestoneSummary = {
  reached: ReachedMilestone[];
  next: (ReachedMilestone & { daysRemaining: number; progress: number }) | null;
  all: (ReachedMilestone & { reached: boolean })[];
};

function normalizeMilestones(milestones: readonly Milestone[]): Milestone[] {
  const byDays = new Map<number, Milestone>();
  for (const m of milestones) {
    if (Number.isInteger(m.days) && m.days > 0 && !byDays.has(m.days)) byDays.set(m.days, m);
  }
  return [...byDays.values()].sort((a, b) => a.days - b.days);
}

export function summarizeMilestones(
  surgeryDate: IsoDate,
  elapsedDays: number,
  milestones: readonly Milestone[],
): MilestoneSummary {
  const sorted = normalizeMilestones(milestones);
  const all = sorted.map((m) => ({
    ...m,
    date: addDays(surgeryDate, m.days),
    reached: elapsedDays >= m.days,
  }));
  const reached = all.filter((m) => m.reached).map((m) => ({ days: m.days, label: m.label, date: m.date }));
  const upcoming = all.find((m) => !m.reached);
  let next: MilestoneSummary["next"] = null;
  if (upcoming) {
    const previousDays = reached.length ? reached[reached.length - 1].days : 0;
    const span = upcoming.days - previousDays;
    const done = Math.max(0, elapsedDays - previousDays);
    next = {
      days: upcoming.days,
      label: upcoming.label,
      date: upcoming.date,
      daysRemaining: upcoming.days - Math.max(0, elapsedDays),
      progress: span > 0 ? Math.min(1, done / span) : 0,
    };
  }
  return { reached, next, all };
}

/**
 * Computes every surgery-related indicator from two calendar dates. It never
 * relies on a running timer: call it again whenever "today" changes.
 */
export function computeSurgeryCounter(
  surgeryDate: IsoDate,
  today: IsoDate,
  milestones: readonly Milestone[] = DEFAULT_MILESTONES.map((days) => ({ days })),
): SurgeryCounter {
  const elapsed = diffInDays(surgeryDate, today);
  if (elapsed < 0) {
    return {
      status: "future",
      surgeryDate,
      today,
      daysUntil: -elapsed,
      milestones: summarizeMilestones(surgeryDate, elapsed, milestones),
    };
  }
  const { months, days } = diffInMonthsAndDays(surgeryDate, today);
  return {
    status: "past",
    surgeryDate,
    today,
    elapsedDays: elapsed,
    postOpCalendarDay: elapsed + 1,
    weeks: Math.floor(elapsed / 7),
    remainingDaysInWeek: elapsed % 7,
    months,
    remainingDaysInMonth: days,
    milestones: summarizeMilestones(surgeryDate, elapsed, milestones),
  };
}
