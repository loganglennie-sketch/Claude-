"use client";

/**
 * STAGE 1 ONLY: pretend sign-in so the screens can be tried.
 * In stage 2 the name and PIN are checked on the server against the
 * Supabase database (PINs stored scrambled, with a lock-out after
 * repeated wrong guesses), and this file is removed.
 */
import { useSyncExternalStore } from "react";

export type Worker = { id: string; name: string; payroll: boolean };

const DEMO_WORKERS: (Worker & { pin: string })[] = [
  { id: "demo", name: "Demo Worker", pin: "1234", payroll: false },
  { id: "office", name: "Office Demo", pin: "0000", payroll: true },
];
export const DEMO_LOGINS = DEMO_WORKERS.map(({ name, pin, payroll }) => ({ name, pin, payroll }));

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

export function signIn(name: string, pin: string): { ok: true; worker: Worker } | { ok: false; error: string } {
  const match = DEMO_WORKERS.find((w) => normaliseName(w.name) === normaliseName(name) && w.pin === pin);
  // Same message whether the name or the PIN was wrong, so nobody can find out who works here by guessing.
  if (!match) return { ok: false, error: "That name and PIN don't match. Check them and try again." };
  const worker = { id: match.id, name: match.name, payroll: match.payroll };
  write(worker);
  return { ok: true, worker };
}

export function signOut() {
  write(null);
}
