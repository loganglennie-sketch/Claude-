"use client";

/**
 * DEMO ONLY: a made-up team so the payroll dashboard has something to show.
 * Hours are generated from the worker and week, so the same week always
 * shows the same numbers. Approvals and reminders are remembered on this
 * device. In the live app all of this comes from the database instead.
 */
import { useSyncExternalStore } from "react";
import type { DemoCompany } from "@/config/demo-companies";
import { useDemoCompany } from "./demo-company";
import { approveTimesheet as approveOwnTimesheet, useTimesheets } from "./demo-store";
import type { DayEntry, Timesheet } from "./types";
import { addDays, currentWeekStart, isoWeekNumber, parseISODate, weekDates } from "./week";

export type PayrollStatus = "not_submitted" | "submitted" | "approved";
export type PayrollRow = { workerId: string; name: string; role: string; status: PayrollStatus; sheet: Timesheet | null };

const DEMO_WORKER = { id: "demo", name: "Demo Worker", role: "You (from the worker app)" };


/** Latest week payroll normally works on: this week from Friday, otherwise last week. */
export function defaultPayrollWeek(): string {
  const day = new Date().getDay(); // Sun=0 … Sat=6
  const thisWeek = currentWeekStart();
  return day === 0 || day >= 5 ? thisWeek : addDays(thisWeek, -7);
}

// Small repeatable random-number generator so demo data is stable.
function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(rand: () => number, items: readonly T[]) => items[Math.floor(rand() * items.length)];

function fakeSheet(company: DemoCompany, worker: DemoCompany["team"][number], index: number, weekStart: string): { status: PayrollStatus; sheet: Timesheet | null } {
  const JOBS = company.jobs;
  const rand = seeded(`${worker.id}:${weekStart}`);
  const latest = weekStart >= defaultPayrollWeek();
  // In the latest week show a realistic mix; older weeks are all signed off.
  const status: PayrollStatus = !latest ? "approved" : (company.latestStatuses[index] ?? "submitted");
  if (status === "not_submitted") return { status, sheet: null };

  const mainJob = pick(rand, JOBS);
  const holiday = rand() < 0.12 ? Math.floor(rand() * 5) : -1;
  const worksSaturday = rand() < 0.35;
  const days: DayEntry[] = weekDates(weekStart).map((date, i) => {
    const worked = i < 5 ? i !== holiday : i === 5 && worksSaturday;
    if (!worked) return { date, worked: false, jobs: [] };
    // Hours actually worked that day, in half hours, then split across 1–3 jobs.
    const halfHours = i === 5 ? pick(rand, [8, 9, 10]) : pick(rand, [15, 16, 16, 17, 18, 19]);
    const roll = rand();
    const parts = roll < 0.55 ? 1 : roll < 0.9 ? 2 : 3;
    const splits: number[] = [];
    let left = halfHours;
    for (let k = parts; k > 1; k--) {
      const share = Math.max(2, Math.min(left - 2 * (k - 1), Math.round((left / k) * (0.6 + rand() * 0.8))));
      splits.push(share);
      left -= share;
    }
    splits.push(left);
    const used = new Set<string>();
    const jobs = splits.map((h, k) => {
      let job = k === 0 && rand() < 0.75 ? mainJob : pick(rand, JOBS);
      while (used.has(job)) job = pick(rand, JOBS);
      used.add(job);
      return { id: `${date}-${k}`, jobNumber: job, mode: "hours" as const, hours: String(h / 2), start: "", finish: "", breakMins: 0 };
    });
    return { date, worked: true, jobs };
  });

  // Most people submit on Friday afternoon. If that's still to come, pretend it was
  // 1–4 hours ago (rounded to the hour so the demo doesn't change on every reload).
  const friday = parseISODate(addDays(weekStart, 4));
  friday.setHours(15, Math.floor(rand() * 150));
  const thisHour = new Date();
  thisHour.setMinutes(0, 0, 0);
  const earlier = thisHour.getTime() - Math.round((1 + rand() * 3) * 60) * 60_000;
  const submittedMs = friday.getTime() < Date.now() ? friday.getTime() : earlier;
  const submittedAt = new Date(submittedMs).toISOString();
  const { year, week } = isoWeekNumber(weekStart);
  const suffix = Math.floor(rand() * 36 ** 4).toString(36).toUpperCase().padStart(4, "0");
  const approvedGuess = submittedMs + Math.round(30 + rand() * 90) * 60_000; // same afternoon
  const approvedMs = approvedGuess < Date.now() ? approvedGuess : submittedMs + 20 * 60_000;
  const approvedAt = status === "approved" ? new Date(approvedMs).toISOString() : undefined;

  return {
    status,
    sheet: {
      weekStart,
      days,
      status,
      reference: `TS-${year}-W${String(week).padStart(2, "0")}-${suffix}`,
      submittedAt,
      approvedAt,
      signaturePath: fakeSignature(worker.name, rand),
    },
  };
}

/** A squiggle that looks enough like a signature, inside a 300×90 box. */
function fakeSignature(name: string, rand: () => number): string {
  let x = 18;
  let d = `M ${x} ${55 + rand() * 10}`;
  for (const ch of name.replace(/[^a-z]/gi, "").slice(0, 12)) {
    const tall = /[A-Zbdfhklt]/.test(ch);
    const top = tall ? 12 + rand() * 10 : 36 + rand() * 8;
    const w = 12 + rand() * 8;
    d += ` C ${x + w * 0.2} ${top}, ${x + w * 0.9} ${top}, ${x + w * 0.6} ${60 + rand() * 6}`;
    d += ` S ${x + w * 1.1} ${48 + rand() * 8}, ${x + w} ${58 + rand() * 6}`;
    x += w * 0.85;
    if (x > 250) break;
  }
  d += ` M 20 ${74 + rand() * 4} Q ${x / 2} ${66 + rand() * 6}, ${Math.min(x + 20, 285)} ${70 + rand() * 6}`;
  return d;
}

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

