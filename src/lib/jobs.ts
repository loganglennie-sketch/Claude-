import type { DayEntry, JobEntry, Timesheet } from "./types";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export function newJobEntry(fields: Partial<JobEntry> = {}): JobEntry {
  return { id: newId(), jobNumber: "", mode: "hours", hours: "", start: "", finish: "", breakMins: 0, ...fields };
}

/** Copies of a day's entries with fresh ids (for "Same as previous day"). */
export function copyJobs(jobs: JobEntry[]): JobEntry[] {
  return jobs.map((j) => ({ ...j, id: newId() }));
}

type OldDay = { date: string; worked: boolean; start?: string; finish?: string; breakMins?: number; job?: string; jobs?: JobEntry[] };

/** Brings timesheets saved before multiple jobs existed up to date. */
export function normaliseTimesheet(sheet: Timesheet): Timesheet {
  if (sheet.days.every((d) => Array.isArray((d as OldDay).jobs))) return sheet;
  return {
    ...sheet,
    days: (sheet.days as OldDay[]).map((d): DayEntry => {
      if (Array.isArray(d.jobs)) return { date: d.date, worked: d.worked, jobs: d.jobs };
      const hasOldEntry = !!(d.start || d.finish || d.job);
      return {
        date: d.date,
        worked: d.worked,
        jobs: hasOldEntry
          ? [newJobEntry({ jobNumber: d.job ?? "", mode: "times", start: d.start ?? "", finish: d.finish ?? "", breakMins: d.breakMins ?? 0 })]
          : d.worked ? [newJobEntry()] : [],
      };
    }),
  };
}

/**
 * For companies that record start and finish times only: makes sure every
 * entry in a timesheet still being filled in uses times.
 */
export function withTimesForEveryEntry(sheet: Timesheet): Timesheet {
  if (sheet.status !== "draft" || sheet.days.every((d) => d.jobs.every((j) => j.mode === "times"))) return sheet;
  return { ...sheet, days: sheet.days.map((d) => ({ ...d, jobs: d.jobs.map((j) => (j.mode === "times" ? j : { ...j, mode: "times" as const })) })) };
}
