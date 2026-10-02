"use client";

import Link from "next/link";
import { useFleet } from "@/lib/vessel/store";
import { crewOnDate, daysInclusive, formatSpan, openTrip, sortCrew, vesselTrips } from "@/lib/vessel/trips";
import { toISODate } from "@/lib/week";
import { ButtonLink, Card } from "../ui";
import { useMyVesselId } from "./RequireVessel";
import { TripBadge } from "./TripBadge";

/** The vessel's home screen: the trip in progress, or a button to start one, and past trips. */
export function VesselHome() {
  const vesselId = useMyVesselId();
  const { trips, vesselsById, peopleById } = useFleet();
  const vessel = vesselsById[vesselId];
  if (!vessel) return <div className="p-8 text-center text-muted">Loading…</div>;

  const today = toISODate(new Date());
  const current = openTrip(trips, vesselId);
  const past = vesselTrips(trips, vesselId).filter((t) => t.id !== current?.id);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-6 pb-10 pt-6">
      <div>
        <h1 className="text-2xl font-bold">{vessel.name}</h1>
        <p className="text-muted">{vessel.type}</p>
      </div>

      {current ? (
        <Card className="space-y-4 border-2 border-brand">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Current trip</div>
              <div className="text-xl font-bold">{current.reference}</div>
              <div className="text-muted">
                {current.client} · Job {current.jobNumber}
              </div>
            </div>
            <TripBadge status={current.status} />
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Fact label="Mob → demob" value={formatSpan(current.mobDate, current.demobDate)} />
            <Fact
              label="Day"
              value={
                today < current.mobDate
                  ? "Not started"
                  : today > current.demobDate
                    ? "Finished – ready to submit"
                    : `${daysInclusive(current.mobDate, today)} of ${daysInclusive(current.mobDate, current.demobDate)}`
              }
            />
            <Fact label="On board today" value={`${crewOnDate(current, today).length} people`} />
          </div>
          {crewOnDate(current, today).length > 0 && (
            <p className="text-sm text-muted">
              {sortCrew(crewOnDate(current, today), peopleById)
                .map((m) => `${peopleById[m.personId]?.name} (${m.role})`)
                .join(" · ")}
            </p>
          )}
          <ButtonLink href={`/vessel/trip?id=${current.id}`} className="sm:w-auto">Open trip sheet</ButtonLink>
        </Card>
      ) : (
        <Card className="space-y-3 text-center">
          <p className="text-lg font-semibold">No trip in progress</p>
          <p className="text-muted">Start a trip when the vessel mobilises. You can copy the crew from the last trip and change it.</p>
          <ButtonLink href="/vessel/new" className="sm:w-auto">Start a new trip</ButtonLink>
        </Card>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Past trips</h2>
        {past.length === 0 ? (
          <p className="text-muted">None yet.</p>
        ) : (
          <Card className="divide-y divide-line p-0">
            {past.map((t) => (
              <Link key={t.id} href={`/vessel/trip?id=${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-brand-soft/50">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{t.reference}</div>
                  <div className="truncate text-sm text-muted">
                    {formatSpan(t.mobDate, t.demobDate)} · {t.client} · Job {t.jobNumber} · {new Set(t.crew.map((m) => m.personId)).size} crew
                  </div>
                </div>
                <TripBadge status={t.status} />
              </Link>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
