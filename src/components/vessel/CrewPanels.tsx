"use client";

import { useState } from "react";
import { rankOrder } from "@/config/vessel";
import { saveTrip, useFleet } from "@/lib/vessel/store";
import { busyElsewhere, formatShortDate, newId, sortCrew } from "@/lib/vessel/trips";
import type { Person, Trip } from "@/lib/vessel/types";
import { isISODate, toISODate } from "@/lib/week";
import { Button } from "../ui";
import { Field, inputClass } from "./fields";

/** Today if it's within the trip, otherwise the nearest trip day. */
function clampToTrip(trip: Trip, date: string) {
  return date < trip.mobDate ? trip.mobDate : date > trip.demobDate ? trip.demobDate : date;
}

/** Add someone from the personnel list, with their join and leave dates. */
export function AddCrewPanel({ trip, onDone }: { trip: Trip; onDone: () => void }) {
  // Setting up the crew: whole trip. Adding someone later on: from today.
  const [joined, setJoined] = useState(trip.crew.length === 0 ? trip.mobDate : clampToTrip(trip, toISODate(new Date())));
  const [left, setLeft] = useState(trip.demobDate);
  const datesOk = isISODate(joined) && isISODate(left) && joined <= left && joined >= trip.mobDate && left <= trip.demobDate;

  const add = (person: Person) => {
    saveTrip({ ...trip, crew: [...trip.crew, { id: newId("c"), personId: person.id, role: person.role, joined, left }] });
  };

  return (
    <div className="space-y-3 rounded-xl border-2 border-brand/30 bg-brand-soft/30 p-3">
      <p className="text-sm">
        <strong>1.</strong> Set when they were on board. <strong>2.</strong> Click people to add them.
      </p>
      <div className="flex flex-wrap gap-3">
        <Field label="Joined">
          <input type="date" value={joined} min={trip.mobDate} max={trip.demobDate} onChange={(e) => setJoined(e.target.value)} className={`${inputClass} min-h-10 w-40`} />
        </Field>
        <Field label="Left">
          <input type="date" value={left} min={joined} max={trip.demobDate} onChange={(e) => setLeft(e.target.value)} className={`${inputClass} min-h-10 w-40`} />
        </Field>
      </div>
      {datesOk ? (
        <PersonPicker trip={trip} from={joined} to={left} onPick={add} />
      ) : (
        <p className="text-sm text-danger">Pick dates inside the trip, with the leave date on or after the join date.</p>
      )}
      <Button type="button" variant="secondary" className="min-h-11 text-base" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

/** Someone leaves and someone else takes over from the same day. */
export function CrewChangePanel({ trip, onDone }: { trip: Trip; onDone: () => void }) {
  const { peopleById } = useFleet();
  const [date, setDate] = useState(clampToTrip(trip, toISODate(new Date())));
  // Only people still on board on that day can leave.
  const leaving = sortCrew(
    trip.crew.filter((m) => m.joined <= date && date <= m.left),
    peopleById,
  );
  const [outId, setOutId] = useState("");
  const out = leaving.find((m) => m.id === outId) ?? null;
  const [inPerson, setInPerson] = useState<Person | null>(null);
  const dateOk = isISODate(date) && date >= trip.mobDate && date <= trip.demobDate;
  const ready = dateOk && !!out && !!inPerson;

  function confirm() {
    if (!ready) return;
    saveTrip({
      ...trip,
      crew: [
        ...trip.crew.map((m) => (m.id === out!.id ? { ...m, left: date } : m)),
        { id: newId("c"), personId: inPerson!.id, role: inPerson!.role, joined: date, left: out!.left },
      ],
    });
    onDone();
  }

  return (
    <div className="space-y-3 rounded-xl border-2 border-brand/30 bg-brand-soft/30 p-3">
      <Field label="1. Day of the crew change" hint="Both people are counted on this day (usually a travel day).">
        <input
          type="date"
          value={date}
          min={trip.mobDate}
          max={trip.demobDate}
          onChange={(e) => {
            setDate(e.target.value);
            setOutId("");
          }}
          className={`${inputClass} min-h-10 w-44`}
        />
      </Field>
      <Field label="2. Who is leaving?">
        <select value={outId} onChange={(e) => setOutId(e.target.value)} className={inputClass} disabled={!dateOk}>
          <option value="">Choose…</option>
          {leaving.map((m) => (
            <option key={m.id} value={m.id}>
              {peopleById[m.personId]?.name} – {m.role}
            </option>
          ))}
        </select>
      </Field>
      <div>
        <span className="mb-1 block text-sm font-medium">3. Who is joining?</span>
        {inPerson ? (
          <div className="flex items-center justify-between rounded-xl border-2 border-brand bg-surface px-3 py-2">
            <span>
              <strong>{inPerson.name}</strong> <span className="text-sm text-muted">{inPerson.role}</span>
            </span>
            <button type="button" className="text-sm font-semibold text-brand" onClick={() => setInPerson(null)}>
              Change
            </button>
          </div>
        ) : dateOk && out ? (
          <PersonPicker trip={trip} from={date} to={out.left} onPick={setInPerson} preferRole={out.role} />
        ) : (
          <p className="text-sm text-muted">Choose who is leaving first.</p>
        )}
      </div>
      {ready && (
        <p className="rounded-lg bg-surface p-2 text-sm">
          {peopleById[out!.personId]?.name} leaves on {formatShortDate(date)}. {inPerson!.name} joins on {formatShortDate(date)} and stays until{" "}
          {formatShortDate(out!.left)}.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" className="min-h-11 text-base" onClick={onDone}>
          Cancel
        </Button>
        <Button type="button" className="min-h-11 text-base" disabled={!ready} onClick={confirm}>
          Save crew change
        </Button>
      </div>
    </div>
  );
}

/**
 * Searchable personnel list. People already on this trip for those days, or
 * on another vessel, are shown greyed out with the reason.
 */
function PersonPicker({ trip, from, to, onPick, preferRole }: { trip: Trip; from: string; to: string; onPick: (p: Person) => void; preferRole?: string }) {
  const { people, trips, vesselsById } = useFleet();
  const [search, setSearch] = useState("");
  const elsewhere = busyElsewhere(trips, trip.id, from, to, vesselsById);
  const onThisTrip = new Set(trip.crew.filter((m) => m.joined <= to && from <= m.left).map((m) => m.personId));
  const q = search.trim().toLowerCase();
  const list = people
    .filter((p) => !q || `${p.name} ${p.role} ${p.agency ?? ""}`.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        Number(b.role === preferRole) - Number(a.role === preferRole) ||
        Number(!!elsewhere[a.id] || onThisTrip.has(a.id)) - Number(!!elsewhere[b.id] || onThisTrip.has(b.id)) ||
        rankOrder(a.role) - rankOrder(b.role) ||
        a.name.localeCompare(b.name),
    );
  const [justAdded, setJustAdded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, rank or agency" className={inputClass} />
      <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
        {list.map((p) => {
          const reason = onThisTrip.has(p.id) ? `Already on this trip ${formatShortDate(from)}${from === to ? "" : `–${formatShortDate(to)}`}` : elsewhere[p.id];
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={!!reason}
                onClick={() => {
                  onPick(p);
                  setJustAdded(p.name);
                }}
                className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-brand-soft/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{p.name}</span> <span className="text-sm text-muted">{p.role}</span>
                  {reason && <span className="block text-xs text-muted">{reason}</span>}
                </span>
                <span className="text-xs text-muted">{p.employment === "agency" ? "Agency" : "Staff"}</span>
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="p-3 text-sm text-muted">Nobody matches “{search}”. New people are added to the personnel list by the office.</li>}
      </ul>
      {justAdded && <p className="text-sm font-medium text-brand">✓ {justAdded} added</p>}
    </div>
  );
}
