"use client";

import { useEffect, useRef } from "react";
import { brand } from "@/config/brand";
import type { PayrollRow } from "@/lib/demo-payroll";
import { dayMinutes, formatDecimalHours, formatHM, weekTotals } from "@/lib/hours";
import { formatDayMonth, formatShortDay, formatWeekRange } from "@/lib/week";
import { StatusBadge } from "../ui";
import { Signature } from "./Signature";

const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
export const toBadge = (s: PayrollRow["status"]) => (s === "not_submitted" ? "draft" : s);

type Props = {
  row: PayrollRow;
  weekStart: string;
  remindedAt?: string;
  onClose: () => void;
  onApprove: () => void;
  onRemind: () => void;
  onDownload: () => void;
};

export function WorkerDetail({ row, weekStart, remindedAt, onClose, onApprove, onRemind, onDownload }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sheet = row.sheet;
  const totals = sheet ? weekTotals(sheet.days) : null;
  const btn = "min-h-12 rounded-xl px-5 font-semibold";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-detail-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-page p-5 shadow-xl outline-none sm:rounded-3xl sm:p-7"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="worker-detail-title" className="text-2xl font-bold">{row.name}</h2>
            <p className="text-muted">
              {row.role} · {formatWeekRange(weekStart)}
            </p>
          </div>
          <StatusBadge status={toBadge(row.status)} />
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 h-10 w-10 rounded-full text-2xl text-muted hover:bg-line/50">
            ×
          </button>
        </div>

        {!sheet || !totals ? (
          <div className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-5">
            <p>{row.name} hasn&apos;t submitted a timesheet for this week yet.</p>
            {remindedAt && <p className="text-sm text-muted">Reminder sent {stamp.format(new Date(remindedAt))}.</p>}
            <button type="button" onClick={onRemind} className={`${btn} bg-brand text-white`}>
              {remindedAt ? "Send another reminder" : "Send reminder email"}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Daily breakdown</caption>
                <thead className="bg-brand-soft text-xs uppercase tracking-wide text-brand-dark">
                  <tr>
                    <th className="px-4 py-2">Day</th>
                    <th className="px-2 py-2">Start</th>
                    <th className="px-2 py-2">Finish</th>
                    <th className="px-2 py-2">Break</th>
                    <th className="hidden px-2 py-2 sm:table-cell">Job / site</th>
                    <th className="px-4 py-2 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {sheet.days.map((d) => (
                    <tr key={d.date} className="border-t border-line align-top">
                      <td className="px-4 py-2.5">
                        <span className="font-semibold">{formatShortDay(d.date)}</span> <span className="text-muted">{formatDayMonth(d.date)}</span>
                        {d.worked && d.job && <div className="text-xs text-muted sm:hidden">{d.job}</div>}
                      </td>
                      {d.worked ? (
                        <>
                          <td className="px-2 py-2.5">{d.start}</td>
                          <td className="px-2 py-2.5">{d.finish}</td>
                          <td className="px-2 py-2.5">{d.breakMins}m</td>
                          <td className="hidden px-2 py-2.5 sm:table-cell">{d.job || "–"}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{formatDecimalHours(dayMinutes(d).minutes)}</td>
                        </>
                      ) : (
                        <>
                          <td colSpan={3} className="px-2 py-2.5 text-muted">Day off</td>
                          <td className="hidden sm:table-cell" />
                          <td className="px-4 py-2.5 text-right text-muted">–</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-line bg-page/60 tabular-nums">
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-muted sm:hidden">Overtime (over {brand.overtimeThresholdHours}h)</td>
                    <td colSpan={5} className="hidden px-4 py-2 text-muted sm:table-cell">Overtime (over {brand.overtimeThresholdHours}h)</td>
                    <td className="px-4 py-2 text-right">{formatDecimalHours(totals.overtimeMinutes)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-4 py-2 font-bold sm:hidden">Total</td>
                    <td colSpan={5} className="hidden px-4 py-2 font-bold sm:table-cell">Total ({formatHM(totals.totalMinutes)})</td>
                    <td className="px-4 py-2 text-right text-lg font-bold text-brand">{formatDecimalHours(totals.totalMinutes)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="rounded-2xl border border-line bg-surface p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">Signature</div>
                <Signature sheet={sheet} name={row.name} />
                <p className="text-xs text-muted">✓ Ticked: “{brand.declaration}”</p>
              </div>
              <dl className="space-y-2 text-sm sm:w-56">
                <div>
                  <dt className="text-muted">Reference</dt>
                  <dd className="font-semibold tabular-nums">{sheet.reference}</dd>
                </div>
                <div>
                  <dt className="text-muted">Submitted</dt>
                  <dd>{sheet.submittedAt && stamp.format(new Date(sheet.submittedAt))}</dd>
                </div>
                {sheet.approvedAt && (
                  <div>
                    <dt className="text-muted">Approved</dt>
                    <dd>{stamp.format(new Date(sheet.approvedAt))}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={onDownload} className={`${btn} border-2 border-brand bg-surface text-brand`}>
                Download signed PDF
              </button>
              {row.status === "submitted" && (
                <button type="button" onClick={onApprove} className={`${btn} bg-brand text-white`}>
                  Approve timesheet
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
