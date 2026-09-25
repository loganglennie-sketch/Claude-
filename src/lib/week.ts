/**
 * Date helpers. Dates are handled as plain "YYYY-MM-DD" strings in the
 * worker's local time so a timesheet day never shifts because of time zones.
 */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isISODate(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseISODate(s).getTime());
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Monday of the week containing the given date. */
export function mondayOf(iso: string): string {
  const d = parseISODate(iso);
  const offset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - offset);
  return toISODate(d);
}

export function currentWeekStart(): string {
  return mondayOf(toISODate(new Date()));
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "long" });
const shortDay = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const fullDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const formatDayName = (iso: string) => dayName.format(parseISODate(iso));
export const formatShortDay = (iso: string) => shortDay.format(parseISODate(iso));
export const formatDayMonth = (iso: string) => dayMonth.format(parseISODate(iso));

/** e.g. "22 – 28 Sep 2026" or "29 Sep – 5 Oct 2026". */
export function formatWeekRange(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const s = parseISODate(weekStart);
  const e = parseISODate(end);
  if (s.getMonth() === e.getMonth()) return `${s.getDate()} – ${fullDate.format(e)}`;
  if (s.getFullYear() === e.getFullYear()) return `${dayMonth.format(s)} – ${fullDate.format(e)}`;
  return `${fullDate.format(s)} – ${fullDate.format(e)}`;
}

/** ISO-8601 week number, used in reference numbers. */
export function isoWeekNumber(weekStart: string): { year: number; week: number } {
  const d = parseISODate(weekStart);
  const thursday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 3);
  const jan4 = new Date(thursday.getFullYear(), 0, 4);
  const week = 1 + Math.round(((thursday.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return { year: thursday.getFullYear(), week };
}
