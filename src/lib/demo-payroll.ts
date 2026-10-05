"use client";

/**
 * DEMO ONLY: a made-up team so the payroll dashboard has something to show.
 * Hours are generated from the worker and week, so the same week always
 * shows the same numbers. Approvals and reminders are remembered on this
 * device. In the live app all of this comes from the database instead.
 */
import { useSyncExternalStore } from "react";
import { useDemoCompany } from "./demo-company";
import { approveTimesheet as approveOwnTimesheet, useTimesheets } from "./demo-store";
import { fakeSheet, type PayrollStatus } from "./demo-generator";
import type { Timesheet } from "./types";

export { defaultPayrollWeek, type PayrollStatus } from "./demo-generator";
export type PayrollRow = {
  workerId: string;
  name: string;
  role: string;
  status: PayrollStatus;
  sheet: Timesheet | null;
  /** Live addresses only: the database id, used to approve. */
  timesheetId?: string;
};

const DEMO_WORKER = { id: "demo", name: "Demo Worker", role: "You (from the worker app)" };


// ── Approvals and reminders remembered on this device ───────────────
const KEY = "timesheets:demo:payroll";
type PayrollState = { approved: Record<string, string>; reminded: Record<string, string> };
const EMPTY: PayrollState = { approved: {}, reminded: {} };
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: PayrollState = EMPTY;

function read(): PayrollState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cached;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? { ...EMPTY, ...(JSON.parse(raw) as PayrollState) } : EMPTY;
    } catch {
      cached = EMPTY;
    }
  }
  return cached;
}
function write(next: PayrollState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    cachedRaw = undefined;
    cached = next;
  }
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
const usePayrollState = () => useSyncExternalStore(subscribe, read, () => EMPTY);
const keyFor = (workerId: string, weekStart: string) => `${workerId}:${weekStart}`;

export function approve(workerId: string, weekStart: string) {
  if (workerId === DEMO_WORKER.id) return approveOwnTimesheet(weekStart);
  const s = read();
  write({ ...s, approved: { ...s.approved, [keyFor(workerId, weekStart)]: new Date().toISOString() } });
}

export function markReminded(workerIds: string[], weekStart: string) {
  const s = read();
  const now = new Date().toISOString();
  const reminded = { ...s.reminded };
  workerIds.forEach((id) => (reminded[keyFor(id, weekStart)] = now));
  write({ ...s, reminded });
}

export function useRemindedAt(weekStart: string): (workerId: string) => string | undefined {
  const s = usePayrollState();
  return (workerId) => s.reminded[keyFor(workerId, weekStart)];
}

/** Everyone's timesheet for one week, as the payroll team sees it. */
export function usePayrollWeek(weekStart: string): PayrollRow[] {
  const company = useDemoCompany();
  const state = usePayrollState();
  const own = useTimesheets()[weekStart];

  const rows: PayrollRow[] = company.team.map((w, i) => {
    const { status, sheet } = fakeSheet(company, w, i, weekStart);
    const approvedAt = state.approved[keyFor(w.id, weekStart)];
    if (sheet && status === "submitted" && approvedAt) {
      return { workerId: w.id, name: w.name, role: w.role, status: "approved", sheet: { ...sheet, status: "approved", approvedAt } };
    }
    return { workerId: w.id, name: w.name, role: w.role, status, sheet };
  });

  const ownStatus: PayrollStatus = !own || own.status === "draft" ? "not_submitted" : own.status;
  rows.push({ workerId: DEMO_WORKER.id, name: DEMO_WORKER.name, role: DEMO_WORKER.role, status: ownStatus, sheet: ownStatus === "not_submitted" ? null : own });
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
