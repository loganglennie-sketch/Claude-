/**
 * Builds the signed timesheet PDF. Works in the browser (demo) and on the
 * server (stage 3, where it gets attached to the payroll email).
 */
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { brand } from "@/config/brand";
import { dayMinutes, dayTimeline, formatClock, formatDecimalHours, formatHM, weekTotals } from "./hours";
import type { Timesheet } from "./types";
import { addDays, formatDayMonth, formatDayName, formatWeekRange, parseISODate } from "./week";

type PdfInput = {
  companyName: string;
  workerName: string;
  sheet: Timesheet;
  colours?: { primary: string; primarySoft: string };
  /** Include basic/overtime split (off for companies whose own program applies pay rules). */
  showOvertime?: boolean;
  /** "nicol-qa-f-27": fill in Nicol of Skene's own paper form instead. */
  layout?: "standard" | "nicol-qa-f-27";
  /** Company logo (PNG) for layouts that show it. */
  logoPath?: string;
};

const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" });

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export async function buildTimesheetPdf(input: PdfInput): Promise<Uint8Array> {
  if (input.layout === "nicol-qa-f-27") {
    const { buildNicolFormPdf } = await import("./pdf-nicol-form");
    return buildNicolFormPdf({ workerName: input.workerName, sheet: input.sheet, logoPng: input.logoPath ? await fetchBytes(input.logoPath) : null });
  }
  return buildStandardPdf(input);
}

async function fetchBytes(path: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(path);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function buildStandardPdf({ companyName, workerName, sheet, colours = brand.colours, showOvertime = brand.showOvertime }: PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Timesheet – ${workerName} – ${formatWeekRange(sheet.weekStart)}`);
  pdf.setAuthor(companyName);
  const A4: [number, number] = [595.28, 841.89];
  let page = pdf.addPage(A4);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = hexToRgb(colours.primary);
  const soft = hexToRgb(colours.primarySoft);
  const ink = rgb(0.12, 0.14, 0.13);
  const muted = rgb(0.4, 0.44, 0.42);
  const line = rgb(0.88, 0.86, 0.82);
  const { width } = page.getSize();
  const left = 40;
  const right = width - 40;

  // The built-in PDF fonts only cover Western European characters.
  const safe = (font: PDFFont, s: string) => [...s].map((ch) => { try { font.encodeText(ch); return ch; } catch { return "?"; } }).join("");
  const text = (s: string, x: number, y: number, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; alignRight?: boolean } = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    const clean = safe(font, s);
    const drawX = opts.alignRight ? x - font.widthOfTextAtSize(clean, size) : x;
    page.drawText(clean, { x: drawX, y, size, font, color: opts.color ?? ink });
  };
  const fit = (font: PDFFont, s: string, size: number, maxWidth: number) => {
    let out = safe(font, s);
    while (out.length > 1 && font.widthOfTextAtSize(out, size) > maxWidth) out = out.slice(0, -2) + "…";
    return out.replace(/…+$/, "…");
  };

  // Header band
  page.drawRectangle({ x: 0, y: 841.89 - 90, width, height: 90, color: green });
  text(companyName, left, 841.89 - 45, { font: bold, size: 20, color: rgb(1, 1, 1) });
  text("Weekly timesheet", left, 841.89 - 67, { size: 12, color: rgb(1, 1, 1) });
  if (sheet.reference) {
    text("Reference", right, 841.89 - 42, { size: 9, color: rgb(1, 1, 1), alignRight: true });
    text(sheet.reference, right, 841.89 - 60, { font: bold, size: 13, color: rgb(1, 1, 1), alignRight: true });
  }

  // Details
  let y = 841.89 - 125;
  const detail = (label: string, value: string, x: number) => {
    text(label, x, y, { size: 9, color: muted });
    text(value, x, y - 15, { font: bold, size: 12 });
  };
  detail("Worker", workerName, left);
  detail("Week", `${formatWeekRange(sheet.weekStart)}`, left + 190);
  detail("Submitted", sheet.submittedAt ? stamp.format(new Date(sheet.submittedAt)) : "–", left + 360);
  y -= 50;

  // Daily table: every job in time order with its clock times, gaps between jobs,
  // overnight markers, and the day's total on the right.
  const col = { day: left + 6, job: left + 92, start: left + 168, finish: left + 212, brk: left + 300, hours: left + 345, notes: left + 356, total: right - 6 };
  const tableHeader = () => {
    page.drawRectangle({ x: left, y: y - 8, width: right - left, height: 24, color: soft });
    text("Day", col.day, y, { font: bold, size: 9 });
    text("Job no.", col.job, y, { font: bold, size: 9 });
    text("Start", col.start, y, { font: bold, size: 9 });
    text("Finish", col.finish, y, { font: bold, size: 9 });
    text("Break", col.brk, y, { font: bold, size: 9, alignRight: true });
    text("Hours", col.hours, y, { font: bold, size: 9, alignRight: true });
    text("Notes", col.notes, y, { font: bold, size: 9 });
    text("Day total", col.total, y, { font: bold, size: 9, alignRight: true });
    y -= 26;
  };
  const newPage = () => {
    page = pdf.addPage(A4);
    y = 841.89 - 50;
    text(`${workerName} · ${formatWeekRange(sheet.weekStart)} (continued)`, left, y, { font: bold, size: 11 });
    y -= 30;
  };
  tableHeader();

  for (const day of sheet.days) {
    const items = dayTimeline(day).items;
    const weekend = [0, 6].includes(parseISODate(day.date).getDay());
    const rowHeight = Math.max(weekend ? 40 : 30, items.length * 15 + 14);
    if (y - rowHeight < 50) {
      newPage();
      tableHeader();
    }
    text(formatDayName(day.date), col.day, y, { font: bold, size: 10 });
    text(formatDayMonth(day.date), col.day, y - 12, { size: 8, color: muted });
    if (weekend) text("Weekend", col.day, y - 23, { font: bold, size: 7, color: muted });
    if (day.worked) {
      items.forEach((item, i) => {
        const lineY = y - i * 15;
        if (item.kind === "gap") {
          text(`Gap ${formatClock(item.from)}–${formatClock(item.to)}  ·  ${formatHM(item.minutes)}`, col.job, lineY, { size: 8.5, color: muted });
          return;
        }
        const { entry, span } = item;
        text(fit(bold, entry.jobNumber.trim() || "–", 10, col.start - col.job - 6), col.job, lineY, { font: bold });
        if (span) {
          text(formatClock(span.start), col.start, lineY);
          text(`${formatClock(span.end)}${span.overnight ? " (+1)" : ""}`, col.finish, lineY);
          text(entry.breakMins > 0 ? `${entry.breakMins}m` : "–", col.brk, lineY, { alignRight: true, color: entry.breakMins > 0 ? ink : muted });
        }
        text(formatDecimalHours(item.minutes), col.hours, lineY, { alignRight: true });
        if (span?.overnight) text("Overnight", col.notes, lineY, { font: bold, size: 8.5, color: green });
      });
      text(formatDecimalHours(dayMinutes(day).minutes), col.total, y, { font: bold, alignRight: true });
    } else {
      text("Day off", col.job, y, { color: muted });
      text("–", col.total, y, { color: muted, alignRight: true });
    }
    y -= rowHeight - 8;
    page.drawLine({ start: { x: left, y: y + 6 }, end: { x: right, y: y + 6 }, thickness: 0.5, color: line });
    y -= 8;
  }
  text("Times are 24-hour. (+1) = finished the next day. Hours are after breaks.", left, y - 2, { size: 7.5, color: muted });
  y -= 14;

  // Keep totals, declaration and signature together.
  if (y < 290) newPage();

  // Totals
  const totals = weekTotals(sheet.days);
  y -= 6;
  const totalRow = (label: string, minutes: number, strong = false) => {
    text(label, right - 240, y, { font: strong ? bold : regular, size: strong ? 12 : 10 });
    text(formatHM(minutes), right - 75, y, { size: 9, color: muted, alignRight: true });
    text(`${formatDecimalHours(minutes)} h`, right - 8, y, { font: strong ? bold : regular, size: strong ? 12 : 10, alignRight: true });
    y -= 18;
  };
  if (showOvertime) {
    totalRow("Basic hours", totals.totalMinutes - totals.overtimeMinutes);
    totalRow(`Overtime (over ${brand.overtimeThresholdHours}h)`, totals.overtimeMinutes);
    page.drawLine({ start: { x: right - 240, y: y + 12 }, end: { x: right, y: y + 12 }, thickness: 1, color: ink });
    y -= 2;
  }
  totalRow("Total hours worked", totals.totalMinutes, true);

  // Declaration and signature
  y -= 20;
  page.drawRectangle({ x: left, y: y - 4, width: 14, height: 14, borderColor: green, borderWidth: 1.5 });
  page.drawLine({ start: { x: left + 3, y: y + 3 }, end: { x: left + 6, y: y }, thickness: 2, color: green });
  page.drawLine({ start: { x: left + 6, y: y }, end: { x: left + 12, y: y + 8 }, thickness: 2, color: green });
  text(`${brand.declaration}.`, left + 22, y, { size: 11 });

  y -= 30;
  const boxH = 100;
  page.drawRectangle({ x: left, y: y - boxH, width: 300, height: boxH, borderColor: line, borderWidth: 1 });
  text("Signature", left + 8, y - 14, { size: 8, color: muted });
  if (sheet.signature?.startsWith("data:image/png")) {
    const png = await pdf.embedPng(sheet.signature);
    const scale = Math.min(280 / png.width, (boxH - 20) / png.height);
    page.drawImage(png, { x: left + 10, y: y - boxH + 6, width: png.width * scale, height: png.height * scale });
  } else if (sheet.signaturePath) {
    page.drawSvgPath(sheet.signaturePath, { x: left + 5, y: y - 10, borderColor: ink, borderWidth: 1.6, scale: 0.95 });
  }
  text(`Signed by ${workerName}`, left + 315, y - 40, { font: bold, size: 10 });
  if (sheet.submittedAt) text(stamp.format(new Date(sheet.submittedAt)), left + 315, y - 55, { size: 9, color: muted });
  if (sheet.approvedAt) text(`Approved ${stamp.format(new Date(sheet.approvedAt))}`, left + 315, y - 75, { size: 9, color: green, font: bold });

  // Footer on every page
  const pages = pdf.getPages();
  const weekEnd = addDays(sheet.weekStart, 6);
  pages.forEach((p, i) => {
    page = p;
    text(`Week ending ${formatDayName(weekEnd)} ${formatDayMonth(weekEnd)}  ·  ${companyName}`, left, 30, { size: 8, color: muted });
    if (pages.length > 1) text(`Page ${i + 1} of ${pages.length}`, right, 30, { size: 8, color: muted, alignRight: true });
  });

  return pdf.save();
}

export function pdfFileName(workerName: string, weekStart: string) {
  return `timesheet-${weekStart}-${workerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.pdf`;
}
