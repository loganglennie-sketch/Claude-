/**
 * DEMO ONLY: a made-up fleet so vessel mode has something to show.
 *  - 3 vessels and 25 personnel (staff and agency)
 *  - completed trips with crew changes mid-trip, one trip waiting for
 *    approval, two trips at sea now, and one vessel alongside ready to start a trip.
 * Dates are worked out from today, so the demo always looks current.
 */
import { fakeSignature, seeded } from "../demo-payroll";
import { addDays, toISODate } from "../week";
import { cellFor } from "./trips";
import type { CrewMember, DayCell, Person, Trip, Vessel } from "./types";
import { shiftType, type ShiftCode } from "@/config/vessel";

export const DEMO_VESSELS: Vessel[] = [
  { id: "v1", name: "MV Northern Star", code: "NS", type: "Platform supply vessel" },
  { id: "v2", name: "MV Sea Venture", code: "SV", type: "Standby & rescue vessel" },
  { id: "v3", name: "MV Ocean Pioneer", code: "OP", type: "Survey vessel" },
];

const A1 = "Seacrew Marine";
const A2 = "North Sea Crewing";
export const DEMO_PEOPLE: Person[] = [
  { id: "p01", name: "Alasdair MacKenzie", role: "Master", employment: "staff" },
  { id: "p02", name: "Ruth Henderson", role: "Master", employment: "staff" },
  { id: "p03", name: "Tomasz Nowak", role: "Chief Officer", employment: "agency", agency: A1 },
  { id: "p04", name: "Graeme Stewart", role: "Chief Engineer", employment: "staff" },
  { id: "p05", name: "Marek Kowalski", role: "Chief Engineer", employment: "agency", agency: A1 },
  { id: "p06", name: "Kyle Robertson", role: "AB", employment: "staff" },
  { id: "p07", name: "Jonas Petraitis", role: "AB", employment: "agency", agency: A2 },
  { id: "p08", name: "Liam Watt", role: "OS", employment: "staff" },
  { id: "p09", name: "Shona Murray", role: "Cook", employment: "staff" },
  { id: "p10", name: "Douglas Grant", role: "Master", employment: "staff" },
  { id: "p11", name: "Fiona Cameron", role: "Master", employment: "staff" },
  { id: "p12", name: "Andrius Kazlauskas", role: "Chief Officer", employment: "agency", agency: A2 },
  { id: "p13", name: "Neil Sutherland", role: "Chief Engineer", employment: "staff" },
  { id: "p14", name: "Ross Morrison", role: "2nd Engineer", employment: "staff" },
  { id: "p15", name: "Craig Paterson", role: "AB", employment: "staff" },
  { id: "p16", name: "Darius Vaitkus", role: "AB", employment: "agency", agency: A2 },
  { id: "p17", name: "Mhairi Campbell", role: "Cook", employment: "staff" },
  { id: "p18", name: "Iain Macleod", role: "Master", employment: "staff" },
  { id: "p19", name: "Euan Ferguson", role: "Chief Officer", employment: "staff" },
  { id: "p20", name: "Piotr Zielinski", role: "Chief Officer", employment: "agency", agency: A1 },
  { id: "p21", name: "Stuart Gillespie", role: "Chief Engineer", employment: "staff" },
  { id: "p22", name: "Hamish Duncan", role: "2nd Engineer", employment: "agency", agency: A1 },
  { id: "p23", name: "Callum Burns", role: "AB", employment: "staff" },
  { id: "p24", name: "Rasa Jankauskiene", role: "OS", employment: "agency", agency: A2 },
  { id: "p25", name: "Catriona Bell", role: "Cook", employment: "staff" },
];

type Plan = {
  vesselId: string;
  seq: number;
  /** Days from today. */
  start: number;
  days: number;
  client: string;
  jobNumber: string;
  status: Trip["status"];
  crew: string[];
  /** Mid-trip crew changes: `out` leaves and `in` joins on day `day` (0 = mob day). */
  changes?: { out: string; in: string; day: number }[];
  /** Changes to the grid. */
  tweak?: (set: (personId: string, day: number, shift: ShiftCode, hours?: number) => void) => void;
};

const PLANS: Plan[] = [
  // MV Northern Star: two approved trips, one waiting for approval, one at sea now.
  { vesselId: "v1", seq: 11, start: -69, days: 21, client: "Harbour Energy", jobNumber: "HE-4471", status: "approved", crew: ["p01", "p03", "p04", "p06", "p08", "p09"], changes: [{ out: "p04", in: "p05", day: 10 }] },
  { vesselId: "v1", seq: 12, start: -48, days: 21, client: "Harbour Energy", jobNumber: "HE-4471", status: "approved", crew: ["p02", "p03", "p05", "p07", "p08", "p09"] },
  {
    vesselId: "v1", seq: 13, start: -27, days: 21, client: "TAQA", jobNumber: "TQ-20931", status: "submitted",
    crew: ["p01", "p03", "p04", "p06", "p07", "p09"],
    changes: [{ out: "p06", in: "p08", day: 12 }],
    tweak: (set) => {
      set("p06", 11, "sick");
      for (const d of [6, 7]) for (const p of ["p01", "p03", "p04", "p06", "p07", "p09"]) set(p, d, "standby");
    },
  },
  { vesselId: "v1", seq: 14, start: -6, days: 21, client: "TAQA", jobNumber: "TQ-20931", status: "in_progress", crew: ["p02", "p03", "p05", "p07", "p08", "p09"] },

  // MV Sea Venture: standby vessel with night watches; at sea now with a master change done.
  {
    vesselId: "v2", seq: 7, start: -63, days: 21, client: "Ithaca Energy", jobNumber: "ITH-8812", status: "approved",
    crew: ["p10", "p12", "p13", "p15", "p16", "p17"],
    changes: [{ out: "p13", in: "p14", day: 11 }],
    tweak: (set) => {
      for (let d = 1; d < 20; d++) set("p16", d, "night");
    },
  },
  {
    vesselId: "v2", seq: 8, start: -42, days: 21, client: "Ithaca Energy", jobNumber: "ITH-8812", status: "approved",
    crew: ["p11", "p12", "p14", "p15", "p16", "p17"],
    tweak: (set) => {
      for (let d = 1; d < 20; d++) set("p15", d, "night");
    },
  },
  {
    vesselId: "v2", seq: 9, start: -14, days: 21, client: "Ithaca Energy", jobNumber: "ITH-9034", status: "in_progress",
    crew: ["p10", "p12", "p13", "p15", "p16", "p17"],
    changes: [{ out: "p10", in: "p11", day: 11 }],
    tweak: (set) => {
      for (let d = 1; d < 14; d++) set("p16", d, "night");
    },
  },

  // MV Ocean Pioneer: two approved trips, alongside now (ready for a new trip).
  {
    vesselId: "v3", seq: 4, start: -55, days: 21, client: "Fugro", jobNumber: "FG-30117", status: "approved",
    crew: ["p18", "p19", "p21", "p23", "p24", "p25"],
    changes: [{ out: "p19", in: "p20", day: 8 }],
  },
  {
    vesselId: "v3", seq: 5, start: -30, days: 21, client: "Fugro", jobNumber: "FG-30152", status: "approved",
    crew: ["p18", "p20", "p21", "p22", "p23", "p25"],
    tweak: (set) => {
      for (const d of [5, 6]) for (const p of ["p18", "p20", "p21", "p22", "p23", "p25"]) set(p, d, "standby");
      set("p22", 15, "off");
    },
  },
];

const MASTERS = new Set(DEMO_PEOPLE.filter((p) => p.role === "Master").map((p) => p.id));

function buildTrip(plan: Plan, today: string): Trip {
  const vessel = DEMO_VESSELS.find((v) => v.id === plan.vesselId)!;
  const mobDate = addDays(today, plan.start);
  const demobDate = addDays(mobDate, plan.days - 1);
  const role = (id: string) => DEMO_PEOPLE.find((p) => p.id === id)!.role;
  const crew: CrewMember[] = plan.crew.map((personId) => ({ id: `c_${vessel.code}${plan.seq}_${personId}`, personId, role: role(personId), joined: mobDate, left: demobDate }));
  for (const c of plan.changes ?? []) {
    const date = addDays(mobDate, c.day);
    crew.find((m) => m.personId === c.out)!.left = date;
    crew.push({ id: `c_${vessel.code}${plan.seq}_${c.in}`, personId: c.in, role: role(c.in), joined: date, left: demobDate });
  }

  const trip: Trip = {
    id: `t_${vessel.code}${plan.seq}`,
    vesselId: vessel.id,
    reference: `${vessel.code}-${mobDate.slice(0, 4)}-${String(plan.seq).padStart(3, "0")}`,
    mobDate,
    demobDate,
    client: plan.client,
    jobNumber: plan.jobNumber,
    crew,
    cells: {},
    status: plan.status,
    createdAt: `${mobDate}T07:00:00.000Z`,
    updatedAt: `${mobDate}T07:00:00.000Z`,
  };

  plan.tweak?.((personId, day, shift, hours) => {
    const date = addDays(mobDate, day);
    const m = crew.find((c) => c.personId === personId && c.joined <= date && date <= c.left);
    if (!m) return;
    const cell: DayCell = { shift, hours: hours ?? shiftType(shift).defaultHours };
    const current = cellFor(trip, m, date);
    if (current.shift === cell.shift && current.hours === cell.hours) return;
    trip.cells[m.id] = { ...trip.cells[m.id], [date]: cell };
  });

  if (plan.status !== "in_progress") {
    // The master on board on the last day signs; the office approves two days later.
    const rand = seeded(trip.id);
    const master = crew.find((m) => MASTERS.has(m.personId) && m.left === demobDate) ?? crew[0];
    const masterName = DEMO_PEOPLE.find((p) => p.id === master.personId)!.name;
    trip.submittedAt = `${demobDate}T17:${String(10 + Math.floor(rand() * 40))}:00.000Z`;
    trip.signedBy = masterName;
    trip.signaturePath = fakeSignature(masterName, rand);
    trip.updatedAt = trip.submittedAt;
    if (plan.status === "approved") {
      trip.approvedAt = `${addDays(demobDate, 2)}T10:${String(10 + Math.floor(rand() * 40))}:00.000Z`;
      trip.approvedBy = "Office Demo";
      trip.updatedAt = trip.approvedAt;
    }
  }
  return trip;
}

/** A fresh copy of the demo fleet, with dates worked out from today. */
export function demoFleet(today = toISODate(new Date())) {
  return {
    vessels: DEMO_VESSELS,
    people: DEMO_PEOPLE,
    trips: PLANS.map((p) => buildTrip(p, today)),
  };
}
