/**
 * Trip and crew rules, kept separate from storage so the same code
 * can run on the vessel, in the office and (later) on the server.
 */
import { rankOrder, shiftType, vesselSettings } from "@/config/vessel";
import { addDays, parseISODate } from "../week";
import type { CrewMember, DayCell, Person, Trip, Vessel } from "./types";

export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Days between two dates, counting both ends (1 Oct → 3 Oct = 3). */
export function daysInclusive(from: string, to: string): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000) + 1;
}

export function datesBetween(from: string, to: string): string[] {
  const n = daysInclusive(from, to);
  return n > 0 ? Array.from({ length: n }, (_, i) => addDays(from, i)) : [];
}

export const tripDates = (trip: Trip) => datesBetween(trip.mobDate, trip.demobDate);
export const isOnBoard = (m: CrewMember, date: string) => m.joined <= date && date <= m.left;
export const crewOnDate = (trip: Trip, date: string) => trip.crew.filter((m) => isOnBoard(m, date));
/** True while the vessel can still change the trip. */
export const isEditable = (trip: Trip) => trip.status === "in_progress" || trip.status === "queried";

/** Most senior first, then earliest to join, then by name. */
export function sortCrew(crew: CrewMember[], people: Record<string, Person>): CrewMember[] {
  return [...crew].sort(
    (a, b) =>
      rankOrder(a.role) - rankOrder(b.role) ||
      a.joined.localeCompare(b.joined) ||
      (people[a.personId]?.name ?? "").localeCompare(people[b.personId]?.name ?? ""),
  );
}

/** A vessel's trips, newest first. */
export const vesselTrips = (trips: Trip[], vesselId: string) =>
  trips.filter((t) => t.vesselId === vesselId).sort((a, b) => b.mobDate.localeCompare(a.mobDate));

/** The trip being filled in on board (or sent back with queries), if any. */
export const openTrip = (trips: Trip[], vesselId: string) => vesselTrips(trips, vesselId).find(isEditable) ?? null;

/** Next reference for a vessel, e.g. "NS-2026-015". */
export function nextReference(trips: Trip[], vessel: Vessel, mobDate: string): string {
  const year = mobDate.slice(0, 4);
  const prefix = `${vessel.code}-${year}-`;
  const used = trips.filter((t) => t.reference.startsWith(prefix)).map((t) => Number(t.reference.slice(prefix.length)) || 0);
  return `${prefix}${String(Math.max(0, ...used) + 1).padStart(3, "0")}`;
}

/**
 * Moves the trip's mob/demob dates. Anyone who joined on the old mob date
 * (or left on the old demob date) moves with it; everyone else is kept inside the trip.
 */
export function withTripDates(trip: Trip, mobDate: string, demobDate: string): Trip {
  const crew = trip.crew.map((m) => {
    let joined = m.joined === trip.mobDate ? mobDate : m.joined;
    let left = m.left === trip.demobDate ? demobDate : m.left;
    if (joined < mobDate) joined = mobDate;
    if (left > demobDate) left = demobDate;
    return { ...m, joined, left };
  });
  return { ...trip, mobDate, demobDate, crew };
}

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const formatDate = (iso: string) => longDate.format(parseISODate(iso));
export const formatShortDate = (iso: string) => shortDate.format(parseISODate(iso));
/** e.g. "3 Sep – 23 Sep 2026". */
export const formatSpan = (from: string, to: string) =>
  from.slice(0, 4) === to.slice(0, 4) ? `${formatShortDate(from)} – ${formatDate(to)}` : `${formatDate(from)} – ${formatDate(to)}`;

export type CrewProblem = { crewId: string; message: string };

/**
 * Things to fix before a trip can be submitted: dates outside the trip,
 * someone listed twice on the same days, or someone already on another vessel.
 */
export function crewProblems(trip: Trip, allTrips: Trip[], people: Record<string, Person>, vessels: Record<string, Vessel>): CrewProblem[] {
  const problems: CrewProblem[] = [];
  for (const m of trip.crew) {
    const name = people[m.personId]?.name ?? "This person";
    if (m.joined > m.left) problems.push({ crewId: m.id, message: "Leave date is before join date." });
    else if (m.joined < trip.mobDate || m.left > trip.demobDate) problems.push({ crewId: m.id, message: "Dates are outside the trip." });

    const twice = trip.crew.find((o) => o.id !== m.id && o.personId === m.personId && o.joined <= m.left && m.joined <= o.left);
    if (twice) problems.push({ crewId: m.id, message: `${name} is listed twice on the same days.` });

    for (const other of allTrips) {
      if (other.id === trip.id) continue;
      const clash = other.crew.find((o) => o.personId === m.personId && o.joined <= m.left && m.joined <= o.left);
      if (clash) {
        problems.push({
          crewId: m.id,
          message: `${name} is on ${vessels[other.vesselId]?.name ?? "another vessel"} (${other.reference}) ${formatSpan(clash.joined, clash.left)}.`,
        });
        break;
      }
    }
  }
  return problems;
}

/** The people from a trip, once each, with their rank on that trip. */
export function uniqueCrew(trip: Trip): { personId: string; role: string }[] {
  const seen = new Map<string, string>();
  for (const m of trip.crew) if (!seen.has(m.personId)) seen.set(m.personId, m.role);
  return [...seen].map(([personId, role]) => ({ personId, role }));
}

/** Who on the personnel list is busy on another vessel between two dates (person id → where). */
export function busyElsewhere(allTrips: Trip[], exceptTripId: string, from: string, to: string, vessels: Record<string, Vessel>): Record<string, string> {
  const busy: Record<string, string> = {};
  for (const t of allTrips) {
    if (t.id === exceptTripId) continue;
    for (const m of t.crew) if (m.joined <= to && from <= m.left) busy[m.personId] = `On ${vessels[t.vesselId]?.name ?? "another vessel"} ${formatSpan(m.joined, m.left)}`;
  }
  return busy;
}

/** What a day is filled with before anyone changes it (see vessel.ts). */
export function defaultCell(m: CrewMember, date: string): DayCell {
  const joinOrLeave = date === m.joined || date === m.left;
  const shift = joinOrLeave && vesselSettings.joinLeaveShift ? vesselSettings.joinLeaveShift : vesselSettings.defaultShift;
  return { shift, hours: shiftType(shift).defaultHours };
}

/** A crew member's day as it stands: their change if there is one, otherwise the default. */
export const cellFor = (trip: Trip, m: CrewMember, date: string): DayCell => trip.cells[m.id]?.[date] ?? defaultCell(m, date);
