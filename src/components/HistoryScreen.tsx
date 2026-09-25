"use client";

import Link from "next/link";
import { signOut, useWorker } from "@/lib/demo-auth";
import { resetDemo, useHydrated, useTimesheets } from "@/lib/demo-store";
import { formatHM, weekTotals } from "@/lib/hours";
import { formatWeekRange } from "@/lib/week";
import { StatusBadge } from "./ui";

export function HistoryScreen() {
  const hydrated = useHydrated();
  const store = useTimesheets();
  const worker = useWorker();
  if (!hydrated) return <div className="p-8 text-center text-muted">Loading…</div>;

  const sheets = Object.values(store).sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  return (
    <div className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 pb-10 pt-4">
      <h1 className="text-2xl font-bold">Past timesheets</h1>
      {sheets.length === 0 && <p className="text-muted">Nothing here yet. Weeks you start or submit will appear here.</p>}
      <ul className="space-y-3">
        {sheets.map((s) => (
          <li key={s.weekStart}>
            <Link
              href={`/timesheet?week=${s.weekStart}`}
              className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{formatWeekRange(s.weekStart)}</div>
                <div className="text-sm text-muted tabular-nums">
                  {formatHM(weekTotals(s.days).totalMinutes)}
                  {s.reference && ` · ${s.reference}`}
                </div>
              </div>
              <StatusBadge status={s.status} />
              <span className="text-xl text-muted" aria-hidden>
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-line pt-4 text-sm text-muted">
        <span>Signed in as {worker?.name}</span>
        <button type="button" onClick={signOut} className="min-h-11 rounded-xl border-2 border-line bg-surface px-4 font-semibold text-brand">
          Sign out
        </button>
      </div>
      {sheets.length > 0 && (
        <button
          type="button"
          onClick={() => confirm("Delete all demo timesheets on this device?") && resetDemo()}
          className="min-h-11 text-sm text-muted underline"
        >
          Reset demo data
        </button>
      )}
    </div>
  );
}
