import { dayMinutes, formatDecimalHours, weekTotals } from "./hours";
import type { Timesheet } from "./types";
import { addDays, formatShortDay, weekDates } from "./week";

type CsvRow = { name: string; status: string; sheet: Timesheet | null };

/** One line per worker, decimal hours, ready for payroll software. */
export function weekToCsv(weekStart: string, rows: CsvRow[]): string {
  const dates = weekDates(weekStart);
  const header = [
    "Worker", "Week start", "Week end", "Status", "Reference",
    ...dates.map((d) => `${formatShortDay(d)} ${d}`),
    "Basic hours", "Overtime hours", "Total hours", "Submitted at", "Approved at",
  ];
  const lines = rows.map(({ name, status, sheet }) => {
    const totals = sheet ? weekTotals(sheet.days) : null;
    return [
      name, weekStart, addDays(weekStart, 6), status, sheet?.reference ?? "",
      ...dates.map((_, i) => (sheet ? formatDecimalHours(dayMinutes(sheet.days[i]).minutes) : "")),
      totals ? formatDecimalHours(totals.totalMinutes - totals.overtimeMinutes) : "",
      totals ? formatDecimalHours(totals.overtimeMinutes) : "",
      totals ? formatDecimalHours(totals.totalMinutes) : "",
      sheet?.submittedAt ?? "", sheet?.approvedAt ?? "",
    ];
  });
  const escape = (value: string) => {
    // A leading ' stops spreadsheet programs treating text like "=SUM(...)" as a formula.
    const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  // The leading ﻿ helps Excel read names with accents correctly.
  return "﻿" + [header, ...lines].map((r) => r.map(escape).join(",")).join("\r\n") + "\r\n";
}
