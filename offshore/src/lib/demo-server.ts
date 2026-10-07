"use client";

/**
 * STAGE 1 ONLY: a pretend server, kept in this browser.
 *
 * It does exactly what the real server will do in stage 2 (Supabase database),
 * with the same rules: who can change what, approved trips lock, every action
 * recorded with name, email and time. Because it lives in this browser, the
 * supervisor's link only opens on this device until stage 2.
 */
import { createLocalStore } from "./local-store";
import { buildDemoData } from "./demo-data";
import { isLocked, newId } from "./trip";
import type { Approval, Installation, Person, Trip } from "./types";

export type ServerData = { people: Person[]; installations: Installation[]; trips: Record<string, Trip>; seededAt: string };

export const serverStore = createLocalStore<ServerData>("offshore:demo-server:v1", buildDemoData);

/** A short wait, like a real network. */
const network = () => new Promise((r) => setTimeout(r, 350 + Math.random() * 300));

const now = () => new Date().toISOString();
const event = (who: string, what: string) => ({ id: newId("e"), at: now(), who, what });

function saveTrip(trip: Trip): Trip {
  const saved = { ...trip, version: trip.version + 1, updatedAt: now() };
  serverStore.set((d) => ({ ...d, trips: { ...d.trips, [saved.id]: saved } }));
  return saved;
}

function mergeEvents(a: Trip["events"], b: Trip["events"]) {
  const byId = new Map([...a, ...b].map((e) => [e.id, e]));
  return [...byId.values()].sort((x, y) => x.at.localeCompare(y.at));
}

// ── Sign-in ──────────────────────────────────────────────────────────

/** Names match ignoring capitals and extra spaces. */
export const normaliseName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export async function signIn(name: string, pin: string): Promise<Omit<Person, "pin"> | null> {
  await network();
  const p = serverStore.get().people.find((x) => normaliseName(x.name) === normaliseName(name) && x.pin === pin);
  return p ? { id: p.id, name: p.name, role: p.role } : null;
}

// ── Technician's phone ───────────────────────────────────────────────

export type PushResult = { ok: true; trip: Trip } | { ok: false; trip: Trip; reason: string };

/**
 * The phone sends a trip it changed. `trip.version` is the server's version the
 * phone last saw. Accepted when nothing changed here in the meantime, or when
 * the trip is still the technician's to change. Never once approved.
 */
export async function pushTrip(trip: Trip, workerId: string): Promise<PushResult> {
  await network();
  if (trip.workerId !== workerId) throw new Error("Not your trip");
  const current = serverStore.get().trips[trip.id];
  // A phone can only save a trip as "not sent" or "sent for approval" (or leave a query open).
  const allowed = trip.status === "draft" || trip.status === "submitted" || (trip.status === "queried" && current?.status === "queried");
  if (!allowed) throw new Error("Not allowed");
  // Approval and office records only ever come from the server.
  const serverOnly = { approval: current?.approval, readyAt: current?.readyAt, invoicedAt: current?.invoicedAt, invoiceNumber: current?.invoiceNumber };
  trip = { ...trip, ...serverOnly, token: current?.token ?? trip.token };
  if (!current) return { ok: true, trip: saveTrip({ ...trip, queries: [], version: 0 }) };

  if (isLocked(current)) {
    return { ok: false, trip: current, reason: "The client approved this trip before your change arrived, so it's locked." };
  }
  const unchangedHere = current.version === trip.version;
  const stillTheirs = current.status === "draft" || current.status === "queried";
  if (!unchangedHere && !stillTheirs) {
    return { ok: false, trip: current, reason: "This trip changed in the office while you were offline. You now have the latest copy." };
  }
  // Keep the supervisor's queries and approval records from the server; take the technician's days and details.
  // (the phone can only add its reply to a query, and mark it dealt with).
  const queries = current.queries.map((q) => {
    const mine = trip.queries.find((x) => x.id === q.id);
    return mine ? { ...q, reply: mine.reply, resolvedAt: mine.resolvedAt } : q;
  });
  return { ok: true, trip: saveTrip({ ...trip, queries, events: mergeEvents(current.events, trip.events), version: current.version }) };
}

export async function workerTrips(workerId: string): Promise<Trip[]> {
  await network();
  return Object.values(serverStore.get().trips).filter((t) => t.workerId === workerId);
}

export function installations(): Installation[] {
  return serverStore.get().installations;
}

// ── Client supervisor (secure link, no account) ──────────────────────

export function tripByToken(token: string): Trip | null {
  if (!token || token.length < 20) return null;
  return Object.values(serverStore.get().trips).find((t) => t.token === token) ?? null;
}

export async function supervisorApprove(token: string, by: Omit<Approval, "at">): Promise<Trip> {
  await network();
  const trip = tripByToken(token);
  if (!trip) throw new Error("This link isn't valid.");
  if (trip.status !== "submitted") throw new Error("This trip can't be approved right now.");
  const approval: Approval = { ...by, at: now() };
  return saveTrip({
    ...trip,
    status: "approved",
    approval,
    events: [...trip.events, event(`${by.name} (${by.email})`, "Approved the trip")],
  });
}

export async function supervisorQuery(token: string, by: { name: string; email: string }, items: { date: string; comment: string }[]): Promise<Trip> {
  await network();
  const trip = tripByToken(token);
  if (!trip) throw new Error("This link isn't valid.");
  if (trip.status !== "submitted") throw new Error("This trip can't be queried right now.");
  if (items.length === 0) throw new Error("Choose at least one day to query.");
  const at = now();
  const queries = items.map((i) => ({ id: newId("q"), date: i.date, comment: i.comment.trim(), byName: by.name, byEmail: by.email, at }));
  return saveTrip({
    ...trip,
    status: "queried",
    queries: [...trip.queries, ...queries],
    events: [...trip.events, event(`${by.name} (${by.email})`, `Queried ${items.length === 1 ? "1 day" : `${items.length} days`}`)],
  });
}

// ── Office ───────────────────────────────────────────────────────────

export async function markReady(ids: string[], by: string): Promise<void> {
  await network();
  for (const id of ids) {
    const t = serverStore.get().trips[id];
    if (t?.status === "approved") saveTrip({ ...t, status: "ready", readyAt: now(), events: [...t.events, event(by, "Checked and marked ready to invoice")] });
  }
}

export async function markInvoiced(id: string, invoiceNumber: string, by: string): Promise<void> {
  await network();
  const t = serverStore.get().trips[id];
  if (t?.status !== "ready") throw new Error("Only trips that are ready to invoice can be marked invoiced.");
  const number = invoiceNumber.trim();
  saveTrip({
    ...t,
    status: "invoiced",
    invoicedAt: now(),
    invoiceNumber: number || undefined,
    events: [...t.events, event(by, number ? `Marked invoiced (invoice ${number})` : "Marked invoiced")],
  });
}

/** Back to the starting demo data (people, trips, everything). */
export function resetDemo() {
  serverStore.set(buildDemoData());
}
