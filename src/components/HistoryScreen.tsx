"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useWorker } from "@/lib/demo-auth";
import { useAppMode } from "@/lib/app-mode";
import { resetDemo } from "@/lib/demo-store";
import { useWorkerSheets } from "@/lib/data";
import { unsentCount } from "@/lib/live/worker-store";
import { formatHM, weekTotals } from "@/lib/hours";
import { formatWeekRange } from "@/lib/week";
import { StatusBadge } from "./ui";

export function HistoryScreen() {
  const data = useWorkerSheets();
  const hydrated = data.ready;
  const store = data.sheets;
  const worker = useWorker();
  const { live } = useAppMode();
  const router = useRouter();
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
              {s.queued ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Waiting for signal</span>
              ) : (
                <StatusBadge status={s.status} />
              )}
              <span className="text-xl text-muted" aria-hidden>
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-line pt-4 text-sm text-muted">
        <span>Signed in as {worker?.name}</span>
        <button type="button" onClick={async () => {
          if (live && unsentCount() > 0 && !confirm("Some of your timesheet hasn't been sent yet because there's no signal. It stays on this phone and sends next time you sign in here. Sign out anyway?")) return;
          await signOut(live);
          if (live) {
            router.replace("/login");
            router.refresh();
          }
        }} className="min-h-11 rounded-xl border-2 border-line bg-surface px-4 font-semibold text-brand">
          Sign out
        </button>
      </div>
      {live && (
        <Link href="/timesheet/pin" className="block min-h-11 text-center text-sm font-semibold text-brand underline-offset-4 hover:underline">
          Change my PIN
        </Link>
      )}
      {!live && sheets.length > 0 && (
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
