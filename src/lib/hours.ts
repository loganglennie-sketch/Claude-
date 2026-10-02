import { brand } from "@/config/brand";
import type { DayEntry, JobEntry } from "./types";

export function timeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
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

const MAX_DAY_MINUTES = 24 * 60;

/** Minutes for one job entry, or a plain-English problem to show the worker. */
export function entryMinutes(entry: JobEntry): Result {
  let minutes: number;
  if (entry.mode === "hours") {
    const parsed = parseHours(entry.hours);
    if (parsed === null) return { minutes: 0, error: entry.hours.trim() ? "Hours should be a number, like 3 or 3.5" : "Add the hours" };
    if (parsed <= 0) return { minutes: 0, error: "Hours must be more than 0" };
    minutes = parsed;
  } else {
    const start = timeToMinutes(entry.start);
    const finish = timeToMinutes(entry.finish);
    if (start === null || finish === null) return { minutes: 0, error: "Add a start and finish time" };
    if (finish <= start) return { minutes: 0, error: "Finish time must be after start time" };
    minutes = finish - start - Math.max(0, entry.breakMins || 0);
    if (minutes <= 0) return { minutes: 0, error: "Break is longer than the time worked" };
  }
  if (!entry.jobNumber.trim()) return { minutes, error: "Add the job number" };
  return { minutes, error: null };
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
  return { minutes, error };
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
  errors: { date: string; error: string }[];
};

export function weekTotals(days: DayEntry[]): WeekTotals {
  let totalMinutes = 0;
  let daysWorked = 0;
  const errors: WeekTotals["errors"] = [];
  for (const day of days) {
    const r = dayMinutes(day);
    totalMinutes += r.minutes;
    if (day.worked) daysWorked++;
    if (r.error) errors.push({ date: day.date, error: r.error });
  }
  const threshold = brand.overtimeThresholdHours * 60;
  return { totalMinutes, overtimeMinutes: Math.max(0, totalMinutes - threshold), daysWorked, errors };
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
