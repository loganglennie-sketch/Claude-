export type DayEntry = {
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  worked: boolean;
  /** "HH:MM" (24h) or "" when not filled in yet. */
  start: string;
  finish: string;
  breakMins: number;
  job: string;
};

export type TimesheetStatus = "draft" | "submitted" | "approved";

export type Timesheet = {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  days: DayEntry[];
  status: TimesheetStatus;
  reference?: string;
  /** ISO timestamp. */
  submittedAt?: string;
  /** PNG data URL of the worker's signature. */
  signature?: string;
  /** Demo data only: signature as an SVG path (300×90 box) instead of an image. */
  signaturePath?: string;
  /** ISO timestamp. */
  approvedAt?: string;
};
