"use client";

import { formatClock } from "@/lib/dates";
import { pretendOfflineStore, syncNow, useSyncStatus } from "@/lib/sync";

/** Always on screen: says plainly whether everything has reached the office. */
export function SyncStatusBar({ workerId }: { workerId: string }) {
  const s = useSyncStatus(workerId);
  const pretend = pretendOfflineStore.useValue();
  if (!s) return <div className="h-11" />;

  const changes = (n: number) => (n === 1 ? "1 change" : `${n} changes`);
  let tone = "bg-emerald-50 text-emerald-900 border-emerald-200";
  let dot = "bg-emerald-500";
  let text: string;
  if (!s.signal) {
    tone = "bg-amber-50 text-amber-900 border-amber-200";
    dot = "bg-amber-500";
    text = s.unsent > 0 ? `No signal. ${changes(s.unsent)} saved on this phone. Will send automatically.` : "No signal. Everything is saved on this phone.";
  } else if (s.phase === "syncing") {
    tone = "bg-sky-50 text-sky-900 border-sky-200";
    dot = "bg-sky-500 animate-pulse";
    text = "Sending to the office…";
  } else if (s.phase === "error") {
    tone = "bg-rose-50 text-rose-900 border-rose-200";
    dot = "bg-rose-500";
    text = `Couldn't send${s.unsent ? ` ${changes(s.unsent)}` : ""}. Will try again automatically.`;
  } else if (s.unsent > 0) {
    tone = "bg-sky-50 text-sky-900 border-sky-200";
    dot = "bg-sky-500";
    text = `${changes(s.unsent)} saved on this phone, sending shortly.`;
  } else {
    text = s.lastSyncAt ? `All sent to the office. Checked ${formatClock(s.lastSyncAt)}.` : "All sent to the office.";
  }

  return (
    <div className={`border-b px-4 py-2 text-sm ${tone}`} role="status" aria-live="polite">
      <div className="mx-auto flex max-w-xl items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className="flex-1">{text}</span>
        {s.signal && s.phase !== "syncing" && (
          <button type="button" onClick={() => void syncNow(workerId)} className="min-h-9 shrink-0 font-semibold underline underline-offset-2">
            Check now
          </button>
        )}
      </div>
      <label className="mx-auto mt-1 flex max-w-xl items-center gap-2 text-xs opacity-80">
        <input type="checkbox" checked={!!pretend} onChange={(e) => pretendOfflineStore.set(e.target.checked)} />
        Demo: pretend this phone has no signal
      </label>
    </div>
  );
}
