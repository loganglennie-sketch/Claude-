"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { brand } from "@/config/brand";
import { blankTimesheet, submitTimesheet, useHydrated, useTimesheets } from "@/lib/demo-store";
import { dayMinutes, formatHM, weekTotals } from "@/lib/hours";
import { formatDayMonth, formatShortDay, formatWeekRange } from "@/lib/week";
import { resolveWeekParam } from "@/lib/week-param";
import { SignaturePad } from "./SignaturePad";
import { Button, ButtonLink, Card } from "./ui";

export function ReviewScreen({ weekParam }: { weekParam?: string }) {
  const hydrated = useHydrated();
  const store = useTimesheets();
  const router = useRouter();
  const [declared, setDeclared] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  if (!hydrated) return <div className="p-8 text-center text-muted">Loading…</div>;

  const weekStart = resolveWeekParam(weekParam);
  const sheet = store[weekStart] ?? blankTimesheet(weekStart);
  const totals = weekTotals(sheet.days);
  const alreadySubmitted = sheet.status !== "draft";
  const hasProblems = totals.errors.length > 0 || totals.daysWorked === 0;
  const canSubmit = declared && !!signature && !hasProblems && !alreadySubmitted;

  function submit() {
    if (!canSubmit || !signature) return;
    const done = submitTimesheet(weekStart, signature);
    router.replace(`/timesheet/submitted?week=${done.weekStart}`);
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
              <th className="px-2 py-2 font-semibold">Times</th>
              <th className="px-4 py-2 text-right font-semibold">Hours</th>
            </tr>
          </thead>
          <tbody>
            {sheet.days.map((day) => {
              const r = dayMinutes(day);
              return (
                <tr key={day.date} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{formatShortDay(day.date)}</div>
                    <div className="text-xs text-muted">{formatDayMonth(day.date)}</div>
                  </td>
                  <td className="px-2 py-3 text-sm">
                    {day.worked ? (
                      <>
                        <div className="tabular-nums">
                          {day.start || "?"}–{day.finish || "?"} <span className="text-muted">· {day.breakMins}m break</span>
                        </div>
                        {day.job && <div className="text-muted">{day.job}</div>}
                        {r.error && <div className="font-medium text-danger">{r.error}</div>}
                      </>
                    ) : (
                      <span className="text-muted">Day off</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{day.worked ? formatHM(r.minutes) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line bg-brand-soft">
              <td colSpan={2} className="px-4 py-3 font-semibold">
                Total
                {totals.overtimeMinutes > 0 && (
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

      {alreadySubmitted ? (
        <Card>
          <p>This week has already been submitted (ref {sheet.reference}).</p>
        </Card>
      ) : hasProblems ? (
        <Card className="border-danger/40">
          <p className="font-semibold text-danger">
            {totals.daysWorked === 0 ? "You haven't marked any days as worked." : "Some days need fixing before you can submit."}
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
            <Button onClick={submit} disabled={!canSubmit}>
              Submit timesheet
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
