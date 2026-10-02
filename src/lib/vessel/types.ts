/**
 * Vessel mode data: Company → Vessels → Trips → Crew on that trip.
 * Dates are plain "YYYY-MM-DD" strings (see week.ts).
 */
import type { ShiftCode } from "@/config/vessel";

export type Vessel = {
  id: string;
  name: string;
  /** Short code used in trip references, e.g. "NS" → NS-2026-014. */
  code: string;
  /** e.g. "Platform supply vessel". */
  type: string;
};

/** Someone on the company-wide personnel list (managed by the office). */
export type Person = {
  id: string;
  name: string;
  /** Usual rank, e.g. "Chief Engineer". */
  role: string;
  employment: "staff" | "agency";
  /** Agency name, for agency crew. */
  agency?: string;
};

/** One spell on board: a person's join and leave dates on this trip. */
export type CrewMember = {
  id: string;
  personId: string;
  /** Rank on this trip (usually the person's own role). */
  role: string;
  /** First day on board (inclusive). */
  joined: string;
  /** Last day on board (inclusive). */
  left: string;
};

/** A day in the grid that differs from the default. */
export type DayCell = { shift: ShiftCode; hours: number };

/**
 * in_progress – being filled in on board
 * submitted   – signed by the master, waiting for the office
 * queried     – the office sent lines back with comments
 * approved    – signed off by the office and locked
 */
export type TripStatus = "in_progress" | "submitted" | "queried" | "approved";

/** A question from the office about one line (person) of a trip sheet. */
export type TripQuery = {
  id: string;
  /** The crew line being queried. */
  crewId: string;
  /** A particular day, if the query is about one day. */
  date?: string;
  comment: string;
  /** Who in the office asked, and when (ISO timestamp). */
  by: string;
  at: string;
  /** Set when the vessel sends the sheet back in (stage 3). */
  answeredAt?: string;
};

export type Trip = {
  id: string;
  vesselId: string;
  /** e.g. "NS-2026-014". */
  reference: string;
  /** Mobilisation: first day of the trip. */
  mobDate: string;
  /** Demobilisation: last day of the trip (planned until the trip is submitted). */
  demobDate: string;
  client: string;
  /** Client / charter / job number, used for invoicing. */
  jobNumber: string;
  crew: CrewMember[];
  /** Changes from the default, by crew member id then date. Filled in from stage 2. */
  cells: Record<string, Record<string, DayCell>>;
  status: TripStatus;
  createdAt: string;
  /** ISO timestamp of the last change, for syncing. */
  updatedAt: string;
  submittedAt?: string;
  /** Master who signed the trip sheet. */
  signedBy?: string;
  /** PNG data URL of the master's signature. */
  signature?: string;
  /** Demo data only: signature as an SVG path (300×90 box). */
  signaturePath?: string;
  approvedAt?: string;
  approvedBy?: string;
  /** Office queries, oldest first. */
  queries?: TripQuery[];
};
