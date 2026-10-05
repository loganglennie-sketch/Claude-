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
  /** Travel time for this job, typed as hours (e.g. "1" or "1.5"). Recorded separately, not added to hours worked. */
  travel?: string;
};

export type DayEntry = {
  /** Calendar date, YYYY-MM-DD. */
  date: string;
  worked: boolean;
  /** Not worked because of holiday or sickness (only when worked is false). */
  absence?: "holiday" | "sick";
  /** Stayed away from home that night (Bench Mark Scale Rate / work away allowance). */
  away?: boolean;
  /** Claiming the food allowance for that day. */
  food?: boolean;
  /** Each job worked that day. */
  jobs: JobEntry[];
};

/** Money spent for work, e.g. materials or parking. Receipts are handed in. */
export type Expense = {
  id: string;
  jobNumber: string;
  /** Pounds as typed, e.g. "12.50". */
  amount: string;
  description: string;
};

export type TimesheetStatus = "draft" | "submitted" | "approved";

export type Timesheet = {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  days: DayEntry[];
  /** Companies with allowances switched on: expenses claimed this week. */
  expenses?: Expense[];
  /** Anything else the worker wants to tell the office ("other details"). */
  notes?: string;
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
  /** Live, on this phone only: signed with no signal, waiting to send. */
  queued?: boolean;
  /** Live, on this phone only: a queued timesheet the database refused (why). */
  sendError?: string;
};
