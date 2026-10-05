"use client";

/**
 * LIVE addresses: the office's view of one week for their company
 * (the security rules only return their own company's people and timesheets).
 */
import { useEffect, useSyncExternalStore } from "react";
import { useAppMode, type AppMode } from "@/lib/app-mode";
import { browserClient } from "@/lib/supabase/browser";
import type { PayrollRow } from "@/lib/demo-payroll";
import { rowToSheet, SHEET_COLUMNS } from "./worker-store";

type WeekState = { status: "loading" | "ready" | "error"; rows: PayrollRow[]; error?: string };
let weeks: Record<string, WeekState> = {};
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const setWeek = (week: string, value: WeekState) => {
  weeks = { ...weeks, [week]: value };
  listeners.forEach((l) => l());
};

async function loadWeek(mode: AppMode, week: string) {
  if (!mode.supabase) return;
  const db = browserClient(mode.supabase.url, mode.supabase.publishableKey);
  setWeek(week, { status: "loading", rows: weeks[week]?.rows ?? [] });
  const [people, sheets] = await Promise.all([
    db.from("users").select("id, full_name, employee_number, active").eq("role", "worker"),
    db.from("timesheets").select(`id, user_id, ${SHEET_COLUMNS}`).eq("week_start", week),
  ]);
  if (people.error || sheets.error) return setWeek(week, { status: "error", rows: [], error: (people.error ?? sheets.error)!.message });
  type Person = { id: string; full_name: string; employee_number: string | null; active: boolean };
  type Sheet = Parameters<typeof rowToSheet>[0] & { id: string; user_id: string };
  const byUser = new Map(((sheets.data ?? []) as Sheet[]).map((t) => [t.user_id, t]));
  const handedIn = (t: Sheet | undefined): t is Sheet => !!t && t.status !== "draft";
  const rows: PayrollRow[] = ((people.data ?? []) as Person[])
    // Leavers only appear in weeks they handed in a timesheet.
    .filter((p) => p.active || handedIn(byUser.get(p.id)))
    .map((p): PayrollRow => {
      const t = byUser.get(p.id);
      const done = handedIn(t);
      return {
        workerId: p.id,
        name: p.full_name,
        role: [p.employee_number ? `No. ${p.employee_number}` : "Worker", p.active ? null : "left"].filter(Boolean).join(" · "),
        status: done ? (t.status as "submitted" | "approved") : "not_submitted",
        sheet: done ? rowToSheet(t) : null,
        timesheetId: t?.id,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  setWeek(week, { status: "ready", rows });
}

export function useLivePayrollWeek(week: string): WeekState | null {
  const mode = useAppMode();
  const all = useSyncExternalStore(subscribe, () => weeks, () => weeks);
  useEffect(() => {
    if (mode.live && !weeks[week]) void loadWeek(mode, week);
  }, [mode, week]);
  return mode.live ? (all[week] ?? { status: "loading", rows: [] }) : null;
}

export async function approveLive(mode: AppMode, row: PayrollRow, week: string): Promise<string | null> {
  if (!mode.supabase || !row.timesheetId) return "Timesheet not found.";
  const db = browserClient(mode.supabase.url, mode.supabase.publishableKey);
  const { error } = await db.rpc("admin_approve_timesheet", { p_timesheet_id: row.timesheetId });
  await loadWeek(mode, week);
  return error ? error.message : null;
}

export function refreshLiveWeek(mode: AppMode, week: string) {
  void loadWeek(mode, week);
}
