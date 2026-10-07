"use client";

/**
 * Sends trips changed on the phone to the server and brings back the latest
 * copies (e.g. a trip the client just queried or approved). Runs on its own:
 * when signal comes back, every 20 seconds, when the app is reopened, and
 * shortly after every change.
 */
import { useEffect, useSyncExternalStore } from "react";
import { addNotice, deviceStore, type LocalTrip } from "./device";
import { pushTrip, workerTrips } from "./demo-server";
import { createLocalStore } from "./local-store";
import { formatRange } from "./dates";

/** Demo switch: behave as if the phone had no signal, to try working offline. */
export const pretendOfflineStore = createLocalStore<boolean>("offshore:pretend-offline", () => false);

type Phase = "idle" | "syncing" | "error";
let phase: Phase = "idle";
let lastError: string | null = null;
const phaseListeners = new Set<() => void>();
function setPhase(p: Phase, error: string | null = null) {
  phase = p;
  lastError = error;
  phaseListeners.forEach((l) => l());
}

function browserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
export function hasSignal() {
  return browserOnline() && !pretendOfflineStore.get();
}

let running: Promise<void> | null = null;

export function syncNow(workerId: string): Promise<void> {
  if (running) return running;
  running = (async () => {
    if (!hasSignal()) return;
    setPhase("syncing");
    try {
      // 1. Send what changed here.
      for (const trip of Object.values(deviceStore.get().trips)) {
        if (!trip.dirty || trip.workerId !== workerId) continue;
        const { dirty: _, ...plain } = trip;
        void _;
        const result = await pushTrip(plain, workerId);
        // Only clear "unsent" if nothing changed on the phone while it was sending.
        deviceStore.set((d) => {
          const latest = d.trips[trip.id];
          const changedMeanwhile = latest && latest.updatedAt !== trip.updatedAt;
          const keep: LocalTrip = changedMeanwhile ? { ...latest, version: result.trip.version, queries: result.trip.queries } : result.trip;
          return { ...d, trips: { ...d.trips, [trip.id]: keep } };
        });
        if (!result.ok) addNotice(result.reason);
      }
      // 2. Bring back the latest copies.
      const fromServer = await workerTrips(workerId);
      deviceStore.set((d) => {
        const trips = { ...d.trips };
        const notices = [...d.notices];
        for (const t of fromServer) {
          const mine = trips[t.id];
          if (mine?.dirty) continue; // our unsent change wins until it's been sent
          if (mine && mine.status !== t.status) {
            const when = formatRange(t.startDate, t.endDate);
            if (t.status === "queried") notices.push({ id: `${t.id}-${t.version}`, text: `The client queried your ${t.installation} trip (${when}). Check the highlighted days.` });
            if (t.status === "approved") notices.push({ id: `${t.id}-${t.version}`, text: `Your ${t.installation} trip (${when}) was approved by ${t.approval?.name}.` });
          }
          trips[t.id] = t;
        }
        return { ...d, trips, notices, lastSyncAt: new Date().toISOString() };
      });
      setPhase("idle");
    } catch {
      setPhase("error", "Couldn't reach the server. It will try again on its own.");
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Put once on the technician's screens: keeps everything sent without anyone pressing a button. */
export function SyncAgent({ workerId }: { workerId: string }) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = (ms = 800) => {
      clearTimeout(timer);
      timer = setTimeout(() => void syncNow(workerId), ms);
    };
    soon(100);
    const every = setInterval(() => soon(0), 20_000);
    const onVisible = () => document.visibilityState === "visible" && soon(0);
    const onOnline = () => soon(0);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    // Any change saved on the phone, or the demo signal switch: send shortly after.
    let lastPending = -1;
    const offDevice = deviceStore.subscribe(() => {
      const pending = Object.values(deviceStore.get().trips).filter((t) => t.dirty).length;
      if (pending > 0 && pending !== lastPending) soon();
      lastPending = pending;
    });
    const offPretend = pretendOfflineStore.subscribe(() => soon(0));
    return () => {
      clearTimeout(timer);
      clearInterval(every);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      offDevice();
      offPretend();
    };
  }, [workerId]);
  return null;
}

function subscribeConnection(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  phaseListeners.add(listener);
  const offPretend = pretendOfflineStore.subscribe(listener);
  const offDevice = deviceStore.subscribe(listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
    phaseListeners.delete(listener);
    offPretend();
    offDevice();
  };
}

export type SyncStatus = { signal: boolean; phase: Phase; unsent: number; lastSyncAt?: string; error: string | null };

/** What the sync status bar shows. */
export function useSyncStatus(workerId: string): SyncStatus | null {
  const key = useSyncExternalStore(
    subscribeConnection,
    () => {
      const d = deviceStore.get();
      const unsent = Object.values(d.trips).filter((t) => t.workerId === workerId && t.dirty).length;
      return JSON.stringify({ signal: hasSignal(), phase, unsent, lastSyncAt: d.lastSyncAt, error: lastError });
    },
    () => null,
  );
  return key ? (JSON.parse(key) as SyncStatus) : null;
}
