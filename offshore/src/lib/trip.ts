import { DAY_TYPES, DAY_TYPE_ORDER, type DayType } from "@/config/settings";
import { datesBetween } from "./dates";
import type { Day, Trip, TripStatus } from "./types";

/** How a new trip's days are filled in, so technicians only change the exceptions. */
export type Pattern = { shift: "day" | "night"; travelFirst: boolean; travelLast: boolean };
export const DEFAULT_PATTERN: Pattern = { shift: "day", travelFirst: true, travelLast: true };

export function patternDay(date: string, start: string, end: string, p: Pattern): Day {
  const travel = (date === start && p.travelFirst) || (date === end && p.travelLast);
  return { date, type: travel ? "travel" : p.shift, hours: 0 };
}

/** The trip's days for its dates, keeping anything already entered for dates that stay. */
export function daysFor(start: string, end: string, p: Pattern, existing: Day[] = []): Day[] {
  const kept = new Map(existing.map((d) => [d.date, d]));
  return datesBetween(start, end).map((date) => kept.get(date) ?? patternDay(date, start, end, p));
}

export function dayHours(day: Day): number {
  return day.type === "custom" ? day.hours || 0 : DAY_TYPES[day.type].hours;
}

export type Totals = { hours: number; daysOn: number; byType: Record<DayType, number> };

export function tripTotals(days: Day[]): Totals {
  const byType = Object.fromEntries(DAY_TYPE_ORDER.map((t) => [t, 0])) as Record<DayType, number>;
  let hours = 0;
  for (const d of days) {
    byType[d.type] += 1;
    hours += dayHours(d);
  }
  const daysOn = days.filter((d) => DAY_TYPES[d.type].worked).length;
  return { hours: Math.round(hours * 100) / 100, daysOn, byType };
}

/** "12" or "7.5" */
export const formatHours = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, ""));

export const STATUS: Record<TripStatus, { label: string; badge: string }> = {
  draft: { label: "Not sent", badge: "bg-slate-200 text-slate-800" },
  submitted: { label: "Awaiting approval", badge: "bg-amber-100 text-amber-900" },
  queried: { label: "Queried", badge: "bg-rose-100 text-rose-900" },
  approved: { label: "Approved", badge: "bg-emerald-100 text-emerald-900" },
  ready: { label: "Ready to invoice", badge: "bg-sky-100 text-sky-900" },
  invoiced: { label: "Invoiced", badge: "bg-slate-100 text-slate-600" },
};

/** The technician can only change a trip that hasn't been sent, or that the client queried. */
export const canWorkerEdit = (t: Trip) => t.status === "draft" || t.status === "queried";
/** Approved by the client: nobody can change the days any more. */
export const isLocked = (t: Trip) => t.status === "approved" || t.status === "ready" || t.status === "invoiced";

export const openQueries = (t: Trip) => t.queries.filter((q) => !q.resolvedAt);

export function newId(prefix = ""): string {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/** 32 random bytes, URL-safe: unguessable, so the link itself is the key. */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fileSafe(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function tripFileName(t: Trip, ext: string) {
  return `trip-${t.startDate}-${fileSafe(t.workerName)}-${fileSafe(t.installation)}.${ext}`;
}
