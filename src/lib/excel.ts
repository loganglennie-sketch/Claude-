/**
 * Builds the weekly Excel workbook for the office:
 *   1. Weekly hours       – one row per employee, hours per day, weekly total (for payroll)
 *   2. Hours by job       – grouped by job number: who worked on it, hours per day, job totals
 *   3. Job costing import – flat list (date, employee, job number, hours) for importing
 */
import ExcelJS from "exceljs";
import { brand } from "@/config/brand";
import { dayJobTotals, dayMinutes, weekTotals } from "./hours";
import type { Timesheet } from "./types";
import { formatShortDay, parseISODate, weekDates } from "./week";

export type ExportRow = { name: string; status: string; sheet: Timesheet | null };

const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;
const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;
/** Real Excel dates, pinned to midnight UTC so they never shift a day. */
const excelDate = (iso: string) => {
  const d = parseISODate(iso);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};
/** Plain numbers stay numbers in Excel; anything with letters or a leading 0 stays as typed. */
const jobCell = (job: string) => (/^[1-9]\d{0,14}$/.test(job) ? Number(job) : job);
const byJob = (a: string, b: string) => a.localeCompare(b, "en-GB", { numeric: true });

export async function buildWeekWorkbook(
  weekStart: string,
  rows: ExportRow[],
  companyName: string,
  colours: { primary: string; primarySoft: string } = brand.colours,
): Promise<ArrayBuffer> {
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
    Math.round(rowNumbers.reduce((n, r) => {
      const v = ws.getRow(r).getCell(c).value;
      const num = typeof v === "number" ? v : v && typeof v === "object" && "result" in v ? Number(v.result) || 0 : 0;
      return n + num;
    }, 0) * 100) / 100;
  const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

  // ── 1. Weekly hours ────────────────────────────────────────────────
  const pay = wb.addWorksheet("Weekly hours");
  header(pay, ["Employee", "Status", ...dayHeaders, "Total hours", "Overtime hours"]);
  for (const r of employees) {
    if (!r.sheet) {
      pay.addRow([r.name, r.status]);
      continue;
    }
    const totals = weekTotals(r.sheet.days);
    pay.addRow([r.name, r.status, ...r.sheet.days.map((d) => hours(dayMinutes(d).minutes)), hours(totals.totalMinutes), hours(totals.overtimeMinutes)]);
  }
  const lastPay = pay.rowCount;
  const payTotal = pay.addRow([
    "Total",
    `${submitted.length} of ${employees.length} submitted`,
    ...Array.from({ length: 9 }, (_, i) => ({ formula: `SUM(${col(3 + i)}2:${col(3 + i)}${lastPay})`, result: sumOf(pay, 3 + i, range(2, lastPay)) })),
  ]);
  totalStyle(payTotal);
  pay.columns.forEach((c, i) => {
    c.width = i === 0 ? 24 : i === 1 ? 20 : 11;
    if (i >= 2) c.numFmt = "0.00";
  });

  // ── 2. Hours by job ────────────────────────────────────────────────
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

  // ── 3. Job costing import (flat, no totals, so it imports cleanly) ──
  const flat = wb.addWorksheet("Job costing import");
  header(flat, ["Date", "Employee", "Job number", "Hours"]);
  const lines: { date: string; name: string; job: string; minutes: number }[] = [];
  for (const r of submitted) {
    r.sheet!.days.forEach((day) => dayJobTotals(day).forEach(({ jobNumber, minutes }) => lines.push({ date: day.date, name: r.name, job: jobNumber, minutes })));
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || byJob(a.job, b.job));
  for (const l of lines) flat.addRow([excelDate(l.date), l.name, jobCell(l.job), hours(l.minutes)]);
  flat.getColumn(1).numFmt = "dd/mm/yyyy";
  flat.getColumn(4).numFmt = "0.00";
  [12, 24, 14, 10].forEach((w, i) => (flat.getColumn(i + 1).width = w));

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export function workbookFileName(companyName: string, weekStart: string) {
  const company = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${company || "timesheets"}-week-${weekStart}.xlsx`;
}
