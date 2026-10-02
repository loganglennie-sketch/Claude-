"use client";

import { resetFleetDemo, useFleet } from "@/lib/vessel/store";
import { crewOnDate, formatSpan, sortCrew, vesselTrips } from "@/lib/vessel/trips";
import { toISODate } from "@/lib/week";
import { Card } from "../ui";
import { TripBadge } from "../vessel/TripBadge";

/**
 * STAGE 1: a read-only view of every vessel, its trips and who is on board.
 * Stage 4 turns this into the full dashboard (approve, query lines, PDFs, exports).
 */
export function FleetOverview() {
  const { vessels, trips, peopleById } = useFleet();
  const today = toISODate(new Date());
  const waiting = trips.filter((t) => t.status === "submitted");

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 pb-10 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Fleet</h1>
          <p className="text-muted">
            {vessels.length} vessels · {waiting.length} trip {waiting.length === 1 ? "sheet" : "sheets"} waiting for approval
          </p>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-brand"
          onClick={() => window.confirm("Put the demo fleet back as it was? Trips started on this device will be removed.") && resetFleetDemo()}
        >
          Reset demo data
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {vessels.map((v) => {
          const list = vesselTrips(trips, v.id);
          const atSea = list.find((t) => t.mobDate <= today && today <= t.demobDate) ?? null;
          const aboard = atSea ? sortCrew(crewOnDate(atSea, today), peopleById) : [];
          return (
            <Card key={v.id} className="space-y-3">
              <div>
                <h2 className="text-lg font-bold">{v.name}</h2>
                <p className="text-sm text-muted">{v.type}</p>
              </div>
              {atSea ? (
                <div className="rounded-xl bg-brand-soft/60 p-3 text-sm">
                  <div className="font-semibold">
                    At sea · {atSea.reference} · {atSea.client} ({atSea.jobNumber})
                  </div>
                  <div className="text-muted">{formatSpan(atSea.mobDate, atSea.demobDate)}</div>
                  <div className="mt-2 font-semibold">On board now ({aboard.length})</div>
                  <ul>
                    {aboard.map((m) => (
                      <li key={m.id}>
                        {peopleById[m.personId]?.name} <span className="text-muted">· {m.role}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="rounded-xl bg-page p-3 text-sm text-muted">Alongside – no trip today.</p>
              )}
              <ul className="divide-y divide-line text-sm">
                {list.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{t.reference}</div>
                      <div className="truncate text-muted">
                        {formatSpan(t.mobDate, t.demobDate)} · {t.jobNumber}
                      </div>
                    </div>
                    <TripBadge status={t.status} />
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
