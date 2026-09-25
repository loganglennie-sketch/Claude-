/**
 * Builds the signed timesheet PDF. Works in the browser (demo) and on the
 * server (stage 3, where it gets attached to the payroll email).
 */
import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { brand } from "@/config/brand";
import { dayMinutes, formatDecimalHours, formatHM, weekTotals } from "./hours";
import type { Timesheet } from "./types";
import { addDays, formatDayMonth, formatDayName, formatWeekRange } from "./week";

type PdfInput = { companyName: string; workerName: string; sheet: Timesheet };

const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" });

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export async function buildTimesheetPdf({ companyName, workerName, sheet }: PdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Timesheet – ${workerName} – ${formatWeekRange(sheet.weekStart)}`);
  pdf.setAuthor(companyName);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = hexToRgb(brand.colours.primary);
  const soft = hexToRgb(brand.colours.primarySoft);
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

  // Daily table
  const cols = [
    { label: "Day", x: left + 8, w: 90 },
    { label: "Start", x: left + 100, w: 45 },
    { label: "Finish", x: left + 150, w: 45 },
    { label: "Break", x: left + 200, w: 45 },
    { label: "Job / site", x: left + 250, w: 200 },
  ];
  page.drawRectangle({ x: left, y: y - 8, width: right - left, height: 24, color: soft });
  cols.forEach((c) => text(c.label, c.x, y, { font: bold, size: 9 }));
  text("Hours", right - 8, y, { font: bold, size: 9, alignRight: true });
  y -= 30;

  for (const day of sheet.days) {
    const mins = dayMinutes(day).minutes;
    text(formatDayName(day.date), cols[0].x, y, { font: bold, size: 10 });
    text(formatDayMonth(day.date), cols[0].x, y - 12, { size: 8, color: muted });
    if (day.worked) {
      text(day.start, cols[1].x, y);
      text(day.finish, cols[2].x, y);
      text(`${day.breakMins}m`, cols[3].x, y);
      text(fit(regular, day.job || "–", 10, cols[4].w), cols[4].x, y);
      text(formatDecimalHours(mins), right - 8, y, { font: bold, alignRight: true });
    } else {
      text("Day off", cols[1].x, y, { color: muted });
      text("–", right - 8, y, { color: muted, alignRight: true });
    }
    y -= 22;
    page.drawLine({ start: { x: left, y: y + 6 }, end: { x: right, y: y + 6 }, thickness: 0.5, color: line });
    y -= 8;
  }

  // Totals
  const totals = weekTotals(sheet.days);
  const basic = totals.totalMinutes - totals.overtimeMinutes;
  y -= 6;
  const totalRow = (label: string, minutes: number, strong = false) => {
    text(label, right - 240, y, { font: strong ? bold : regular, size: strong ? 12 : 10 });
    text(formatHM(minutes), right - 75, y, { size: 9, color: muted, alignRight: true });
    text(`${formatDecimalHours(minutes)} h`, right - 8, y, { font: strong ? bold : regular, size: strong ? 12 : 10, alignRight: true });
    y -= 18;
  };
  totalRow("Basic hours", basic);
  totalRow(`Overtime (over ${brand.overtimeThresholdHours}h)`, totals.overtimeMinutes);
  page.drawLine({ start: { x: right - 240, y: y + 12 }, end: { x: right, y: y + 12 }, thickness: 1, color: ink });
  y -= 2;
  totalRow("Total hours", totals.totalMinutes, true);

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

  // Footer
  text(`Week ending ${formatDayName(addDays(sheet.weekStart, 6))} ${formatDayMonth(addDays(sheet.weekStart, 6))}  ·  ${companyName}`, left, 30, { size: 8, color: muted });

  return pdf.save();
}

export function pdfFileName(workerName: string, weekStart: string) {
  return `timesheet-${weekStart}-${workerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}.pdf`;
}
