/**
 * Excel exports for the office.
 *   Payroll:   hours and days per person per trip, a total per person, and every day listed.
 *   Invoicing: grouped by client, PO number and work order / cost code, with subtotals.
 * Numbers are real numbers and dates real dates, so they add up and sort in Excel.
 */
import ExcelJS from "exceljs";
import { DAY_TYPES, DAY_TYPE_ORDER, settings } from "@/config/settings";
import { parseISODate } from "./dates";
import { dayHours, STATUS, tripTotals } from "./trip";
import type { Trip } from "./types";

const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;
/** Real Excel dates, pinned to midnight UTC so they never shift a day. */
const excelDate = (iso: string) => {
  const d = parseISODate(iso);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};
/** Date and time of an approval, as Excel shows it in the UK. */
const excelStamp = (isoTime?: string) => {
  if (!isoTime) return null;
  const d = new Date(isoTime);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()));
};
const byText = (a: string, b: string) => a.localeCompare(b, "en-GB", { numeric: true });

type Column = { header: string; width: number; numFmt?: string; value: (t: Trip) => ExcelJS.CellValue; sum?: boolean };

const typeColumns: Column[] = DAY_TYPE_ORDER.map((type) => ({
  header: type === "custom" ? "Custom-hour days" : `${DAY_TYPES[type].label} (days)`,
  width: 12,
  sum: true,
  value: (t) => tripTotals(t.days).byType[type],
}));
const totalColumns: Column[] = [
  { header: "Days on", width: 9, sum: true, value: (t) => tripTotals(t.days).daysOn },
  { header: "Total hours", width: 11, numFmt: "0.00", sum: true, value: (t) => tripTotals(t.days).hours },
];
const approvalColumns: Column[] = [
  { header: "Status", width: 18, value: (t) => STATUS[t.status].label },
  { header: "Approved by", width: 20, value: (t) => t.approval?.name ?? null },
  { header: "Approver email", width: 30, value: (t) => t.approval?.email ?? null },
  { header: "Approved at", width: 17, numFmt: "dd/mm/yyyy hh:mm", value: (t) => excelStamp(t.approval?.at) },
];
const c = {
  technician: { header: "Technician", width: 20, value: (t: Trip) => t.workerName },
  installation: { header: "Installation", width: 18, value: (t: Trip) => t.installation },
  client: { header: "Client", width: 20, value: (t: Trip) => t.client },
  po: { header: "PO number", width: 16, value: (t: Trip) => t.poNumber || null },
  wo: { header: "Work order / cost code", width: 26, value: (t: Trip) => t.workOrder || null },
  start: { header: "Trip start", width: 11, numFmt: "dd/mm/yyyy", value: (t: Trip) => excelDate(t.startDate) },
  end: { header: "Trip end", width: 11, numFmt: "dd/mm/yyyy", value: (t: Trip) => excelDate(t.endDate) },
} satisfies Record<string, Column>;

function workbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = settings.companyName;
  wb.created = new Date();
  return wb;
}

function sheet(wb: ExcelJS.Workbook, name: string, columns: Column[]) {
  const ws = wb.addWorksheet(name);
  const row = ws.addRow(columns.map((col) => col.header));
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(settings.colours.primary) } };
  row.alignment = { vertical: "middle", wrapText: true };
  row.height = 32;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
    if (col.numFmt) ws.getColumn(i + 1).numFmt = col.numFmt;
  });
  return ws;
}

/** A bold, shaded row adding up the number columns of `trips`. */
function totalRow(ws: ExcelJS.Worksheet, columns: Column[], trips: Trip[], label: string, labelColumn = 0) {
  const row = ws.addRow(
    columns.map((col, i) => (i === labelColumn ? label : col.sum ? Math.round(trips.reduce((n, t) => n + Number(col.value(t) ?? 0), 0) * 100) / 100 : null)),
  );
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(settings.colours.primarySoft) } };
  return row;
}

export async function buildPayrollWorkbook(trips: Trip[]): Promise<ArrayBuffer> {
  const wb = workbook();
  const sorted = [...trips].sort((a, b) => byText(a.workerName, b.workerName) || a.startDate.localeCompare(b.startDate));

  // 1. One row per person per trip.
  const cols: Column[] = [c.technician, c.installation, c.client, c.start, c.end, ...typeColumns, ...totalColumns, ...approvalColumns];
  const ws = sheet(wb, "Per person per trip", cols);
  for (const t of sorted) ws.addRow(cols.map((col) => col.value(t)));
  if (sorted.length) totalRow(ws, cols, sorted, "Total");
  else ws.addRow(["No trips in this export"]);

  // 2. One row per person: all their trips added up.
  const people = [...new Set(sorted.map((t) => t.workerName))];
  const personCols: Column[] = [{ ...c.technician }, { header: "Trips", width: 7, sum: true, value: () => 1 }, ...typeColumns, ...totalColumns];
  const ps = sheet(wb, "Per person", personCols);
  for (const person of people) {
    const theirs = sorted.filter((t) => t.workerName === person);
    const row = totalRow(ps, personCols, theirs, person);
    row.font = { bold: false };
    row.fill = { type: "pattern", pattern: "none" };
  }
  if (people.length) totalRow(ps, personCols, sorted, "Total");

  // 3. Every day, for payroll systems that import day by day.
  const ds = wb.addWorksheet("Every day");
  const dayHeader = ds.addRow(["Technician", "Date", "Installation", "Client", "Day", "Hours", "Note"]);
  dayHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  dayHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(settings.colours.primary) } };
  ds.views = [{ state: "frozen", ySplit: 1 }];
  [20, 11, 18, 20, 18, 8, 40].forEach((w, i) => (ds.getColumn(i + 1).width = w));
  ds.getColumn(2).numFmt = "dd/mm/yyyy";
  ds.getColumn(6).numFmt = "0.00";
  for (const t of sorted) for (const d of t.days) ds.addRow([t.workerName, excelDate(d.date), t.installation, t.client, DAY_TYPES[d.type].label, dayHours(d), d.note ?? null]);

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export async function buildInvoicingWorkbook(trips: Trip[]): Promise<ArrayBuffer> {
  const wb = workbook();
  const key = (t: Trip) => [t.client, t.poNumber, t.workOrder] as const;
  const sorted = [...trips].sort(
    (a, b) => byText(a.client, b.client) || byText(a.poNumber, b.poNumber) || byText(a.workOrder, b.workOrder) || byText(a.workerName, b.workerName) || a.startDate.localeCompare(b.startDate),
  );
  const groups: Trip[][] = [];
  for (const t of sorted) {
    const last = groups.at(-1);
    if (last && key(last[0]).join("|") === key(t).join("|")) last.push(t);
    else groups.push([t]);
  }

  // 1. Summary: one line per client / PO / work order: what goes on each invoice line.
  const summaryCols: Column[] = [
    c.client,
    c.po,
    c.wo,
    { header: "Trips", width: 7, sum: true, value: () => 1 },
    ...typeColumns,
    ...totalColumns,
  ];
  const ss = sheet(wb, "Summary by PO", summaryCols);
  for (const g of groups) {
    const row = totalRow(ss, summaryCols, g, g[0].client);
    row.getCell(2).value = g[0].poNumber || null;
    row.getCell(3).value = g[0].workOrder || null;
    row.font = { bold: false };
    row.fill = { type: "pattern", pattern: "none" };
  }
  if (groups.length) totalRow(ss, summaryCols, sorted, "Total");
  else ss.addRow(["No trips in this export"]);

  // 2. Detail: every trip under its client / PO / work order, with a subtotal for each.
  const cols: Column[] = [c.client, c.po, c.wo, c.installation, c.technician, c.start, c.end, ...typeColumns, ...totalColumns, ...approvalColumns, { header: "Invoice no.", width: 12, value: (t) => t.invoiceNumber ?? null }];
  const ws = sheet(wb, "Trips by PO", cols);
  for (const g of groups) {
    for (const t of g) ws.addRow(cols.map((col) => col.value(t)));
    totalRow(ws, cols, g, `Subtotal: ${g[0].client}${g[0].poNumber ? ` · ${g[0].poNumber}` : ""}${g[0].workOrder ? ` · ${g[0].workOrder}` : ""}`);
    ws.addRow([]);
  }
  if (groups.length) totalRow(ws, cols, sorted, "Total");

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/** Many trips' signed PDFs in one file, for sending with an invoice. */
export async function buildCombinedPdf(trips: Trip[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const { buildTripPdf } = await import("./pdf");
  const out = await PDFDocument.create();
  out.setTitle(`${settings.companyName} – signed trip timesheets`);
  for (const t of trips) {
    const one = await PDFDocument.load(await buildTripPdf(t));
    for (const p of await out.copyPages(one, one.getPageIndices())) out.addPage(p);
  }
  return out.save();
}
