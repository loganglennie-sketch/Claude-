"use client";

/**
 * STAGE 1 ONLY: pretend sign-in so the screens can be tried.
 * In stage 2 the name and PIN are checked on the server against the
 * Supabase database (PINs stored scrambled, with a lock-out after
 * repeated wrong guesses), and this file is removed.
 */
import { useSyncExternalStore } from "react";
import type { AppMode } from "@/config/brand";

/** vesselId: a vessel login, used by whoever fills in the trip sheet on board. */
export type Worker = { id: string; name: string; payroll: boolean; vesselId?: string };

const DEMO_WORKERS: (Worker & { pin: string; modes: AppMode[] })[] = [
  { id: "demo", name: "Demo Worker", pin: "1234", payroll: false, modes: ["trade"] },
  { id: "office", name: "Office Demo", pin: "0000", payroll: true, modes: ["trade", "vessel"] },
  // Vessel mode: one login per vessel (vessels are in src/lib/vessel/demo-data.ts).
  { id: "v1-admin", name: "Northern Star", pin: "1111", payroll: false, vesselId: "v1", modes: ["vessel"] },
  { id: "v2-admin", name: "Sea Venture", pin: "2222", payroll: false, vesselId: "v2", modes: ["vessel"] },
  { id: "v3-admin", name: "Ocean Pioneer", pin: "3333", payroll: false, vesselId: "v3", modes: ["vessel"] },
];
export const demoLogins = (mode: AppMode) =>
  DEMO_WORKERS.filter((w) => w.modes.includes(mode)).map(({ name, pin, payroll, vesselId }) => ({ name, pin, payroll, vesselId }));

/** Where someone lands after signing in. */
export function homePath(worker: Worker, mode: AppMode): string {
  if (worker.vesselId) return "/vessel";
  if (worker.payroll) return mode === "vessel" ? "/fleet" : "/payroll";
  return "/timesheet";
}

const KEY = "timesheets:demo:session";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: Worker | null = null;

function read(): Worker | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cached;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? (JSON.parse(raw) as Worker) : null;
    } catch {
      cached = null;
    }
  }
  return cached;
}

function write(worker: Worker | null) {
  try {
    if (worker) localStorage.setItem(KEY, JSON.stringify(worker));
    else localStorage.removeItem(KEY);
  } catch {
    cachedRaw = undefined;
    cached = worker;
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The signed-in worker, or null. */
export function useWorker(): Worker | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Names match ignoring capitals and extra spaces, so "demo  worker" works. */
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function signIn(name: string, pin: string, mode: AppMode): { ok: true; worker: Worker } | { ok: false; error: string } {
  const match = DEMO_WORKERS.find((w) => w.modes.includes(mode) && normaliseName(w.name) === normaliseName(name) && w.pin === pin);
  // Same message whether the name or the PIN was wrong, so nobody can find out who works here by guessing.
  if (!match) return { ok: false, error: "That name and PIN don't match. Check them and try again." };
  const worker: Worker = { id: match.id, name: match.name, payroll: match.payroll, vesselId: match.vesselId };
  write(worker);
  return { ok: true, worker };
}

export function signOut() {
  write(null);
}
