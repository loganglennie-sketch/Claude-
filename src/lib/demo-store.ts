"use client";

/**
 * STAGE 1 ONLY: keeps timesheets in this browser's local storage so the
 * screens can be tried without any accounts. In stage 2 this file is
 * replaced by the Supabase database, and the screens stay the same.
 */
import { useSyncExternalStore } from "react";
import type { DayEntry, Timesheet } from "./types";
import { isoWeekNumber, weekDates } from "./week";

const KEY = "timesheets:demo:v1";
type Store = Record<string, Timesheet>;

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedStore: Store = {};
const EMPTY: Store = {};

function read(): Store {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cachedStore;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedStore = raw ? (JSON.parse(raw) as Store) : {};
    } catch {
      cachedStore = {};
    }
  }
  return cachedStore;
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    cachedRaw = null;
    cachedStore = store;
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** All saved timesheets. Empty during server rendering. */
export function useTimesheets(): Store {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/** True once running in the browser (so saved data has been read). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function blankTimesheet(weekStart: string): Timesheet {
  const days: DayEntry[] = weekDates(weekStart).map((date, i) => ({
    date,
    worked: i < 5, // Mon–Fri default to worked, weekend off
    start: "",
    finish: "",
    breakMins: 30,
    job: "",
  }));
  return { weekStart, days, status: "draft" };
}

export function saveDraft(sheet: Timesheet) {
  const store = read();
  const existing = store[sheet.weekStart];
  if (existing && existing.status !== "draft") return; // submitted sheets are locked
  write({ ...store, [sheet.weekStart]: { ...sheet, status: "draft" } });
}

export function submitTimesheet(weekStart: string, signature: string): Timesheet {
  const store = read();
  const sheet = store[weekStart] ?? blankTimesheet(weekStart);
  if (sheet.status !== "draft") return sheet;
  const { year, week } = isoWeekNumber(weekStart);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  const submitted: Timesheet = {
    ...sheet,
    status: "submitted",
    signature,
    submittedAt: new Date().toISOString(),
    reference: `TS-${year}-W${String(week).padStart(2, "0")}-${suffix}`,
  };
  write({ ...store, [weekStart]: submitted });
  return submitted;
}

export function approveTimesheet(weekStart: string) {
  const store = read();
  const sheet = store[weekStart];
  if (!sheet || sheet.status !== "submitted") return;
  write({ ...store, [weekStart]: { ...sheet, status: "approved", approvedAt: new Date().toISOString() } });
}

/** Lets you start again while testing the demo. */
export function resetDemo() {
  write({});
}
