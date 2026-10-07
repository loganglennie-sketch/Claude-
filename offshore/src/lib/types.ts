import type { DayType } from "@/config/settings";

export type { DayType };

/** One day of a trip. `hours` is only typed for "custom"; other types use the hours in settings. */
export type Day = { date: string; type: DayType; hours: number; note?: string };

/**
 * Where a trip is up to:
 *   draft     – technician still filling it in
 *   submitted – signed and sent, waiting for the client's supervisor
 *   queried   – supervisor queried one or more days; back with the technician
 *   approved  – supervisor approved it (locked from here on)
 *   ready     – office has checked it and it's ready to invoice
 *   invoiced  – invoice raised
 */
export type TripStatus = "draft" | "submitted" | "queried" | "approved" | "ready" | "invoiced";

/** A signature: a PNG drawn on screen ("data:image/png…"), or a pen path for demo data. */
export type Signature = string;

export type Query = {
  id: string;
  /** The day queried. */
  date: string;
  comment: string;
  byName: string;
  byEmail: string;
  at: string;
  /** Technician's answer when they correct and resubmit. */
  reply?: string;
  resolvedAt?: string;
};

export type Submission = {
  at: string;
  signature: Signature;
  supervisorName: string;
  supervisorEmail: string;
};

export type Approval = { name: string; email: string; at: string; signature: Signature };

export type TripEvent = { id: string; at: string; who: string; what: string };

export type Trip = {
  id: string;
  workerId: string;
  workerName: string;
  installation: string;
  client: string;
  poNumber: string;
  workOrder: string;
  startDate: string;
  endDate: string;
  days: Day[];
  status: TripStatus;
  submission?: Submission;
  /** Secret part of the supervisor's approval link. */
  token?: string;
  queries: Query[];
  approval?: Approval;
  readyAt?: string;
  invoicedAt?: string;
  invoiceNumber?: string;
  events: TripEvent[];
  /** Server's revision number; goes up with every saved change. */
  version: number;
  updatedAt: string;
};

export type Person = { id: string; name: string; pin: string; role: "technician" | "office" };

export type Installation = { name: string; client: string; poNumber: string; workOrder: string; supervisorName: string; supervisorEmail: string };
