"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { brand } from "@/config/brand";
import { blankTimesheet } from "@/lib/demo-store";
import { submitSheet, useWorkerSheets } from "@/lib/data";
import { dayMinutes, dayTimeline, formatHM, weekTotals } from "@/lib/hours";
import { DAY_STATUS_LABEL, dayStatus, Timeline } from "./DayCard";
import { allowanceSummary, dayExtrasText, WeekExtrasList } from "./WeekExtras";
import { formatDayMonth, formatShortDay, formatWeekRange, parseISODate } from "@/lib/week";
import { resolveWeekParam } from "@/lib/week-param";
import { useDemoCompany } from "@/lib/demo-company";
import { withTimesForEveryEntry } from "@/lib/jobs";
import { SignaturePad } from "./SignaturePad";
import { Button, ButtonLink, Card } from "./ui";

export function ReviewScreen({ weekParam }: { weekParam?: string }) {
  const data = useWorkerSheets();
  const store = data.sheets;
  const company = useDemoCompany();
  const router = useRouter();
  const [declared, setDeclared] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (data.loadError) return <div className="p-8 text-center text-danger">Couldn&apos;t load your timesheet. Check your signal and refresh the page.</div>;
  if (!data.ready) return <div className="p-8 text-center text-muted">Loading…</div>;

  const weekStart = resolveWeekParam(weekParam);
  const stored = store[weekStart] ?? blankTimesheet(weekStart);
  const sheet = company.entryMode === "times" ? withTimesForEveryEntry(stored) : stored;
  const totals = weekTotals(sheet.days, sheet.expenses);
  const alreadySubmitted = sheet.status !== "draft";
  const nothingEntered = totals.daysWorked + totals.holidayDays + totals.sickDays === 0;
  const hasProblems = totals.errors.length > 0 || totals.otherErrors.length > 0 || nothingEntered;
  const canSubmit = declared && !!signature && !hasProblems && !alreadySubmitted;

  async function submit() {
    if (!canSubmit || !signature || busy) return;
    setBusy(true);
    setSubmitError(null);
    try {
      // On live addresses the database checks everything again before accepting it.
      const result = await submitSheet(data.live, sheet, signature);
      if (result.ok) router.replace(`/timesheet/submitted?week=${weekStart}`);
      else setSubmitError(result.error);
    } catch {
      setSubmitError("Couldn't reach the server. Check your signal and try again. Nothing has been lost.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 pb-10 pt-4">
      <div>
        <h1 className="text-2xl font-bold">Review your week</h1>
        <p className="text-muted">{formatWeekRange(weekStart)}</p>
      </div>

      <Card className="p-0">
        <table className="w-full text-left">
          <caption className="sr-only">Hours for each day</caption>
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-semibold">Day</th>
              <th className="px-2 py-2 font-semibold">Jobs</th>
              <th className="px-4 py-2 text-right font-semibold">Hours</th>
            </tr>
          </thead>
          <tbody>
            {sheet.days.map((day) => {
              const r = dayMinutes(day);
              const error = totals.errors.find((e) => e.date === day.date)?.error;
              return (
                <tr key={day.date} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{formatShortDay(day.date)}</div>
                    <div className="text-xs text-muted">{formatDayMonth(day.date)}</div>
                    {[0, 6].includes(parseISODate(day.date).getDay()) && <div className="mt-1 text-xs font-semibold text-muted">Weekend</div>}
                  </td>
                  <td className="px-2 py-3 text-sm">
                    {day.worked ? (
                      <>
                        <Timeline items={dayTimeline(day).items} compact />
                        {error && <div className="mt-1 font-medium text-danger">{error}</div>}
                      </>
                    ) : (
                      <span className={day.absence ? "font-semibold" : "text-muted"}>{DAY_STATUS_LABEL[dayStatus(day)]}</span>
                    )}
                    {dayExtrasText(day, company.allowances) && <div className="mt-1 px-1 text-xs font-semibold text-brand-dark">{dayExtrasText(day, company.allowances)}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{day.worked ? formatHM(r.minutes) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line bg-brand-soft">
              <td colSpan={2} className="px-4 py-3 font-semibold">
                Total hours worked
                {company.showOvertime && totals.overtimeMinutes > 0 && (
                  <div className="text-sm font-normal">
                    incl. {formatHM(totals.overtimeMinutes)} overtime (over {brand.overtimeThresholdHours}h)
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-right text-xl font-bold tabular-nums text-brand">{formatHM(totals.totalMinutes)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {(allowanceSummary(sheet, company.allowances).length > 0 || sheet.notes?.trim() || (sheet.expenses ?? []).length > 0) && (
        <Card className="space-y-3">
          {allowanceSummary(sheet, company.allowances).length > 0 && <p className="font-semibold">{allowanceSummary(sheet, company.allowances).join(" · ")}</p>}
          <WeekExtrasList sheet={sheet} />
          {totals.otherErrors.map((e) => (
            <p key={e} className="font-medium text-danger">Expenses: {e}</p>
          ))}
        </Card>
      )}

      {alreadySubmitted ? (
        <Card>
          <p>This week has already been submitted (ref {sheet.reference}).</p>
        </Card>
      ) : hasProblems ? (
        <Card className="border-danger/40">
          <p className="font-semibold text-danger">
            {nothingEntered ? "You haven't marked any days as worked, holiday or sick." : "Some things need fixing before you can submit."}
          </p>
          <ButtonLink href={`/timesheet?week=${weekStart}`} variant="secondary" className="mt-3">
            ← Go back and fix
          </ButtonLink>
        </Card>
      ) : (
        <>
          <Card>
            <label className="flex cursor-pointer items-start gap-4">
              <input
                type="checkbox"
                checked={declared}
                onChange={(e) => setDeclared(e.target.checked)}
                className="mt-0.5 h-7 w-7 shrink-0 accent-[var(--brand-primary)]"
              />
              <span className="text-lg leading-snug">{brand.declaration}.</span>
            </label>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold">Your signature</h2>
            <SignaturePad onChange={setSignature} hasSignature={!!signature} />
          </Card>

          <div className="space-y-3">
            {submitError && (
              <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">
                {submitError}
              </p>
            )}
            <Button onClick={submit} disabled={!canSubmit || busy}>
              {busy ? "Submitting…" : "Submit timesheet"}
            </Button>
            {!canSubmit && (
              <p className="text-center text-sm text-muted">
                {!declared && !signature
                  ? "Tick the box and sign to submit."
                  : !declared
                    ? "Tick the box to submit."
                    : "Sign above to submit."}
              </p>
            )}
            <ButtonLink href={`/timesheet?week=${weekStart}`} variant="ghost">
              ← Back to edit
            </ButtonLink>
          </div>
        </>
      )}
    </div>
  );
}
