"use client";

import { useCallback, useState } from "react";
import { brand } from "@/config/brand";
import { useCompanyName } from "@/lib/demo-company";
import { approve, defaultPayrollWeek, markReminded, usePayrollWeek, useRemindedAt, type PayrollRow } from "@/lib/demo-payroll";
import { useHydrated } from "@/lib/demo-store";
import { downloadFile } from "@/lib/download";
import { weekToCsv } from "@/lib/csv";
import { formatDecimalHours, formatHM, weekTotals } from "@/lib/hours";
import { formatWeekRange } from "@/lib/week";
import { resolveWeekParam } from "@/lib/week-param";
import { StatusBadge } from "../ui";
import { WeekNav } from "../WeekNav";
import { toBadge, WorkerDetail } from "./WorkerDetail";

type Filter = "all" | "submitted" | "approved" | "not_submitted";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "submitted", label: "To approve" },
  { id: "approved", label: "Approved" },
  { id: "not_submitted", label: "Not submitted" },
];
const shortStamp = new Intl.DateTimeFormat("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });

export function PayrollDashboard({ weekParam }: { weekParam?: string }) {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="p-8 text-center text-muted">Loading…</div>;
  const weekStart = weekParam ? resolveWeekParam(weekParam) : defaultPayrollWeek();
  return <Dashboard key={weekStart} weekStart={weekStart} />;
}

function Dashboard({ weekStart }: { weekStart: string }) {
  const rows = usePayrollWeek(weekStart);
  const remindedAt = useRemindedAt(weekStart);
  const companyName = useCompanyName();
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitted = rows.filter((r) => r.sheet);
  const missing = rows.filter((r) => r.status === "not_submitted");
  const toApprove = rows.filter((r) => r.status === "submitted");
  const sum = (pick: (t: ReturnType<typeof weekTotals>) => number) => submitted.reduce((n, r) => n + pick(weekTotals(r.sheet!.days)), 0);
  const totalMinutes = sum((t) => t.totalMinutes);
  const overtimeMinutes = sum((t) => t.overtimeMinutes);
  const counts: Record<Filter, number> = { all: rows.length, submitted: toApprove.length, approved: rows.filter((r) => r.status === "approved").length, not_submitted: missing.length };
  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const open = rows.find((r) => r.workerId === openId) ?? null;

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((m) => (m === text ? null : m)), 5000);
  };

  function remind(targets: PayrollRow[]) {
    if (targets.length === 0) return;
    markReminded(targets.map((r) => r.workerId), weekStart);
    const who = targets.length === 1 ? targets[0].name : `${targets.length} people`;
    flash(`Reminder sent to ${who}. (Demo: no email was actually sent.)`);
  }

  function approveRow(row: PayrollRow) {
    approve(row.workerId, weekStart);
    flash(`${row.name}'s timesheet approved.`);
  }

  function approveAll() {
    toApprove.forEach((r) => approve(r.workerId, weekStart));
    flash(`${toApprove.length} timesheet${toApprove.length === 1 ? "" : "s"} approved.`);
  }

  const downloadPdf = useCallback(
    async (targets: PayrollRow[]) => {
      const withSheets = targets.filter((r) => r.sheet);
      if (withSheets.length === 0) return;
      setBusy(true);
      try {
        const [{ buildTimesheetPdf, pdfFileName }, { PDFDocument }] = await Promise.all([import("@/lib/pdf"), import("pdf-lib")]);
        if (withSheets.length === 1) {
          const r = withSheets[0];
          const bytes = await buildTimesheetPdf({ companyName, workerName: r.name, sheet: r.sheet! });
          downloadFile(bytes as BlobPart, pdfFileName(r.name, weekStart), "application/pdf");
        } else {
          // One file with a page per worker, so the browser doesn't block lots of downloads.
          const combined = await PDFDocument.create();
          for (const r of withSheets) {
            const doc = await PDFDocument.load(await buildTimesheetPdf({ companyName, workerName: r.name, sheet: r.sheet! }));
            (await combined.copyPages(doc, doc.getPageIndices())).forEach((p) => combined.addPage(p));
          }
          downloadFile((await combined.save()) as BlobPart, `timesheets-${weekStart}.pdf`, "application/pdf");
        }
      } finally {
        setBusy(false);
      }
    },
    [companyName, weekStart],
  );

  function exportCsv() {
    const csv = weekToCsv(weekStart, rows.map((r) => ({ name: r.name, status: toBadge(r.status) === "draft" ? "Not submitted" : r.status === "approved" ? "Approved" : "Submitted", sheet: r.sheet })));
    downloadFile(csv, `timesheets-${weekStart}.csv`, "text/csv;charset=utf-8");
  }

  const action = "min-h-11 whitespace-nowrap rounded-xl px-4 text-sm font-semibold disabled:opacity-40";

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 pb-16 pt-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-muted">Timesheets for {formatWeekRange(weekStart)}</p>
        </div>
        <div className="md:w-[26rem]">
          <WeekNav weekStart={weekStart} basePath="/payroll" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Submitted" value={`${submitted.length} / ${rows.length}`} note={`${toApprove.length} waiting for approval`} />
        <Stat label="Still to submit" value={String(missing.length)} note={missing.length ? missing.map((r) => r.name.split(" ")[0]).join(", ") : "Everyone's in"} tone={missing.length ? "warn" : undefined} />
        <Stat label="Total hours" value={formatDecimalHours(totalMinutes)} note={formatHM(totalMinutes)} />
        <Stat label="Overtime hours" value={formatDecimalHours(overtimeMinutes)} note={`Over ${brand.overtimeThresholdHours}h per worker`} />
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div role="tablist" aria-label="Filter timesheets" className="flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-surface p-1 shadow-[inset_0_0_0_1px_var(--brand-border)]">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-10 whitespace-nowrap rounded-lg px-3 text-sm font-semibold ${filter === f.id ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
            >
              {f.label} <span className="tabular-nums opacity-75">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 xl:ml-auto xl:flex-nowrap">
          <button type="button" onClick={approveAll} disabled={toApprove.length === 0} className={`${action} bg-brand text-white`}>
            Approve all ({toApprove.length})
          </button>
          <button type="button" onClick={() => remind(missing)} disabled={missing.length === 0} className={`${action} border-2 border-brand bg-surface text-brand`}>
            Remind missing ({missing.length})
          </button>
          <button type="button" onClick={() => downloadPdf(submitted)} disabled={busy || submitted.length === 0} className={`${action} border-2 border-line bg-surface text-ink`}>
            {busy ? "Preparing…" : "Download PDFs"}
          </button>
          <button type="button" onClick={exportCsv} className={`${action} border-2 border-line bg-surface text-ink`}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <table className="w-full text-left">
          <caption className="sr-only">Timesheets this week</caption>
          <thead className="bg-page text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Worker</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="hidden px-3 py-3 text-right font-semibold md:table-cell">Days</th>
              <th className="px-3 py-3 text-right font-semibold">Hours</th>
              <th className="hidden px-3 py-3 text-right font-semibold sm:table-cell">Overtime</th>
              <th className="hidden px-3 py-3 font-semibold lg:table-cell">Submitted</th>
              <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const t = r.sheet ? weekTotals(r.sheet.days) : null;
              const reminded = remindedAt(r.workerId);
              return (
                <tr key={r.workerId} onClick={() => setOpenId(r.workerId)} className="cursor-pointer border-t border-line hover:bg-brand-soft/40">
                  <td className="px-4 py-3">
                    <button type="button" className="text-left font-semibold hover:underline" onClick={(e) => { e.stopPropagation(); setOpenId(r.workerId); }}>
                      {r.name}
                    </button>
                    <div className="text-xs text-muted">{r.role}</div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={toBadge(r.status)} />
                    {reminded && r.status === "not_submitted" && <div className="mt-1 text-xs text-muted">Reminded {shortStamp.format(new Date(reminded))}</div>}
                  </td>
                  <td className="hidden px-3 py-3 text-right tabular-nums md:table-cell">{t ? t.daysWorked : "–"}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{t ? formatDecimalHours(t.totalMinutes) : "–"}</td>
                  <td className={`hidden px-3 py-3 text-right tabular-nums sm:table-cell ${t && t.overtimeMinutes > 0 ? "font-semibold" : "text-muted"}`}>{t ? formatDecimalHours(t.overtimeMinutes) : "–"}</td>
                  <td className="hidden px-3 py-3 text-sm text-muted lg:table-cell">{r.sheet?.submittedAt ? shortStamp.format(new Date(r.sheet.submittedAt)) : "–"}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {r.status === "submitted" && (
                      <button type="button" onClick={() => approveRow(r)} className="min-h-10 rounded-lg bg-brand px-3 text-sm font-semibold text-white">
                        Approve
                      </button>
                    )}
                    {r.status === "not_submitted" && (
                      <button type="button" onClick={() => remind([r])} className="min-h-10 rounded-lg border-2 border-brand px-3 text-sm font-semibold text-brand">
                        Remind
                      </button>
                    )}
                    {r.status === "approved" && (
                      <button type="button" onClick={() => downloadPdf([r])} disabled={busy} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-brand hover:underline">
                        PDF
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">Nobody in this list for this week.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {message && <div className="rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-lg">{message}</div>}
      </div>

      {open && (
        <WorkerDetail
          row={open}
          weekStart={weekStart}
          remindedAt={remindedAt(open.workerId)}
          onClose={() => setOpenId(null)}
          onApprove={() => approveRow(open)}
          onRemind={() => remind([open])}
          onDownload={() => downloadPdf([open])}
        />
      )}
    </div>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "warn" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${tone === "warn" ? "text-amber-800" : "text-brand"}`}>{value}</div>
      <div className="mt-1 truncate text-sm text-muted">{note}</div>
    </div>
  );
}
