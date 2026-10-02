"use client";

/**
 * Keeps the fleet's vessels, personnel and trips on this device.
 * The first time it's opened it's filled with the demo fleet.
 * STAGE 3 adds an outbox on top of this that syncs changes to the
 * server whenever there's a connection; the screens stay the same.
 */
import { useMemo, useSyncExternalStore } from "react";
import { toISODate } from "../week";
import { demoFleet } from "./demo-data";
import { isEditable, newId, nextReference, uniqueCrew } from "./trips";
import type { Person, Trip, TripQuery, Vessel } from "./types";

const KEY = "timesheets:vessel:v1";
type Fleet = { vessels: Vessel[]; people: Person[]; trips: Trip[] };

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: Fleet | null = null;
const EMPTY: Fleet = { vessels: [], people: [], trips: [] };

function read(): Fleet {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return (cached ??= demoFleet());
  }
  if (raw === null) {
    // First visit on this device: start with the demo fleet.
    persist(demoFleet());
    return cached!;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = JSON.parse(raw) as Fleet;
    } catch {
      cached = demoFleet();
    }
  }
  return cached!;
}

function persist(fleet: Fleet) {
  cached = fleet;
  try {
    const raw = JSON.stringify(fleet);
    localStorage.setItem(KEY, raw);
    cachedRaw = raw;
  } catch {
    // Storage full or blocked: keep working from memory.
  }
}

function write(fleet: Fleet) {
  persist(fleet);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export type FleetData = Fleet & {
  vesselsById: Record<string, Vessel>;
  peopleById: Record<string, Person>;
};

/** Everything on this device, with look-ups by id. Empty during server rendering. */
export function useFleet(): FleetData {
  const fleet = useSyncExternalStore(subscribe, read, () => EMPTY);
  return useMemo(
    () => ({
      ...fleet,
      vesselsById: Object.fromEntries(fleet.vessels.map((v) => [v.id, v])),
      peopleById: Object.fromEntries(fleet.people.map((p) => [p.id, p])),
    }),
    [fleet],
  );
}

export type NewTrip = { vesselId: string; mobDate: string; demobDate: string; client: string; jobNumber: string; copyCrewFrom: string | null };

/** Starts a trip, optionally with the people from an earlier trip (all on board for the whole trip). */
export function startTrip(input: NewTrip): Trip {
  const fleet = read();
  const vessel = fleet.vessels.find((v) => v.id === input.vesselId)!;
  const source = input.copyCrewFrom ? fleet.trips.find((t) => t.id === input.copyCrewFrom) : null;
  const now = new Date().toISOString();
  const trip: Trip = {
    id: newId("t"),
    vesselId: vessel.id,
    reference: nextReference(fleet.trips, vessel, input.mobDate),
    mobDate: input.mobDate,
    demobDate: input.demobDate,
    client: input.client.trim(),
    jobNumber: input.jobNumber.trim(),
    crew: source ? uniqueCrew(source).map((c) => ({ id: newId("c"), ...c, joined: input.mobDate, left: input.demobDate })) : [],
    cells: {},
    status: "in_progress",
    createdAt: now,
    updatedAt: now,
  };
  write({ ...fleet, trips: [...fleet.trips, trip] });
  return trip;
}

/** Saves changes to a trip the vessel can still edit. Locked trips are left alone. */
export function saveTrip(next: Trip) {
  const fleet = read();
  const current = fleet.trips.find((t) => t.id === next.id);
  if (!current || !isEditable(current)) return;
  write({ ...fleet, trips: fleet.trips.map((t) => (t.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : t)) });
}

/** Deletes a trip that was started by mistake (only while nothing has been submitted). */
export function deleteTrip(id: string) {
  const fleet = read();
  const trip = fleet.trips.find((t) => t.id === id);
  if (!trip || trip.status !== "in_progress") return;
  write({ ...fleet, trips: fleet.trips.filter((t) => t.id !== id) });
}

/** Vessel: the master signs and sends the trip sheet to the office. Any office queries count as answered. */
export function submitTrip(id: string, signedBy: string, signature: string) {
  const fleet = read();
  const trip = fleet.trips.find((t) => t.id === id);
  if (!trip || !isEditable(trip)) return;
  const now = new Date().toISOString();
  const submitted: Trip = {
    ...trip,
    status: "submitted",
    submittedAt: now,
    updatedAt: now,
    signedBy,
    signature,
    signaturePath: undefined,
    queries: trip.queries?.map((q) => (q.answeredAt ? q : { ...q, answeredAt: now })),
  };
  write({ ...fleet, trips: fleet.trips.map((t) => (t.id === id ? submitted : t)) });
}

function updateSubmitted(id: string, change: (t: Trip) => Trip) {
  const fleet = read();
  const trip = fleet.trips.find((t) => t.id === id);
  if (!trip || trip.status !== "submitted") return; // only sheets waiting for the office
  write({ ...fleet, trips: fleet.trips.map((t) => (t.id === id ? { ...change(t), updatedAt: new Date().toISOString() } : t)) });
}

/** Office: signs the trip sheet off. Approved trips are locked for good. */
export function approveTrip(id: string, by: string) {
  updateSubmitted(id, (t) => ({ ...t, status: "approved", approvedAt: new Date().toISOString(), approvedBy: by }));
}

/** Office: sends the sheet back to the vessel with a comment on each queried line. */
export function queryTrip(id: string, items: Pick<TripQuery, "crewId" | "date" | "comment">[], by: string) {
  if (!items.length) return;
  const at = new Date().toISOString();
  updateSubmitted(id, (t) => ({
    ...t,
    status: "queried",
    queries: [...(t.queries ?? []), ...items.map((q) => ({ id: newId("q"), ...q, comment: q.comment.trim(), by, at }))],
  }));
}

/** Puts the demo fleet back as it was. */
export function resetFleetDemo() {
  write(demoFleet(toISODate(new Date())));
}
