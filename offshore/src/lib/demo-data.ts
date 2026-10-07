/**
 * Made-up demo data: Granite Offshore Services, 6 technicians on 2 installations.
 * Dates are worked out from today, so the demo always looks current.
 * Every company, person and email address here is invented (.example addresses can't receive mail).
 */
import { addDays, parseISODate, todayISO } from "./dates";
import { DEFAULT_PATTERN, daysFor, newToken, type Pattern } from "./trip";
import type { Day, Installation, Person, Trip, TripStatus } from "./types";
import type { ServerData } from "./demo-server";

export const DEMO_TECH_PIN = "1234";
export const DEMO_OFFICE = { name: "Office Demo", pin: "0000" };

const PEOPLE: Person[] = [
  { id: "t-callum", name: "Callum Reid", pin: DEMO_TECH_PIN, role: "technician" },
  { id: "t-aisha", name: "Aisha Bello", pin: DEMO_TECH_PIN, role: "technician" },
  { id: "t-ewan", name: "Ewan Murray", pin: DEMO_TECH_PIN, role: "technician" },
  { id: "t-kasia", name: "Kasia Nowak", pin: DEMO_TECH_PIN, role: "technician" },
  { id: "t-liam", name: "Liam O'Neill", pin: DEMO_TECH_PIN, role: "technician" },
  { id: "t-priya", name: "Priya Shah", pin: DEMO_TECH_PIN, role: "technician" },
  { id: "office", name: DEMO_OFFICE.name, pin: DEMO_OFFICE.pin, role: "office" },
];

const CORRIE: Installation = {
  name: "Corrie Alpha",
  client: "Northfield Energy",
  poNumber: "NFE-PO-48213",
  workOrder: "WO-22071 Instrument maintenance",
  supervisorName: "Graham Watt",
  supervisorEmail: "graham.watt@northfield-energy.example",
};
const BRIGHTWATER: Installation = {
  name: "Brightwater FPSO",
  client: "Sealark Petroleum",
  poNumber: "SLP-77310",
  workOrder: "CC-4410 E&I support",
  supervisorName: "Fiona Mackay",
  supervisorEmail: "fiona.mackay@sealark.example",
};

/** A moment on a given day, e.g. at(T, -1, 18, 30) = yesterday 18:30. */
function at(today: string, dayOffset: number, hour: number, minute = 0) {
  const d = parseISODate(addDays(today, dayOffset));
  d.setHours(hour, minute);
  return d.toISOString();
}

/** A squiggle that looks enough like a signature, inside a 300×90 box (same as the timesheet app's demo). */
export function fakeSignature(name: string, seed: number): string {
  let s = seed;
  const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let x = 18;
  let d = `M ${x} ${55 + rand() * 10}`;
  for (const ch of name.replace(/[^a-z]/gi, "").slice(0, 12)) {
    const tall = /[A-Zbdfhklt]/.test(ch);
    const top = tall ? 12 + rand() * 10 : 36 + rand() * 8;
    const w = 12 + rand() * 8;
    d += ` C ${x + w * 0.2} ${top}, ${x + w * 0.9} ${top}, ${x + w * 0.6} ${60 + rand() * 6}`;
    d += ` S ${x + w * 1.1} ${48 + rand() * 8}, ${x + w} ${58 + rand() * 6}`;
    x += w * 0.85;
    if (x > 250) break;
  }
  d += ` M 20 ${74 + rand() * 4} Q ${x / 2} ${66 + rand() * 6}, ${Math.min(x + 20, 285)} ${70 + rand() * 6}`;
  return `svg:${d}`;
}

type Spec = {
  id: string;
  worker: Person;
  site: Installation;
  from: number; // days from today
  to: number;
  pattern?: Partial<Pattern>;
  exceptions?: Record<number, Partial<Day>>; // keyed by days from today
  status: TripStatus;
  submittedAt?: string;
  approvedAt?: string;
  readyAt?: string;
  invoicedAt?: string;
  invoiceNumber?: string;
};

function buildTrip(today: string, spec: Spec, seed: number): Trip {
  const start = addDays(today, spec.from);
  const end = addDays(today, spec.to);
  const days = daysFor(start, end, { ...DEFAULT_PATTERN, ...spec.pattern }).map((d) => {
    const offset = Math.round((parseISODate(d.date).getTime() - parseISODate(today).getTime()) / 86_400_000);
    return { ...d, ...spec.exceptions?.[offset] };
  });
  const who = spec.worker.name;
  const supervisor = `${spec.site.supervisorName} (${spec.site.supervisorEmail})`;
  const events: Trip["events"] = [{ id: `${spec.id}-e1`, at: at(today, spec.from - 1, 19), who, what: "Started the trip" }];
  const trip: Trip = {
    id: spec.id,
    workerId: spec.worker.id,
    workerName: who,
    installation: spec.site.name,
    client: spec.site.client,
    poNumber: spec.site.poNumber,
    workOrder: spec.site.workOrder,
    startDate: start,
    endDate: end,
    days,
    status: spec.status,
    queries: [],
    events,
    version: 1,
    updatedAt: at(today, 0, 7),
  };
  if (spec.submittedAt) {
    trip.submission = {
      at: spec.submittedAt,
      signature: fakeSignature(who, seed),
      supervisorName: spec.site.supervisorName,
      supervisorEmail: spec.site.supervisorEmail,
    };
    trip.token = newToken();
    events.push({ id: `${spec.id}-e2`, at: spec.submittedAt, who, what: `Signed and sent to ${spec.site.supervisorEmail} for approval` });
  }
  if (spec.approvedAt) {
    trip.approval = { name: spec.site.supervisorName, email: spec.site.supervisorEmail, at: spec.approvedAt, signature: fakeSignature(spec.site.supervisorName, seed + 7) };
    events.push({ id: `${spec.id}-e3`, at: spec.approvedAt, who: supervisor, what: "Approved the trip" });
  }
  if (spec.readyAt) {
    trip.readyAt = spec.readyAt;
    events.push({ id: `${spec.id}-e4`, at: spec.readyAt, who: DEMO_OFFICE.name, what: "Checked and marked ready to invoice" });
  }
  if (spec.invoicedAt) {
    trip.invoicedAt = spec.invoicedAt;
    trip.invoiceNumber = spec.invoiceNumber;
    events.push({ id: `${spec.id}-e5`, at: spec.invoicedAt, who: DEMO_OFFICE.name, what: `Marked invoiced (invoice ${spec.invoiceNumber})` });
  }
  return trip;
}

export function buildDemoData(): ServerData {
  const T = todayISO();
  const [callum, aisha, ewan, kasia, liam, priya] = PEOPLE;
  const specs: Spec[] = [
    // Callum: an older trip already invoiced, and last trip waiting for the client.
    {
      id: "trip-callum-1", worker: callum, site: CORRIE, from: -42, to: -29, status: "invoiced",
      submittedAt: at(T, -29, 20, 10), approvedAt: at(T, -27, 9, 40), readyAt: at(T, -26, 11), invoicedAt: at(T, -22, 15), invoiceNumber: "INV-1042",
    },
    {
      id: "trip-callum-2", worker: callum, site: CORRIE, from: -14, to: -1, status: "submitted", submittedAt: at(T, -1, 18, 30),
      exceptions: { [-9]: { type: "custom", hours: 14, note: "Extended shift to finish shutdown checks" } },
    },
    // Aisha: QUERIED. The supervisor says one day was a weather day, not a day shift.
    {
      id: "trip-aisha-1", worker: aisha, site: CORRIE, from: -14, to: -1, status: "queried", submittedAt: at(T, -1, 19, 5),
    },
    // Ewan: APPROVED by the client, waiting for the office to check it.
    {
      id: "trip-ewan-1", worker: ewan, site: CORRIE, from: -21, to: -8, status: "approved", submittedAt: at(T, -8, 17, 45), approvedAt: at(T, -6, 10, 15),
      exceptions: { [-15]: { type: "standby", note: "Weather: no crane operations" } },
    },
    // Kasia: nights, approved and checked, ready to invoice.
    {
      id: "trip-kasia-1", worker: kasia, site: BRIGHTWATER, from: -21, to: -8, status: "ready", pattern: { shift: "night" },
      submittedAt: at(T, -8, 16, 20), approvedAt: at(T, -7, 8, 50), readyAt: at(T, -5, 14, 30),
    },
    // Liam: one sick day, waiting for the client.
    {
      id: "trip-liam-1", worker: liam, site: BRIGHTWATER, from: -16, to: -3, status: "submitted", submittedAt: at(T, -2, 12, 0),
      exceptions: { [-10]: { type: "sick", note: "Stomach bug, seen by medic" } },
    },
    // Priya: offshore now, trip still being filled in.
    { id: "trip-priya-1", worker: priya, site: BRIGHTWATER, from: -7, to: 6, status: "draft" },
  ];
  const trips = Object.fromEntries(specs.map((s, i) => [s.id, buildTrip(T, s, i * 31 + 5)]));

  // Aisha's query.
  const aishaTrip = trips["trip-aisha-1"];
  const queriedDay = addDays(T, -5);
  const queriedAt = at(T, 0, 8, 20);
  aishaTrip.queries.push({
    id: "q-aisha-1",
    date: queriedDay,
    comment: "Helideck was closed all day and no work was done. Please change this to a standby / weather day.",
    byName: CORRIE.supervisorName,
    byEmail: CORRIE.supervisorEmail,
    at: queriedAt,
  });
  aishaTrip.events.push({ id: "trip-aisha-1-e3", at: queriedAt, who: `${CORRIE.supervisorName} (${CORRIE.supervisorEmail})`, what: "Queried 1 day" });

  return { people: PEOPLE, installations: [CORRIE, BRIGHTWATER], trips, seededAt: new Date().toISOString() };
}
