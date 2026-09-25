"use client";

import { useState } from "react";
import { blankTimesheet, saveDraft, useHydrated, useTimesheets } from "@/lib/demo-store";
import { formatHM, weekTotals } from "@/lib/hours";
import type { DayEntry, Timesheet } from "@/lib/types";
import { brand } from "@/config/brand";
import { DayCard } from "./DayCard";
import { WeekNav } from "./WeekNav";
import { ButtonLink, StatusBadge } from "./ui";
import { resolveWeekParam } from "@/lib/week-param";

export function TimesheetScreen({ weekParam }: { weekParam?: string }) {
  const hydrated = useHydrated();
  const store = useTimesheets();
  if (!hydrated) return <div className="p-8 text-center text-muted">Loading…</div>;
  // Worked out in the browser so "this week" uses the worker's own clock.
  const weekStart = resolveWeekParam(weekParam);
  const saved = store[weekStart];
  return <Editor key={weekStart} initial={saved ?? blankTimesheet(weekStart)} jobHistory={collectJobs(store)} />;
}

function collectJobs(store: Record<string, Timesheet>): string[] {
  const jobs = new Set<string>();
  Object.values(store).forEach((s) => s.days.forEach((d) => d.job.trim() && jobs.add(d.job.trim())));
  return [...jobs].sort();
}

function Editor({ initial, jobHistory }: { initial: Timesheet; jobHistory: string[] }) {
  const [sheet, setSheet] = useState(initial);
  const locked = sheet.status !== "draft";
  const totals = weekTotals(sheet.days);
  const suggestionsId = "job-suggestions";

  function update(next: Timesheet) {
    setSheet(next);
    saveDraft(next);
  }

  function patchDay(index: number, patch: Partial<DayEntry>) {
    update({ ...sheet, days: sheet.days.map((d, i) => (i === index ? { ...d, ...patch } : d)) });
  }

  function copyPrevious(index: number) {
    const prev = sheet.days[index - 1];
    patchDay(index, { worked: prev.worked, start: prev.start, finish: prev.finish, breakMins: prev.breakMins, job: prev.job });
  }

  return (
    <>
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 pb-44 pt-4">
        <WeekNav weekStart={sheet.weekStart} basePath="/timesheet" />

        {locked ? (
          <div className="flex items-center gap-3 rounded-2xl bg-brand-soft p-4 text-brand-dark">
            <StatusBadge status={sheet.status} />
            <p className="text-sm">
              Reference <strong className="tabular-nums">{sheet.reference}</strong>. Submitted timesheets can&apos;t be changed — speak to the office if something is wrong.
            </p>
          </div>
        ) : (
          <p className="text-center text-sm text-muted">Fill in each day. Your changes save automatically.</p>
        )}

        <datalist id={suggestionsId}>
          {jobHistory.map((j) => (
            <option key={j} value={j} />
          ))}
        </datalist>

        {sheet.days.map((day, i) => (
          <DayCard
            key={day.date}
            day={day}
            readOnly={locked}
            jobSuggestionsId={suggestionsId}
            onChange={(patch) => patchDay(i, patch)}
            onCopyPrevious={i > 0 ? () => copyPrevious(i) : undefined}
          />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-xl space-y-3 px-4 py-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Week total</div>
              <div className="text-3xl font-bold tabular-nums text-brand">{formatHM(totals.totalMinutes)}</div>
            </div>
            <div className="text-right text-sm text-muted">
              {totals.daysWorked} day{totals.daysWorked === 1 ? "" : "s"} worked
              <div className={totals.overtimeMinutes > 0 ? "font-semibold text-ink" : ""}>
                Overtime: {formatHM(totals.overtimeMinutes)}
                <span className="sr-only"> over {brand.overtimeThresholdHours} hours</span>
              </div>
            </div>
          </div>
          {!locked && (
            <ButtonLink href={`/timesheet/review?week=${sheet.weekStart}`}>
              Review &amp; sign →
            </ButtonLink>
          )}
        </div>
      </div>
    </>
  );
}
