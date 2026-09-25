import { brand } from "@/config/brand";
import type { DayEntry } from "./types";

export function timeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export type DayResult = { minutes: number; error: string | null };

/** Minutes worked for one day, or a plain-English problem to show the worker. */
export function dayMinutes(day: DayEntry): DayResult {
  if (!day.worked) return { minutes: 0, error: null };
  const start = timeToMinutes(day.start);
  const finish = timeToMinutes(day.finish);
  if (start === null || finish === null) return { minutes: 0, error: "Add a start and finish time" };
  if (finish <= start) return { minutes: 0, error: "Finish time must be after start time" };
  const breakMins = Math.max(0, day.breakMins || 0);
  const minutes = finish - start - breakMins;
  if (minutes <= 0) return { minutes: 0, error: "Break is longer than the time worked" };
  return { minutes, error: null };
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
