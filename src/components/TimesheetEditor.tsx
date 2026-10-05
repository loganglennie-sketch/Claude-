"use client";

import { useState } from "react";
import { blankTimesheet } from "@/lib/demo-store";
import { saveSheet, useWorkerSheets } from "@/lib/data";
import type { SaveStatus } from "@/lib/live/worker-store";
import { dayMinutes, formatHM, weekTotals } from "@/lib/hours";
import { copyJobs, withTimesForEveryEntry } from "@/lib/jobs";
import { useDemoCompany } from "@/lib/demo-company";
import type { DayEntry, Timesheet } from "@/lib/types";
import { brand } from "@/config/brand";
import { DayCard } from "./DayCard";
import { WeekExtrasEditor } from "./WeekExtras";
import type { DemoCompany } from "@/config/demo-companies";
import { WeekNav } from "./WeekNav";
import { ButtonLink, StatusBadge } from "./ui";
import { resolveWeekParam } from "@/lib/week-param";

export function TimesheetScreen({ weekParam }: { weekParam?: string }) {
  const data = useWorkerSheets();
  const store = data.sheets;
  const company = useDemoCompany();
  if (data.loadError) return <div className="p-8 text-center text-danger">Couldn&apos;t load your timesheets. Check your signal and refresh the page.</div>;
  if (!data.ready) return <div className="p-8 text-center text-muted">Loading…</div>;
  // Worked out in the browser so "this week" uses the worker's own clock.
  const weekStart = resolveWeekParam(weekParam);
  const saved = store[weekStart];
  const timesOnly = company.entryMode === "times";
  const initial = saved ?? blankTimesheet(weekStart);
  return (
    <Editor
      key={`${weekStart}-${company.entryMode}-${data.live}`}
      initial={timesOnly ? withTimesForEveryEntry(initial) : initial}
      jobHistory={collectJobs(store, company.jobs)}
      timesOnly={timesOnly}
      showOvertime={company.showOvertime}
      allowances={company.allowances}
      live={data.live}
      saveStatus={data.saveStatus}
    />
  );
}

function collectJobs(store: Record<string, Timesheet>, demoJobs: string[]): string[] {
  const jobs = new Set<string>(demoJobs);
  Object.values(store).forEach((s) => s.days.forEach((d) => d.jobs.forEach((j) => j.jobNumber.trim() && jobs.add(j.jobNumber.trim().toUpperCase()))));
  return [...jobs].sort();
}

type EditorProps = {
  initial: Timesheet;
  jobHistory: string[];
  timesOnly: boolean;
  showOvertime: boolean;
  allowances?: DemoCompany["allowances"];
  live: boolean;
  saveStatus: SaveStatus;
};

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  offline: "No signal: saved on this phone, it will send when you have signal",
  error: "Not saved yet: please try again",
};

function Editor({ initial, jobHistory, timesOnly, showOvertime, allowances, live, saveStatus }: EditorProps) {
  const [sheet, setSheet] = useState(initial);
  const locked = sheet.status !== "draft" || !!sheet.queued;
  const totals = weekTotals(sheet.days, sheet.expenses);
  const suggestionsId = "job-suggestions";

  function update(next: Timesheet) {
    setSheet(next);
    saveSheet(live, next);
  }

  function patchDay(index: number, patch: Partial<DayEntry>) {
    update({ ...sheet, days: sheet.days.map((d, i) => (i === index ? { ...d, ...patch } : d)) });
  }

  const sameAs = (day: DayEntry): Partial<DayEntry> => ({ worked: day.worked, absence: day.absence, away: day.away, food: day.food, jobs: copyJobs(day.jobs) });

  function copyPrevious(index: number) {
    patchDay(index, sameAs(sheet.days[index - 1]));
  }

  /** "Same job all week": Monday copied to Tuesday–Friday in one tap. */
  function copyMondayToWeekdays() {
    update({ ...sheet, days: sheet.days.map((d, i) => (i >= 1 && i <= 4 ? { ...d, ...sameAs(sheet.days[0]) } : d)) });
  }

  return (
    <>
      <div className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 pb-44 pt-4">
        <WeekNav weekStart={sheet.weekStart} basePath="/timesheet" />

        {sheet.queued ? (
          <div role="status" className="rounded-2xl bg-brand-soft p-4 text-brand-dark">
            <p className="font-semibold">Signed and waiting for signal</p>
            <p className="text-sm">This week is saved on your phone and will send to the office automatically as soon as you have signal. You don&apos;t need to do anything.</p>
          </div>
        ) : locked ? (
          <div className="flex items-center gap-3 rounded-2xl bg-brand-soft p-4 text-brand-dark">
            <StatusBadge status={sheet.status} />
            <p className="text-sm">
              Reference <strong className="tabular-nums">{sheet.reference}</strong>. Submitted timesheets can&apos;t be changed — speak to the office if something is wrong.
            </p>
          </div>
        ) : (
          <>
          {sheet.sendError && (
            <p role="alert" className="rounded-2xl bg-danger/10 p-4 text-sm font-medium text-danger">
              Your signed timesheet couldn&apos;t be sent: {sheet.sendError} Please check it and submit again.
            </p>
          )}
          <p className="text-center text-sm text-muted">
            Fill in each day. Your changes save automatically.
            {live && SAVE_LABEL[saveStatus] && (
              <span role="status" className={`ml-1 font-semibold ${saveStatus === "error" ? "text-danger" : saveStatus === "offline" ? "text-brand-dark" : ""}`}>
                {SAVE_LABEL[saveStatus]}
              </span>
            )}
          </p>
          </>
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
            timesOnly={timesOnly}
            allowances={allowances}
            onCopyToWeekdays={allowances && i === 0 && day.worked ? copyMondayToWeekdays : undefined}
            weekError={totals.errors.find((e) => e.date === day.date && e.error !== dayMinutes(day).error)?.error}
          />
        ))}

        {allowances && (
          <WeekExtrasEditor sheet={sheet} readOnly={locked} showExpenses jobSuggestionsId={suggestionsId} onChange={(patch) => update({ ...sheet, ...patch })} />
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-xl space-y-3 px-4 py-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Total hours worked</div>
              <div className="text-3xl font-bold tabular-nums text-brand">{formatHM(totals.totalMinutes)}</div>
            </div>
            <div className="text-right text-sm text-muted">
              {totals.daysWorked} day{totals.daysWorked === 1 ? "" : "s"} worked
              {totals.holidayDays + totals.sickDays > 0 && (
                <div>{[totals.holidayDays && `${totals.holidayDays} holiday`, totals.sickDays && `${totals.sickDays} sick`].filter(Boolean).join(" · ")}</div>
              )}
              {showOvertime && (
                <div className={totals.overtimeMinutes > 0 ? "font-semibold text-ink" : ""}>
                  Overtime: {formatHM(totals.overtimeMinutes)}
                  <span className="sr-only"> over {brand.overtimeThresholdHours} hours</span>
                </div>
              )}
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
