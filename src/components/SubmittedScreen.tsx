"use client";

import { brand } from "@/config/brand";
import { useHydrated, useTimesheets } from "@/lib/demo-store";
import { formatHM, weekTotals } from "@/lib/hours";
import { formatWeekRange } from "@/lib/week";
import { resolveWeekParam } from "@/lib/week-param";
import { ButtonLink, Card } from "./ui";

const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short" });

export function SubmittedScreen({ weekParam }: { weekParam?: string }) {
  const hydrated = useHydrated();
  const store = useTimesheets();
  if (!hydrated) return <div className="p-8 text-center text-muted">Loading…</div>;

  const sheet = store[resolveWeekParam(weekParam)];
  if (!sheet || sheet.status === "draft") {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4 px-4 pt-8">
        <p>We couldn&apos;t find a submitted timesheet for that week.</p>
        <ButtonLink href="/timesheet">Back to this week</ButtonLink>
      </div>
    );
  }
  const totals = weekTotals(sheet.days);

  return (
    <div className="mx-auto w-full max-w-xl flex-1 space-y-5 px-4 pb-10 pt-8 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand text-4xl text-white" aria-hidden>
        ✓
      </div>
      <div>
        <h1 className="text-2xl font-bold">Timesheet submitted</h1>
        <p className="mt-1 text-muted">Thanks — the office has your hours for {formatWeekRange(sheet.weekStart)}.</p>
      </div>

      <Card className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Your reference</div>
        <div className="text-2xl font-bold tabular-nums tracking-wide text-brand">{sheet.reference}</div>
        <div className="pt-2 text-sm text-muted">{sheet.submittedAt && stamp.format(new Date(sheet.submittedAt))}</div>
      </Card>

      <Card className="grid grid-cols-2 divide-x divide-line p-0">
        <div className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Total</div>
          <div className="text-xl font-bold tabular-nums">{formatHM(totals.totalMinutes)}</div>
        </div>
        <div className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Overtime</div>
          <div className="text-xl font-bold tabular-nums">{formatHM(totals.overtimeMinutes)}</div>
        </div>
      </Card>

      <p className="text-sm text-muted">
        In the live app a signed PDF is emailed to {brand.payrollEmail} at this point.
      </p>

      <div className="space-y-3">
        <ButtonLink href="/timesheet/history">View past timesheets</ButtonLink>
        <ButtonLink href="/timesheet" variant="ghost">
          Back to this week
        </ButtonLink>
      </div>
    </div>
  );
}
