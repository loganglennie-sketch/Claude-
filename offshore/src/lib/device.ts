"use client";

/**
 * Everything the technician enters is saved on their phone first (so it works
 * with no signal), then sent to the server by the sync engine (sync.ts).
 */
import { createLocalStore } from "./local-store";
import { newId } from "./trip";
import type { Trip } from "./types";

/** `dirty`: changed on this phone and not sent yet. */
export type LocalTrip = Trip & { dirty?: boolean };
export type Notice = { id: string; text: string };

type DeviceData = { trips: Record<string, LocalTrip>; lastSyncAt?: string; notices: Notice[] };

export const deviceStore = createLocalStore<DeviceData>("offshore:device:v1", () => ({ trips: {}, notices: [] }));

/** Save a change on this phone. It's sent to the office the next time there's signal. */
export function saveOnPhone(trip: Trip, what?: { who: string; what: string }) {
  const events = what ? [...trip.events, { id: newId("e"), at: new Date().toISOString(), ...what }] : trip.events;
  deviceStore.set((d) => ({ ...d, trips: { ...d.trips, [trip.id]: { ...trip, events, dirty: true, updatedAt: new Date().toISOString() } } }));
}

export function addNotice(text: string) {
  deviceStore.set((d) => ({ ...d, notices: [...d.notices, { id: newId("n"), text }] }));
}

export function dismissNotice(id: string) {
  deviceStore.set((d) => ({ ...d, notices: d.notices.filter((n) => n.id !== id) }));
}

export function unsentCount(workerId: string): number {
  return Object.values(deviceStore.get().trips).filter((t) => t.workerId === workerId && t.dirty).length;
}

/** Signing out on a shared phone: forget sent trips, keep anything not yet sent. */
export function forgetSentTrips() {
  deviceStore.set((d) => ({
    ...d,
    trips: Object.fromEntries(Object.entries(d.trips).filter(([, t]) => t.dirty)),
    notices: [],
    lastSyncAt: undefined,
  }));
}
