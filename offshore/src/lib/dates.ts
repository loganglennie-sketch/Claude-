/** Dates are stored as "YYYY-MM-DD" text and handled at local midnight, so they never shift a day. */

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Every date from start to end, inclusive. */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 120; d = addDays(d, 1)) out.push(d);
  return out;
}

const dayName = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const full = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const stamp = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export const formatDayName = (iso: string) => dayName.format(parseISODate(iso));
export const formatDayMonth = (iso: string) => dayMonth.format(parseISODate(iso));
export const formatDate = (iso: string) => full.format(parseISODate(iso));
/** A moment in time, e.g. "7 Oct 2026, 14:05". */
export const formatStamp = (isoTime: string) => stamp.format(new Date(isoTime));
export const formatClock = (isoTime: string) => clock.format(new Date(isoTime));

export function formatRange(start: string, end: string): string {
  const a = parseISODate(start);
  const b = parseISODate(end);
  if (a.getFullYear() !== b.getFullYear()) return `${formatDate(start)} – ${formatDate(end)}`;
  return `${formatDayMonth(start)} – ${formatDate(end)}`;
}
