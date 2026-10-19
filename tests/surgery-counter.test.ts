import { describe, expect, it } from "vitest";
import { computeSurgeryCounter, summarizeMilestones } from "@/features/surgery/counter";
import { addDays, diffInDays, todayIso, weekdayOf } from "@/lib/dates/calendar";

const MILESTONES = [30, 60, 90, 180, 365].map((days) => ({ days }));

describe("computeSurgeryCounter", () => {
  it("treats the surgery day as day 0 elapsed and day 1 of the post-op calendar", () => {
    const c = computeSurgeryCounter("2026-03-31", "2026-03-31", MILESTONES);
    expect(c.status).toBe("past");
    if (c.status !== "past") return;
    expect(c.elapsedDays).toBe(0);
    expect(c.postOpCalendarDay).toBe(1);
    expect(c.weeks).toBe(0);
    expect(c.remainingDaysInWeek).toBe(0);
  });

  it("counts one day after surgery", () => {
    const c = computeSurgeryCounter("2026-03-31", "2026-04-01", MILESTONES);
    expect(c.status === "past" && c.elapsedDays).toBe(1);
    expect(c.status === "past" && c.postOpCalendarDay).toBe(2);
  });

  it("computes many elapsed days, weeks and remaining days", () => {
    const c = computeSurgeryCounter("2026-03-31", "2026-10-19", MILESTONES);
    if (c.status !== "past") throw new Error("expected past");
    expect(c.elapsedDays).toBe(202);
    expect(c.weeks).toBe(28);
    expect(c.remainingDaysInWeek).toBe(6);
    expect(c.months).toBe(6);
    expect(c.remainingDaysInMonth).toBe(19);
  });

  it("handles leap years", () => {
    const c = computeSurgeryCounter("2028-02-28", "2028-03-01", MILESTONES);
    expect(c.status === "past" && c.elapsedDays).toBe(2);
    const n = computeSurgeryCounter("2027-02-28", "2027-03-01", MILESTONES);
    expect(n.status === "past" && n.elapsedDays).toBe(1);
    expect(diffInDays("2028-01-01", "2029-01-01")).toBe(366);
  });

  it("crosses month and year boundaries", () => {
    expect(diffInDays("2026-12-31", "2027-01-01")).toBe(1);
    const c = computeSurgeryCounter("2026-11-15", "2027-01-15", MILESTONES);
    expect(c.status === "past" && c.elapsedDays).toBe(61);
    expect(c.status === "past" && c.months).toBe(2);
  });

  it("shows days remaining when surgery is in the future", () => {
    const c = computeSurgeryCounter("2026-04-10", "2026-03-31", MILESTONES);
    expect(c.status).toBe("future");
    expect(c.status === "future" && c.daysUntil).toBe(10);
    expect(c.milestones.reached).toHaveLength(0);
  });

  it("recomputes everything when the surgery date changes", () => {
    const before = computeSurgeryCounter("2026-03-31", "2026-10-19", MILESTONES);
    const after = computeSurgeryCounter("2026-04-30", "2026-10-19", MILESTONES);
    expect(before.status === "past" && before.elapsedDays).toBe(202);
    expect(after.status === "past" && after.elapsedDays).toBe(172);
    expect(after.milestones.next?.days).toBe(180);
    expect(after.milestones.next?.date).toBe("2026-10-27");
  });

  it("is a pure function of the dates (no running counter)", () => {
    const a = computeSurgeryCounter("2026-03-31", "2026-06-01", MILESTONES);
    const b = computeSurgeryCounter("2026-03-31", "2026-06-01", MILESTONES);
    expect(a).toEqual(b);
  });
});

describe("milestones", () => {
  it("lists reached milestones, the next one and the days remaining", () => {
    const s = summarizeMilestones("2026-03-31", 202, MILESTONES);
    expect(s.reached.map((m) => m.days)).toEqual([30, 60, 90, 180]);
    expect(s.reached[0].date).toBe("2026-04-30");
    expect(s.next?.days).toBe(365);
    expect(s.next?.daysRemaining).toBe(163);
  });

  it("supports custom milestones, ignoring duplicates and invalid values", () => {
    const s = summarizeMilestones("2026-03-31", 202, [{ days: 210 }, { days: 210 }, { days: -3 }, { days: 100 }]);
    expect(s.all.map((m) => m.days)).toEqual([100, 210]);
    expect(s.next?.days).toBe(210);
    expect(s.next?.daysRemaining).toBe(8);
  });

  it("reports no next milestone after the last one", () => {
    const s = summarizeMilestones("2025-01-01", 400, MILESTONES);
    expect(s.next).toBeNull();
    expect(s.reached).toHaveLength(5);
  });

  it("marks a milestone reached exactly on its day", () => {
    const s = summarizeMilestones("2026-03-31", 30, MILESTONES);
    expect(s.reached.map((m) => m.days)).toEqual([30]);
  });
});

describe("timezone handling", () => {
  it("uses the local calendar date of the given timezone, not UTC", () => {
    // 02:30 UTC on Oct 20 is still Oct 19 in São Paulo (UTC-3).
    const instant = new Date("2026-10-20T02:30:00Z");
    expect(todayIso("America/Sao_Paulo", instant)).toBe("2026-10-19");
    expect(todayIso("UTC", instant)).toBe("2026-10-20");
    expect(todayIso("Asia/Tokyo", new Date("2026-10-19T16:00:00Z"))).toBe("2026-10-20");
  });

  it("date arithmetic is independent of the process timezone", () => {
    expect(addDays("2026-03-31", 1)).toBe("2026-04-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(weekdayOf("2026-10-19")).toBe(1); // Monday
    expect(weekdayOf("2026-03-31")).toBe(2); // Tuesday
  });
});
