/**
 * The daily trip sheet: one cell per crew member per day on board.
 * Cells only store changes from the default (see defaultCell in trips.ts),
 * so moving someone's join or leave date keeps the rest of the sheet right.
 */
import { SHIFT_TYPES, shiftType, type ShiftCode } from "@/config/vessel";
import { cellFor, datesBetween, defaultCell, isOnBoard } from "./trips";
import type { CrewMember, DayCell, Trip } from "./types";

export type CellRef = { memberId: string; date: string };

/**
 * Sets (or with null, resets to the default) every given cell the person was
 * on board for. Cells that end up the same as the default aren't stored.
 */
export function withCells(trip: Trip, refs: CellRef[], cell: DayCell | null): Trip {
  const cells: Trip["cells"] = { ...trip.cells };
  for (const { memberId, date } of refs) {
    const m = trip.crew.find((c) => c.id === memberId);
    if (!m || !isOnBoard(m, date)) continue;
    const row = { ...cells[memberId] };
    const d = defaultCell(m, date);
    if (!cell || (cell.shift === d.shift && cell.hours === d.hours)) delete row[date];
    else row[date] = cell;
    if (Object.keys(row).length) cells[memberId] = row;
    else delete cells[memberId];
  }
  return { ...trip, cells };
}

/** True if someone changed this cell from the default. */
export const isChanged = (trip: Trip, memberId: string, date: string) => !!trip.cells[memberId]?.[date];

/** Hours as entered, with no trailing ".0" (12, 11.5). */
export const formatHours = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, ""));

/** Accepts "12", "11.5", "11,5" or "11:30". Null if it isn't a sensible number of hours in a day. */
export function parseHours(input: string): number | null {
  const s = input.trim().replace(",", ".");
  let h: number;
  const hm = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (hm) h = Number(hm[1]) + Number(hm[2]) / 60;
  else if (/^\d{1,2}(\.\d{1,2})?$/.test(s)) h = Number(s);
  else return null;
  return h >= 0 && h <= 24 ? Math.round(h * 100) / 100 : null;
}

export type PersonTotals = {
  /** Days on board. */
  days: number;
  /** Days of each shift type. */
  byShift: Record<ShiftCode, number>;
  /** Paid days (see paidDay in vessel.ts). */
  paidDays: number;
  hours: number;
};

const emptyByShift = () => Object.fromEntries(SHIFT_TYPES.map((s) => [s.code, 0])) as Record<ShiftCode, number>;

export function memberTotals(trip: Trip, m: CrewMember): PersonTotals {
  const totals: PersonTotals = { days: 0, byShift: emptyByShift(), paidDays: 0, hours: 0 };
  for (const date of datesBetween(m.joined, m.left)) {
    const cell = cellFor(trip, m, date);
    totals.days++;
    totals.byShift[cell.shift]++;
    if (shiftType(cell.shift).paidDay) totals.paidDays++;
    totals.hours += cell.hours;
  }
  return totals;
}

/** People on board and hours worked on one day. */
export function dayTotals(trip: Trip, date: string): { onBoard: number; hours: number } {
  const crew = trip.crew.filter((m) => isOnBoard(m, date));
  return { onBoard: crew.length, hours: crew.reduce((n, m) => n + cellFor(trip, m, date).hours, 0) };
}

export function tripTotals(trip: Trip): PersonTotals {
  const totals: PersonTotals = { days: 0, byShift: emptyByShift(), paidDays: 0, hours: 0 };
  for (const m of trip.crew) {
    const t = memberTotals(trip, m);
    totals.days += t.days;
    totals.paidDays += t.paidDays;
    totals.hours += t.hours;
    for (const s of SHIFT_TYPES) totals.byShift[s.code] += t.byShift[s.code];
  }
  return totals;
}
