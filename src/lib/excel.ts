/**
 * Builds the weekly Excel workbook for the office:
 *   1. Job entries            – one row per job entry with clock times (for job costing)
 *   2. Daily & weekly totals  – one row per employee, hours per day and total hours worked
 *   3. Hours by job           – grouped by job number: who worked on it and job totals
 * No pay is worked out here; the company's own program applies its pay rules.
 */
import ExcelJS from "exceljs";
import { brand } from "@/config/brand";
import { dayJobTotals, dayMinutes, dayTimeline, formatClock, formatHM, travelMinutes, weekTotals, type EntrySpan } from "./hours";
import type { JobEntry, Timesheet } from "./types";
import { formatDayName, formatShortDay, parseISODate, weekDates } from "./week";

export type ExportRow = { name: string; status: string; sheet: Timesheet | null };
type Colours = { primary: string; primarySoft: string };
export type WorkbookOptions = {
  colours?: Colours;
  showOvertime?: boolean;
  /** Company records travel, nights away, food and expenses (adds those columns). */
  allowances?: { awayShort: string; foodShort: string };
};

const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;
/** Real Excel dates, pinned to midnight UTC so they never shift a day. */
const excelDate = (iso: string) => {
  const d = parseISODate(iso);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};
/** Real Excel time of day (fraction of a day), shown as hh:mm. */
const excelTime = (minutes: number) => (((minutes % 1440) + 1440) % 1440) / 1440;
/** Plain numbers stay numbers in Excel; anything with letters or a leading 0 stays as typed. */
const jobCell = (job: string) => (/^[1-9]\d{0,14}$/.test(job) ? Number(job) : job);
const byJob = (a: string, b: string) => a.localeCompare(b, "en-GB", { numeric: true });

/** One job entry, ready to become a row on the "Job entries" sheet. */
type EntryLine = {
  employee: string;
  date: string;
  entry: JobEntry;
  span: EntrySpan | null;
  minutes: number;
  gapBefore: { from: number; to: number; minutes: number } | null;
};

/**
 * Columns of the "Job entries" sheet, in order. To match the job costing
 * program's import layout, reorder, rename or remove entries in this list.
 */
export const JOB_ENTRY_COLUMNS: { header: string; width: number; numFmt?: string; allowancesOnly?: boolean; value: (l: EntryLine) => ExcelJS.CellValue }[] = [
  { header: "Employee", width: 22, value: (l) => l.employee },
  { header: "Date", width: 12, numFmt: "dd/mm/yyyy", value: (l) => excelDate(l.date) },
  { header: "Day", width: 11, value: (l) => formatDayName(l.date) },
  { header: "Job number", width: 12, value: (l) => jobCell(l.entry.jobNumber.trim().toUpperCase()) },
  { header: "Start", width: 8, numFmt: "hh:mm", value: (l) => (l.span ? excelTime(l.span.start) : null) },
  { header: "Finish", width: 8, numFmt: "hh:mm", value: (l) => (l.span ? excelTime(l.span.end) : null) },
  { header: "Break (mins)", width: 12, value: (l) => (l.span ? l.entry.breakMins || 0 : null) },
  { header: "Hours", width: 8, numFmt: "0.00", value: (l) => hours(l.minutes) },
  { header: "Overnight", width: 10, value: (l) => (l.span?.overnight ? "Yes" : "No") },
  { header: "Travel (hours)", width: 13, numFmt: "0.00", allowancesOnly: true, value: (l) => (travelMinutes(l.entry) ? hours(travelMinutes(l.entry)!) : null) },
  {
    header: "Gap before this job",
    width: 22,
    value: (l) => (l.gapBefore ? `${formatClock(l.gapBefore.from)}–${formatClock(l.gapBefore.to)} (${formatHM(l.gapBefore.minutes)})` : null),
  },
];

export async function buildWeekWorkbook(weekStart: string, rows: ExportRow[], companyName: string, options: WorkbookOptions = {}): Promise<ArrayBuffer> {
  const { colours = brand.colours, showOvertime = brand.showOvertime, allowances } = options;
  const entryColumns = JOB_ENTRY_COLUMNS.filter((c) => !c.allowancesOnly || allowances);
  const wb = new ExcelJS.Workbook();
  wb.creator = companyName;
  wb.created = new Date();
  const dates = weekDates(weekStart);
  const dayHeaders = dates.map((d) => `${formatShortDay(d)} ${d.slice(8, 10)}/${d.slice(5, 7)}`);
  const employees = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const submitted = employees.filter((r) => r.sheet);

  const header = (ws: ExcelJS.Worksheet, labels: string[]) => {
    const row = ws.addRow(labels);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(colours.primary) } };
    row.alignment = { vertical: "middle" };
    row.height = 20;
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  const totalStyle = (row: ExcelJS.Row) => {
    row.font = { bold: true };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(colours.primarySoft) } };
  };
  const col = (n: number) => String.fromCharCode(64 + n); // 1 → A (enough for these sheets)
  /** Adds up a column so totals show even in viewers that don't recalculate formulas. */
  const sumOf = (ws: ExcelJS.Worksheet, c: number, rowNumbers: number[]) =>
    Math.round(
      rowNumbers.reduce((n, r) => {
        const v = ws.getRow(r).getCell(c).value;
        const num = typeof v === "number" ? v : v && typeof v === "object" && "result" in v ? Number(v.result) || 0 : 0;
        return n + num;
      }, 0) * 100,
    ) / 100;
  const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

  // ── 1. Job entries (one row per entry, no totals, so it imports cleanly) ──
  const lines: EntryLine[] = [];
  for (const r of submitted) {
    for (const day of r.sheet!.days) {
      let previous: { kind: string; from?: number; to?: number; minutes: number } | null = null;
      for (const item of dayTimeline(day).items) {
        if (item.kind === "job") {
          const gapBefore = previous?.kind === "gap" ? { from: previous.from!, to: previous.to!, minutes: previous.minutes } : null;
          lines.push({ employee: r.name, date: day.date, entry: item.entry, span: item.span, minutes: item.minutes, gapBefore });
        }
        previous = item;
      }
    }
  }
  const entries = wb.addWorksheet("Job entries");
  header(entries, entryColumns.map((c) => c.header));
  for (const l of lines) entries.addRow(entryColumns.map((c) => c.value(l)));
  entryColumns.forEach((c, i) => {
    const column = entries.getColumn(i + 1);
    column.width = c.width;
    if (c.numFmt) column.numFmt = c.numFmt;
  });
  if (lines.length === 0) entries.addRow(["No submitted timesheets for this week yet"]);

  // ── 2. Daily & weekly totals ─────────────────────────────────────────
  // Days show hours worked, or "Holiday" / "Sick" (text, so SUM skips it).
  const pay = wb.addWorksheet("Daily & weekly totals");
  const extraHeaders = [
    "Total hours worked",
    ...(showOvertime ? ["Overtime hours"] : []),
    "Holiday days",
    "Sick days",
    ...(allowances ? ["Travel hours", `${allowances.awayShort} nights`, `${allowances.foodShort} (days)`, "Expenses (£)"] : []),
  ];
  header(pay, ["Employee", "Status", ...dayHeaders, ...extraHeaders, "Other details"]);
  for (const r of employees) {
    if (!r.sheet) {
      pay.addRow([r.name, r.status]);
      continue;
    }
    const totals = weekTotals(r.sheet.days, r.sheet.expenses);
    pay.addRow([
      r.name,
      r.status,
      ...r.sheet.days.map((d) => (d.worked ? hours(dayMinutes(d).minutes) : d.absence === "holiday" ? "Holiday" : d.absence === "sick" ? "Sick" : null)),
      hours(totals.totalMinutes),
      ...(showOvertime ? [hours(totals.overtimeMinutes)] : []),
      totals.holidayDays || null,
      totals.sickDays || null,
      ...(allowances ? [totals.travelMinutes ? hours(totals.travelMinutes) : null, totals.awayNights || null, totals.foodDays || null, totals.expensesPence ? totals.expensesPence / 100 : null] : []),
      r.sheet.notes?.trim() || null,
    ]);
  }
  const lastPay = pay.rowCount;
  const numericCols = 7 + extraHeaders.length;
  const payTotal = pay.addRow([
    "Total",
    `${submitted.length} of ${employees.length} submitted`,
    ...Array.from({ length: numericCols }, (_, i) => ({
      formula: `SUM(${col(3 + i)}2:${col(3 + i)}${lastPay})`,
      result: sumOf(pay, 3 + i, range(2, lastPay)),
    })),
  ]);
  totalStyle(payTotal);
  pay.columns.forEach((c, i) => {
    const header = String(pay.getRow(1).getCell(i + 1).value ?? "");
    c.width = i === 0 ? 24 : i === 1 ? 20 : header === "Other details" ? 50 : header.length > 11 ? header.length + 2 : 11;
    if (i >= 2 && i < 2 + numericCols) c.numFmt = header === "Expenses (£)" ? "£0.00" : /days|nights/i.test(header) ? "0" : "0.00";
  });

  // ── 3. Hours by job ─────────────────────────────────────────────────
  // job → employee → minutes per day
  const jobs = new Map<string, Map<string, number[]>>();
  for (const r of submitted) {
    r.sheet!.days.forEach((day, i) => {
      for (const { jobNumber, minutes } of dayJobTotals(day)) {
        const people = jobs.get(jobNumber) ?? new Map<string, number[]>();
        const perDay = people.get(r.name) ?? Array(7).fill(0);
        perDay[i] += minutes;
        people.set(r.name, perDay);
        jobs.set(jobNumber, people);
      }
    });
  }
  const byJobSheet = wb.addWorksheet("Hours by job");
  header(byJobSheet, ["Job number", "Employee", ...dayHeaders, "Total hours"]);
  const jobTotalRows: number[] = [];
  for (const job of [...jobs.keys()].sort(byJob)) {
    const first = byJobSheet.rowCount + 1;
    for (const [name, perDay] of [...jobs.get(job)!].sort((a, b) => a[0].localeCompare(b[0]))) {
      const r = byJobSheet.addRow([jobCell(job), name, ...perDay.map((m) => (m ? hours(m) : null))]);
      r.getCell(10).value = { formula: `SUM(C${r.number}:I${r.number})`, result: hours(perDay.reduce((a, b) => a + b, 0)) };
    }
    const last = byJobSheet.rowCount;
    const t = byJobSheet.addRow([`Job ${job} total`, `${last - first + 1} ${last === first ? "person" : "people"}`]);
    for (let c = 3; c <= 10; c++) t.getCell(c).value = { formula: `SUM(${col(c)}${first}:${col(c)}${last})`, result: sumOf(byJobSheet, c, range(first, last)) };
    totalStyle(t);
    jobTotalRows.push(t.number);
  }
  if (jobTotalRows.length) {
    const all = byJobSheet.addRow(["All jobs", `${jobTotalRows.length} job numbers`]);
    for (let c = 3; c <= 10; c++) all.getCell(c).value = { formula: jobTotalRows.map((n) => `${col(c)}${n}`).join("+"), result: sumOf(byJobSheet, c, jobTotalRows) };
    all.font = { bold: true, color: { argb: "FFFFFFFF" } };
    all.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(colours.primary) } };
  } else {
    byJobSheet.addRow(["No submitted timesheets for this week yet"]);
  }
  byJobSheet.columns.forEach((c, i) => {
    c.width = i === 0 ? 16 : i === 1 ? 24 : 11;
    if (i >= 2) c.numFmt = "0.00";
  });

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export function workbookFileName(companyName: string, weekStart: string) {
  const company = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${company || "timesheets"}-week-${weekStart}.xlsx`;
}
