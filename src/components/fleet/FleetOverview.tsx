"use client";

import Link from "next/link";
import { resetFleetDemo, useFleet } from "@/lib/vessel/store";
import { tripTotals } from "@/lib/vessel/sheet";
import { crewOnDate, formatSpan, sortCrew, vesselTrips } from "@/lib/vessel/trips";
import { toISODate } from "@/lib/week";
import { Card } from "../ui";
import { TripBadge } from "../vessel/TripBadge";

const stamp = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The office's home: every vessel, who's on board now, and trip sheets to approve. */
export function FleetOverview() {
  const { vessels, trips, peopleById, vesselsById } = useFleet();
  const today = toISODate(new Date());
  const waiting = trips.filter((t) => t.status === "submitted").sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  const queried = trips.filter((t) => t.status === "queried");
  const atSea = vessels.map((v) => vesselTrips(trips, v.id).find((t) => t.mobDate <= today && today <= t.demobDate) ?? null);
  const onBoardNow = atSea.reduce((n, t) => n + (t ? crewOnDate(t, today).length : 0), 0);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-6 pb-10 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Fleet</h1>
        <button
          type="button"
          className="text-sm font-semibold text-brand"
          onClick={() =>
            window.confirm("Put the demo fleet back as it was? Trips started, approved or queried on this computer will be undone.") && resetFleetDemo()
          }
        >
          Reset demo data
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Vessels at sea" value={`${atSea.filter(Boolean).length} of ${vessels.length}`} />
        <Stat label="People on board now" value={String(onBoardNow)} />
        <Stat label="Waiting for approval" value={String(waiting.length)} highlight={waiting.length > 0} />
        <Stat label="Sent back with queries" value={String(queried.length)} />
      </div>

      <Card className="p-0">
        <h2 className="border-b border-line px-4 py-3 text-lg font-semibold">Trip sheets waiting for approval</h2>
        {waiting.length === 0 ? (
          <p className="px-4 py-4 text-muted">Nothing waiting – all caught up.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2">Trip</th>
                <th className="px-4 py-2">Vessel</th>
                <th className="px-4 py-2">Dates</th>
                <th className="px-4 py-2">Client / job</th>
                <th className="px-4 py-2 text-right">Crew</th>
                <th className="px-4 py-2">Signed by</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {waiting.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0 hover:bg-brand-soft/40">
                  <td className="px-4 py-3 font-semibold">{t.reference}</td>
                  <td className="px-4 py-3">{vesselsById[t.vesselId]?.name}</td>
                  <td className="px-4 py-3">{formatSpan(t.mobDate, t.demobDate)}</td>
                  <td className="px-4 py-3">
                    {t.client} · {t.jobNumber}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{new Set(t.crew.map((m) => m.personId)).size}</td>
                  <td className="px-4 py-3">
                    {t.signedBy}
                    {t.submittedAt && <div className="text-xs text-muted">{stamp.format(new Date(t.submittedAt))}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/fleet/trip?id=${t.id}`} className="rounded-lg bg-brand px-3 py-2 font-semibold text-white">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {vessels.map((v, i) => {
          const list = vesselTrips(trips, v.id);
          const current = atSea[i];
          const aboard = current ? sortCrew(crewOnDate(current, today), peopleById) : [];
          return (
            <Card key={v.id} className="space-y-3">
              <div>
                <h2 className="text-lg font-bold">{v.name}</h2>
                <p className="text-sm text-muted">{v.type}</p>
              </div>
              {current ? (
                <Link href={`/fleet/trip?id=${current.id}`} className="block rounded-xl bg-brand-soft/60 p-3 text-sm hover:bg-brand-soft">
                  <div className="font-semibold">
                    At sea · {current.reference} · {current.client} ({current.jobNumber})
                  </div>
                  <div className="text-muted">{formatSpan(current.mobDate, current.demobDate)}</div>
                  <div className="mt-2 font-semibold">On board now ({aboard.length})</div>
                  <ul>
                    {aboard.map((m) => (
                      <li key={m.id}>
                        {peopleById[m.personId]?.name} <span className="text-muted">· {m.role}</span>
                      </li>
                    ))}
                  </ul>
                </Link>
              ) : (
                <p className="rounded-xl bg-page p-3 text-sm text-muted">Alongside – no trip today.</p>
              )}
              <ul className="divide-y divide-line text-sm">
                {list.map((t) => (
                  <li key={t.id}>
                    <Link href={`/fleet/trip?id=${t.id}`} className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-brand-soft/40">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{t.reference}</div>
                        <div className="truncate text-muted">
                          {formatSpan(t.mobDate, t.demobDate)} · {t.jobNumber} · {tripTotals(t).paidDays} paid days
                        </div>
                      </div>
                      <TripBadge status={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-2 border-brand" : ""}>
      <div className="text-sm text-muted">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${highlight ? "text-brand" : ""}`}>{value}</div>
    </Card>
  );
}
