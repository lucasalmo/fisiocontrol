import { MONTH_NAMES, WEEKDAY_NAMES, parseIsoDate, weekdayOf, type IsoDate } from "./calendar";

/** `2026-03-31` → `31/03/2026`. */
export function formatDateBR(date: IsoDate | null | undefined): string {
  if (!date) return "—";
  const { year, month, day } = parseIsoDate(date);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

/** `2026-03-31` → `Terça, 31/03/2026`. */
export function formatDateWithWeekday(date: IsoDate | null | undefined): string {
  if (!date) return "—";
  return `${WEEKDAY_NAMES[weekdayOf(date)]}, ${formatDateBR(date)}`;
}

/** `2026-03` → `março de 2026`. */
export function formatMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

export function formatMonthShort(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)}/${String(y).slice(2)}`;
}

export function formatDateTimeBR(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
}

/** Parses `DD/MM/AAAA` typed by the user; returns null when invalid. */
export function parseDateBR(value: string): IsoDate | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(value);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  try {
    parseIsoDate(iso);
    return iso;
  } catch {
    return null;
  }
}

const integerFormatter = new Intl.NumberFormat("pt-BR");
const decimalFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

export function formatInteger(n: number): string {
  return integerFormatter.format(n);
}

export function formatDecimal(n: number): string {
  return decimalFormatter.format(n);
}

/** Ratio 0..1 → `75%`. */
export function formatPercent(ratio: number): string {
  return percentFormatter.format(ratio);
}

export function pluralize(n: number, singular: string, plural: string): string {
  return `${formatInteger(n)} ${n === 1 ? singular : plural}`;
}
