"use client";

import Link from "next/link";
import { useMemo } from "react";
import { deviceStore, type LocalTrip } from "@/lib/device";
import { formatRange } from "@/lib/dates";
import { useMe } from "@/lib/session";
import { formatHours, openQueries, tripTotals } from "@/lib/trip";
import { ButtonLink, StatusBadge } from "../ui";

export function TripList() {
  const me = useMe();
  const all = deviceStore.useValue((d) => d.trips);
  const trips = useMemo(
    () => Object.values(all ?? {}).filter((t) => t.workerId === me?.id).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [all, me],
  );
  const todo = trips.filter((t) => t.status === "draft" || t.status === "queried");
  const waiting = trips.filter((t) => t.status === "submitted");
  const done = trips.filter((t) => t.status === "approved" || t.status === "ready" || t.status === "invoiced");

  return (
    <div className="space-y-6">
      <ButtonLink href="/trips/new" className="w-full min-h-14 text-lg">
        + Start a new trip
      </ButtonLink>
      <Section title="To do" empty="Nothing to do. Start a new trip when you go offshore." trips={todo} />
      <Section title="Waiting for the client to approve" trips={waiting} />
      <Section title="Approved" trips={done} />
    </div>
  );
}

function Section({ title, trips, empty }: { title: string; trips: LocalTrip[]; empty?: string }) {
  if (trips.length === 0 && !empty) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {trips.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {trips.map((t) => (
            <li key={t.id}>
              <TripRow trip={t} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TripRow({ trip }: { trip: LocalTrip }) {
  const totals = tripTotals(trip.days);
  const queries = openQueries(trip).length;
  return (
    <Link href={`/trips/trip?id=${trip.id}`} className="block rounded-2xl border border-line bg-surface p-4 active:bg-page">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{trip.installation || "New trip"}</div>
          <div className="text-sm text-muted">{formatRange(trip.startDate, trip.endDate)}</div>
        </div>
        <StatusBadge status={trip.status} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 text-sm text-muted">
        <span>{trip.client}</span>
        <span>
          {totals.daysOn} days · {formatHours(totals.hours)} h
        </span>
        {trip.dirty && <span className="font-semibold text-amber-800">Not sent yet</span>}
      </div>
      {trip.status === "queried" && queries > 0 && (
        <div className="mt-2 rounded-lg bg-rose-50 p-2 text-sm font-medium text-rose-900">
          {queries === 1 ? "1 day queried" : `${queries} days queried`} by {trip.queries[0]?.byName}. Tap to fix and resend.
        </div>
      )}
    </Link>
  );
}
