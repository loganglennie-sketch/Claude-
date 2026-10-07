"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatRange, formatStamp } from "@/lib/dates";
import { markReady, serverStore } from "@/lib/demo-server";
import { useMe } from "@/lib/session";
import { formatHours, openQueries, tripTotals } from "@/lib/trip";
import type { Trip, TripStatus } from "@/lib/types";
import { Button, StatusBadge } from "../ui";

const TABS: { status: TripStatus; title: string; help: string }[] = [
  { status: "submitted", title: "Awaiting approval", help: "Sent to the client's supervisor, not answered yet. Send a reminder if it's been a while." },
  { status: "queried", title: "Queried", help: "The client queried a day. Back with the technician to correct and resend." },
  { status: "approved", title: "Approved", help: "Approved by the client and locked. Check PO and cost code, then mark ready to invoice." },
  { status: "ready", title: "Ready to invoice", help: "Checked by the office. Export for invoicing, then mark invoiced." },
  { status: "invoiced", title: "Invoiced", help: "Done." },
  { status: "draft", title: "Not sent yet", help: "Trips technicians are still filling in (only the ones their phone has sent so far)." },
];

/** When the trip reached its current stage. */
function since(t: Trip): string | undefined {
  if (t.status === "submitted") return t.submission?.at;
  if (t.status === "queried") return openQueries(t)[0]?.at;
  if (t.status === "approved") return t.approval?.at;
  if (t.status === "ready") return t.readyAt;
  if (t.status === "invoiced") return t.invoicedAt;
  return t.updatedAt;
}

function daysAgo(iso?: string) {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;
}

export function Dashboard() {
  const me = useMe();
  const data = serverStore.useValue();
  const [tab, setTab] = useState<TripStatus>("submitted");
  const [installation, setInstallation] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const all = useMemo(() => Object.values(data?.trips ?? {}), [data]);
  const filtered = useMemo(
    () =>
      all.filter(
        (t) =>
          (!installation || t.installation === installation) &&
          (!search.trim() || `${t.workerName} ${t.client} ${t.poNumber} ${t.workOrder}`.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [all, installation, search],
  );
  const count = (s: TripStatus) => filtered.filter((t) => t.status === s).length;
  const rows = filtered.filter((t) => t.status === tab).sort((a, b) => (since(a) ?? "").localeCompare(since(b) ?? ""));
  const sites = [...new Set(all.map((t) => t.installation))].sort();
  const current = TABS.find((t) => t.status === tab)!;

  async function readyToInvoice(ids: string[]) {
    setBusy(true);
    await markReady(ids, me?.name ?? "Office");
    setSelected(new Set());
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.slice(0, 4).map((t) => (
          <button
            key={t.status}
            type="button"
            onClick={() => setTab(t.status)}
            className={`rounded-2xl border-2 p-3 text-left ${tab === t.status ? "border-brand bg-surface shadow-sm" : "border-line bg-surface/70"}`}
            aria-pressed={tab === t.status}
          >
            <div className="text-3xl font-bold tabular-nums">{count(t.status)}</div>
            <div className="text-sm font-semibold">{t.title}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.slice(4).map((t) => (
          <button
            key={t.status}
            type="button"
            onClick={() => setTab(t.status)}
            className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${tab === t.status ? "border-brand bg-brand text-white" : "border-line bg-surface"}`}
          >
            {t.title} ({count(t.status)})
          </button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          <select className="min-h-10 rounded-xl border-2 border-line bg-surface px-3 focus:border-brand focus:outline-none" value={installation} onChange={(e) => setInstallation(e.target.value)} aria-label="Installation">
            <option value="">All installations</option>
            {sites.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input className="min-h-10 w-56 rounded-xl border-2 border-line bg-surface px-3 placeholder:text-muted/60 focus:border-brand focus:outline-none" placeholder="Search name, client, PO…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold">{current.title}</h1>
        <p className="text-sm text-muted">{current.help}</p>
      </div>

      {tab === "approved" && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={busy || selected.size === 0} onClick={() => readyToInvoice([...selected])}>
            Mark {selected.size || ""} checked as ready to invoice
          </Button>
          <button type="button" className="min-h-10 text-sm font-semibold text-brand underline" onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>
            Select all
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Nothing here.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-brand-soft text-left text-brand-dark">
              <tr>
                {tab === "approved" && <th className="w-10 p-3" />}
                <th className="p-3">Technician</th>
                <th className="p-3">Installation · client</th>
                <th className="p-3">PO · work order</th>
                <th className="p-3">Trip</th>
                <th className="p-3 text-right">Days</th>
                <th className="p-3 text-right">Hours</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((t) => {
                const totals = tripTotals(t.days);
                const q = openQueries(t);
                return (
                  <tr key={t.id} className="align-top hover:bg-page">
                    {tab === "approved" && (
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          aria-label={`Select ${t.workerName}`}
                          checked={selected.has(t.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(t.id);
                            else next.delete(t.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                    )}
                    <td className="p-3">
                      <Link href={`/office/trips/${t.id}`} className="font-semibold text-brand underline-offset-2 hover:underline">
                        {t.workerName}
                      </Link>
                    </td>
                    <td className="p-3">
                      <div>{t.installation}</div>
                      <div className="text-muted">{t.client}</div>
                    </td>
                    <td className="p-3">
                      <div>{t.poNumber || <span className="font-semibold text-danger">No PO</span>}</div>
                      <div className="text-muted">{t.workOrder || "–"}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">{formatRange(t.startDate, t.endDate)}</td>
                    <td className="p-3 text-right tabular-nums">{totals.daysOn}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{formatHours(totals.hours)}</td>
                    <td className="p-3">
                      <StatusBadge status={t.status} />
                      <div className="mt-1 text-xs text-muted" title={since(t) && formatStamp(since(t)!)}>
                        {daysAgo(since(t))}
                        {t.status === "submitted" && t.submission && ` · ${t.submission.supervisorName}`}
                        {t.status === "approved" && t.approval && ` · ${t.approval.name}`}
                      </div>
                      {q.length > 0 && <div className="mt-1 max-w-56 text-xs text-rose-900">“{q[0].comment}”</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
