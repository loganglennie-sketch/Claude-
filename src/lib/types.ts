/** One piece of work on a day: a job number and how long was spent on it. */
export type JobEntry = {
  id: string;
  /** Job number as typed, e.g. "1042". Feeds the job costing export. */
  jobNumber: string;
  /** "hours": hours typed straight in. "times": worked out from start/finish minus break. */
  mode: "hours" | "times";
  /** Hours as typed, e.g. "3.5" or "3:30". Used when mode is "hours". */
  hours: string;
  /** "HH:MM" (24h) or "". Used when mode is "times". */
  start: string;
  finish: string;
  breakMins: number;
};

export type DayEntry = {
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  worked: boolean;
  /** Each job worked that day. */
  jobs: JobEntry[];
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
