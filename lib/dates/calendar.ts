/**
 * Calendar-date helpers.
 *
 * Calendar dates (surgery, sessions, events) are represented everywhere as
 * ISO strings `YYYY-MM-DD`, matching PostgreSQL `DATE`. All arithmetic is done
 * on integer "day numbers" computed with `Date.UTC`, so no time-of-day or
 * timezone offset can shift a date by one day.
 */

export type IsoDate = string;

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const m = ISO_DATE_RE.exec(value);
  return !!m && isValidDateParts(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function parseIsoDate(value: IsoDate): { year: number; month: number; day: number } {
  const m = ISO_DATE_RE.exec(value);
  if (!m || !isValidDateParts(Number(m[1]), Number(m[2]), Number(m[3]))) {
    throw new Error(`Data inválida: ${value}`);
  }
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function toIsoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Days since 1970-01-01 for a calendar date (timezone independent). */
export function toDayNumber(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function fromDayNumber(dayNumber: number): IsoDate {
  const d = new Date(dayNumber * MS_PER_DAY);
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function diffInDays(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: IsoDate): number {
  // 1970-01-01 was a Thursday (4).
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

/** Monday-based ISO week start for a date. */
export function startOfWeek(date: IsoDate): IsoDate {
  const wd = weekdayOf(date);
  return addDays(date, -((wd + 6) % 7));
}

export function monthKey(date: IsoDate): string {
  return date.slice(0, 7);
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Today's calendar date in the given IANA timezone (or the runtime's local
 * timezone when omitted). Uses Intl so the result is the *local* date, never
 * the UTC date.
 */
export function todayIso(timeZone?: string, now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return toIsoDate(get("year"), get("month"), get("day"));
}

/** Milliseconds until the next local midnight (used to refresh day counters). */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  return Math.max(1_000, next.getTime() - now.getTime());
}

/** Whole calendar months and remaining days between two dates (from <= to). */
export function diffInMonthsAndDays(from: IsoDate, to: IsoDate): { months: number; days: number } {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  let months = (b.year - a.year) * 12 + (b.month - a.month);
  if (b.day < a.day) months -= 1;
  if (months < 0) return { months: 0, days: Math.max(0, diffInDays(from, to)) };
  const anchorYear = a.year + Math.floor((a.month - 1 + months) / 12);
  const anchorMonth = ((a.month - 1 + months) % 12) + 1;
  const anchorDay = Math.min(a.day, daysInMonth(anchorYear, anchorMonth));
  const anchor = toIsoDate(anchorYear, anchorMonth, anchorDay);
  return { months, days: diffInDays(anchor, to) };
}

export function monthGrid(year: number, month: number): IsoDate[] {
  // 6 weeks × 7 days, starting on Monday.
  const first = toIsoDate(year, month, 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
