import { brand } from "@/config/brand";
import type { DayEntry, Expense, JobEntry } from "./types";
import { formatDayName } from "./week";

/** "07:30" → 450. Only accepts real 24-hour times (00:00–23:59). */
export function timeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Tidies what a worker typed into "HH:MM": "730" → "07:30", "19.45" → "19:45", "7" → "07:00". */
export function normaliseTime(text: string): string | null {
  const t = text.trim().replace(/\s/g, "");
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?$/.exec(t.length === 3 && /^\d+$/.test(t) ? `0${t}` : t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  return h <= 23 && min <= 59 ? `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` : null;
}

/** Reads typed hours: "3", "3.5", "3,5", "3:30" or "3h30" → minutes. */
export function parseHours(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const hm = /^(\d{1,2})\s*(?::|h)\s*(\d{1,2})?\s*m?$/.exec(t);
  if (hm) {
    const mins = Number(hm[2] ?? 0);
    return mins < 60 ? Number(hm[1]) * 60 + mins : null;
  }
  if (!/^\d{0,2}([.,]\d{0,2})?$/.test(t) || t === "." || t === ",") return null;
  return Math.round(Number(t.replace(",", ".")) * 60);
}

/** 210 → "3.5" — how hours are shown back in the hours box. */
export function minutesToHoursText(minutes: number): string {
  return String(Math.round((minutes / 60) * 100) / 100);
}

export type Result = { minutes: number; error: string | null };

const DAY = 24 * 60;
const MAX_DAY_MINUTES = DAY;
/** Longest believable overnight job; anything longer is probably a typing mistake. */
const MAX_OVERNIGHT_MINUTES = 16 * 60;

/** A job's clock times in minutes from midnight on the day it started. end > 1440 means it finished the next day. */
export type EntrySpan = { start: number; end: number; overnight: boolean };

export function entrySpan(entry: JobEntry): EntrySpan | null {
  if (entry.mode !== "times") return null;
  const start = timeToMinutes(entry.start);
  const finish = timeToMinutes(entry.finish);
  if (start === null || finish === null || start === finish) return null;
  // A finish earlier than the start means the job ran past midnight (e.g. 22:00–06:00).
  return finish > start ? { start, end: finish, overnight: false } : { start, end: finish + DAY, overnight: true };
}

/** 1830 → "06:30" (times past midnight wrap round). */
export function formatClock(minutes: number): string {
  const m = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Minutes for one job entry, or a plain-English problem to show the worker. */
export function entryMinutes(entry: JobEntry): Result {
  let minutes: number;
  if (entry.mode === "hours") {
    const parsed = parseHours(entry.hours);
    if (parsed === null) return { minutes: 0, error: entry.hours.trim() ? "Hours should be a number, like 3 or 3.5" : "Add the hours" };
    if (parsed <= 0) return { minutes: 0, error: "Hours must be more than 0" };
    minutes = parsed;
  } else {
    if (!entry.start || !entry.finish) return { minutes: 0, error: "Add a start and finish time" };
    const start = timeToMinutes(entry.start);
    const finish = timeToMinutes(entry.finish);
    if (start === null || finish === null) return { minutes: 0, error: "Use the 24-hour clock, like 07:30 or 19:45" };
    if (start === finish) return { minutes: 0, error: "Start and finish can't be the same time" };
    const span = entrySpan(entry)!;
    if (span.overnight && span.end - span.start > MAX_OVERNIGHT_MINUTES) {
      return { minutes: 0, error: "That's over 16 hours through the night. Check the start and finish times" };
    }
    minutes = span.end - span.start - Math.max(0, entry.breakMins || 0);
    if (minutes <= 0) return { minutes: 0, error: "Break is longer than the time worked" };
  }
  if (!entry.jobNumber.trim()) return { minutes, error: "Add the job number" };
  if (travelMinutes(entry) === null) return { minutes, error: "Travel time should be in hours, like 1 or 1.5" };
  return { minutes, error: null };
}

/** Travel time on a job in minutes (0 if none), or null if what was typed isn't hours. */
export function travelMinutes(entry: JobEntry): number | null {
  const typed = entry.travel?.trim() ?? "";
  if (!typed) return 0;
  const minutes = parseHours(typed);
  return minutes !== null && minutes >= 0 && minutes <= 12 * 60 ? minutes : null;
}

/** "£12.50", "12.5" or "12" → pence, or null. */
export function parsePounds(text: string): number | null {
  const t = text.trim().replace(/^£\s*/, "").replace(/,/g, "");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** 1250 → "£12.50" */
export function formatPounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/** A problem with one expense line, or null. Empty lines are ignored. */
export function expenseError(e: Expense): string | null {
  if (!e.amount.trim() && !e.description.trim() && !e.jobNumber.trim()) return null;
  const pence = parsePounds(e.amount);
  if (pence === null || pence === 0) return "Enter the amount in pounds, like 12.50";
  return null;
}

/** Total minutes for a day, plus the first problem found (if any). */
export function dayMinutes(day: DayEntry): Result {
  if (!day.worked) return { minutes: 0, error: null };
  if (day.jobs.length === 0) return { minutes: 0, error: "Add at least one job, or mark the day off" };
  let minutes = 0;
  let error: string | null = null;
  for (const entry of day.jobs) {
    const r = entryMinutes(entry);
    minutes += r.minutes;
    error ??= r.error;
  }
  if (!error && minutes > MAX_DAY_MINUTES) error = "That's more than 24 hours in one day";
  if (!error) {
    const clash = dayTimeline(day).overlaps[0];
    if (clash) error = `Jobs overlap: ${describe(clash.a)} and ${describe(clash.b)}. Fix the times before submitting`;
  }
  return { minutes, error };
}

const describe = ({ entry, span }: { entry: JobEntry; span: EntrySpan }) =>
  `${entry.jobNumber.trim() || "job"} (${formatClock(span.start)}–${formatClock(span.end)})`;

export type TimelineItem =
  | { kind: "job"; entry: JobEntry; span: EntrySpan | null; minutes: number }
  | { kind: "gap"; from: number; to: number; minutes: number };

type Timed = { entry: JobEntry; span: EntrySpan };

/**
 * A day's jobs in time order, with the gaps between them and any overlaps.
 * Jobs without clock times (typed hours) come last.
 */
export function dayTimeline(day: DayEntry): { items: TimelineItem[]; overlaps: { a: Timed; b: Timed }[] } {
  if (!day.worked) return { items: [], overlaps: [] };
  const timed: Timed[] = [];
  const untimed: JobEntry[] = [];
  for (const entry of day.jobs) {
    const span = entrySpan(entry);
    if (span) timed.push({ entry, span });
    else untimed.push(entry);
  }
  timed.sort((x, y) => x.span.start - y.span.start || x.span.end - y.span.end);

  const items: TimelineItem[] = [];
  const overlaps: { a: Timed; b: Timed }[] = [];
  let latest: Timed | null = null; // the job finishing last so far
  for (const t of timed) {
    if (latest) {
      if (t.span.start > latest.span.end) items.push({ kind: "gap", from: latest.span.end, to: t.span.start, minutes: t.span.start - latest.span.end });
      else if (t.span.start < latest.span.end) overlaps.push({ a: latest, b: t });
    }
    items.push({ kind: "job", entry: t.entry, span: t.span, minutes: entryMinutes(t.entry).minutes });
    if (!latest || t.span.end > latest.span.end) latest = t;
  }
  for (const entry of untimed) items.push({ kind: "job", entry, span: null, minutes: entryMinutes(entry).minutes });
  return { items, overlaps };
}

/** Where a day's last job finishes, if it runs past midnight (minutes after midnight the next day). */
function overnightFinish(day: DayEntry): number | null {
  if (!day.worked) return null;
  const ends = day.jobs.map(entrySpan).filter((s): s is EntrySpan => !!s?.overnight).map((s) => s.end - DAY);
  return ends.length ? Math.max(...ends) : null;
}

/** Hours per job number for one day (entries with the same job are added together). */
export function dayJobTotals(day: DayEntry): { jobNumber: string; minutes: number }[] {
  if (!day.worked) return [];
  const totals = new Map<string, number>();
  for (const entry of day.jobs) {
    const job = entry.jobNumber.trim().toUpperCase();
    const { minutes } = entryMinutes(entry);
    if (job && minutes > 0) totals.set(job, (totals.get(job) ?? 0) + minutes);
  }
  return [...totals].map(([jobNumber, minutes]) => ({ jobNumber, minutes }));
}

export type WeekTotals = {
  totalMinutes: number;
  overtimeMinutes: number;
  daysWorked: number;
  holidayDays: number;
  sickDays: number;
  /** Travel time across all jobs (recorded separately from hours worked). */
  travelMinutes: number;
  awayNights: number;
  foodDays: number;
  expensesPence: number;
  errors: { date: string; error: string }[];
  /** Problems that aren't about one day (e.g. an expense). */
  otherErrors: string[];
};

export function weekTotals(days: DayEntry[], expenses: Expense[] = []): WeekTotals {
  let totalMinutes = 0;
  let daysWorked = 0;
  let holidayDays = 0;
  let sickDays = 0;
  let travel = 0;
  let awayNights = 0;
  let foodDays = 0;
  const errors: WeekTotals["errors"] = [];
  days.forEach((day, i) => {
    const r = dayMinutes(day);
    totalMinutes += r.minutes;
    if (day.worked) daysWorked++;
    else if (day.absence === "holiday") holidayDays++;
    else if (day.absence === "sick") sickDays++;
    if (day.worked) day.jobs.forEach((j) => (travel += travelMinutes(j) ?? 0));
    if (day.away && !day.absence) awayNights++;
    if (day.food && !day.absence) foodDays++;
    let error = r.error;
    // A night shift can't still be going when the next day's first job starts.
    const carry = i > 0 ? overnightFinish(days[i - 1]) : null;
    if (!error && carry !== null && day.worked) {
      const firstStart = Math.min(...day.jobs.map(entrySpan).filter((s): s is EntrySpan => !!s).map((s) => s.start));
      if (firstStart < carry) error = `Starts before ${formatDayName(days[i - 1].date)}'s overnight job finished (${formatClock(carry)})`;
    }
    if (error) errors.push({ date: day.date, error });
  });
  const threshold = brand.overtimeThresholdHours * 60;
  const otherErrors = expenses.map(expenseError).filter((e): e is string => !!e);
  const expensesPence = expenses.reduce((sum, e) => sum + (expenseError(e) ? 0 : (parsePounds(e.amount) ?? 0)), 0);
  return {
    totalMinutes,
    overtimeMinutes: Math.max(0, totalMinutes - threshold),
    daysWorked,
    holidayDays,
    sickDays,
    travelMinutes: travel,
    awayNights,
    foodDays,
    expensesPence,
    errors,
    otherErrors: [...new Set(otherErrors)],
  };
}

/** 510 → "8h 30m" */
export function formatHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
}

/** 510 → "8.50" (decimal hours, as payroll software expects) */
export function formatDecimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}
