/**
 * The signed trip PDF: days, totals, the technician's signature and the
 * client supervisor's approval (name, email, time, signature), plus the
 * history of who did what. Built in the browser (stage 2 can also build it on the server).
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { DAY_TYPES, DAY_TYPE_ORDER, settings } from "@/config/settings";
import { formatDayMonth, formatDayName, formatRange, formatStamp } from "./dates";
import { dayHours, formatHours, STATUS, tripTotals } from "./trip";
import type { Signature, Trip } from "./types";

const A4: [number, number] = [595.28, 841.89];

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export async function buildTripPdf(trip: Trip): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Trip timesheet – ${trip.workerName} – ${trip.installation} – ${formatRange(trip.startDate, trip.endDate)}`);
  pdf.setAuthor(settings.companyName);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const brand = hexToRgb(settings.colours.primary);
  const soft = hexToRgb(settings.colours.primarySoft);
  const ink = rgb(0.08, 0.13, 0.17);
  const muted = rgb(0.37, 0.42, 0.46);
  const line = rgb(0.85, 0.88, 0.9);
  const green = hexToRgb(settings.colours.success);
  const red = hexToRgb(settings.colours.danger);
  const [width, height] = A4;
  const left = 40;
  const right = width - 40;

  let page: PDFPage = pdf.addPage(A4);
  let y = height;

  // The built-in PDF fonts only cover Western European characters.
  const safe = (font: PDFFont, s: string) =>
    [...s]
      .map((ch) => {
        try {
          font.encodeText(ch);
          return ch;
        } catch {
          return "?";
        }
      })
      .join("");
  const text = (s: string, x: number, yy: number, o: { font?: PDFFont; size?: number; color?: RGB; alignRight?: boolean; maxWidth?: number } = {}) => {
    const font = o.font ?? regular;
    const size = o.size ?? 10;
    let clean = safe(font, s);
    if (o.maxWidth) while (clean.length > 1 && font.widthOfTextAtSize(clean, size) > o.maxWidth) clean = clean.slice(0, -2) + "…";
    const drawX = o.alignRight ? x - font.widthOfTextAtSize(clean, size) : x;
    page.drawText(clean, { x: drawX, y: yy, size, font, color: o.color ?? ink });
  };
  /** Splits text into lines that fit. */
  const wrap = (s: string, font: PDFFont, size: number, maxWidth: number) => {
    const out: string[] = [];
    let current = "";
    for (const word of safe(font, s).split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
        out.push(current);
        current = word;
      } else current = next;
    }
    if (current) out.push(current);
    return out;
  };
  const continued = () => {
    page = pdf.addPage(A4);
    y = height - 50;
    text(`${trip.workerName} · ${trip.installation} · ${formatRange(trip.startDate, trip.endDate)} (continued)`, left, y, { font: bold, size: 11 });
    y -= 26;
  };
  const room = (needed: number) => {
    if (y - needed < 60) continued();
  };

  // ── Header band ──
  page.drawRectangle({ x: 0, y: height - 86, width, height: 86, color: brand });
  text(settings.companyName, left, height - 42, { font: bold, size: 19, color: rgb(1, 1, 1) });
  text("Offshore trip timesheet", left, height - 63, { size: 12, color: rgb(1, 1, 1) });
  const statusText = trip.approval ? "CLIENT APPROVED" : STATUS[trip.status].label.toUpperCase();
  const statusWidth = bold.widthOfTextAtSize(statusText, 10) + 20;
  page.drawRectangle({ x: right - statusWidth, y: height - 58, width: statusWidth, height: 22, color: rgb(1, 1, 1), opacity: trip.approval ? 1 : 0.85 });
  text(statusText, right - 10, height - 51, { font: bold, size: 10, color: trip.approval ? green : trip.status === "queried" ? red : brand, alignRight: true });

  // ── Details ──
  y = height - 116;
  const detail = (label: string, value: string, x: number, w: number) => {
    text(label, x, y, { size: 8.5, color: muted });
    // Long values (e.g. a work order with a description) get smaller rather than cut off.
    let size = 11;
    while (size > 7.5 && bold.widthOfTextAtSize(safe(bold, value || "–"), size) > w) size -= 0.5;
    text(value || "–", x, y - 14, { font: bold, size, maxWidth: w });
  };
  detail("Technician", trip.workerName, left, 170);
  detail("Installation", trip.installation, left + 180, 160);
  detail("Client", trip.client, left + 350, 165);
  y -= 38;
  detail("Trip dates", formatRange(trip.startDate, trip.endDate), left, 170);
  detail("PO number", trip.poNumber, left + 180, 160);
  detail("Work order / cost code", trip.workOrder, left + 350, 165);
  y -= 42;

  // ── Days ──
  const col = { date: left + 6, type: left + 90, hours: left + 230, note: left + 246 };
  const tableHeader = () => {
    page.drawRectangle({ x: left, y: y - 7, width: right - left, height: 22, color: soft });
    text("Date", col.date, y, { font: bold, size: 9 });
    text("Day", col.type, y, { font: bold, size: 9 });
    text("Hours", col.hours, y, { font: bold, size: 9, alignRight: true });
    text("Notes", col.note, y, { font: bold, size: 9 });
    y -= 22;
  };
  tableHeader();
  for (const day of trip.days) {
    const queries = trip.queries.filter((q) => q.date === day.date);
    const queryLines = queries.flatMap((q) => [
      ...wrap(`Queried by ${q.byName}, ${formatStamp(q.at)}: "${q.comment}"`, italic, 8, right - col.note - 6),
      ...(q.reply ? wrap(`Technician's answer: "${q.reply}"`, italic, 8, right - col.note - 6) : []),
    ]);
    const rowH = 16 + queryLines.length * 10;
    if (y - rowH < 60) {
      continued();
      tableHeader();
    }
    text(`${formatDayName(day.date)} ${formatDayMonth(day.date)}`, col.date, y, { font: bold, size: 9.5 });
    text(DAY_TYPES[day.type].label, col.type, y, { size: 9.5 });
    const h = dayHours(day);
    text(h ? formatHours(h) : "–", col.hours, y, { alignRight: true, size: 9.5, font: bold, color: h ? ink : muted });
    if (day.note) text(day.note, col.note, y, { size: 9, color: muted, maxWidth: right - col.note - 6 });
    queryLines.forEach((l, i) => text(l, col.note, y - 11 - i * 10, { font: italic, size: 8, color: red }));
    y -= rowH;
    page.drawLine({ start: { x: left, y: y + 11 }, end: { x: right, y: y + 11 }, thickness: 0.5, color: line });
  }

  // ── Totals ──
  const totals = tripTotals(trip.days);
  room(70);
  y -= 8;
  const counts = DAY_TYPE_ORDER.filter((t) => totals.byType[t] > 0).map((t) => `${totals.byType[t]} × ${DAY_TYPES[t].label.toLowerCase()}`);
  wrap(counts.join("   ·   "), regular, 9, 330).forEach((l, i) => text(l, left, y - i * 12, { size: 9, color: muted }));
  text("Days on", right - 150, y, { size: 10 });
  text(String(totals.daysOn), right - 8, y, { size: 10, alignRight: true });
  y -= 18;
  text("Total hours", right - 150, y, { font: bold, size: 13 });
  text(formatHours(totals.hours), right - 8, y, { font: bold, size: 13, alignRight: true });
  y -= 22;

  // ── Signatures: technician and client ──
  room(170);
  const boxW = (right - left - 16) / 2;
  const boxH = 150;
  const drawSignature = async (sig: Signature | undefined, x: number, top: number) => {
    if (!sig) return;
    if (sig.startsWith("data:image/png")) {
      const png = await pdf.embedPng(sig);
      const scale = Math.min((boxW - 20) / png.width, 60 / png.height);
      page.drawImage(png, { x: x + 10, y: top - 22 - png.height * scale, width: png.width * scale, height: png.height * scale });
    } else if (sig.startsWith("svg:")) {
      page.drawSvgPath(sig.slice(4), { x: x + 6, y: top - 18, borderColor: ink, borderWidth: 1.4, scale: 0.68 });
    }
  };
  const top = y;
  // Technician
  page.drawRectangle({ x: left, y: top - boxH, width: boxW, height: boxH, borderColor: line, borderWidth: 1 });
  text("TECHNICIAN", left + 10, top - 14, { font: bold, size: 8, color: muted });
  if (trip.submission) {
    await drawSignature(trip.submission.signature, left, top);
    text(trip.workerName, left + 10, top - 96, { font: bold, size: 10.5 });
    text(`Signed ${formatStamp(trip.submission.at)}`, left + 10, top - 110, { size: 9, color: muted });
    wrap(`"${settings.workerDeclaration}"`, italic, 7.5, boxW - 20).forEach((l, i) => text(l, left + 10, top - 126 - i * 9, { font: italic, size: 7.5, color: muted }));
  } else {
    text("Not signed yet", left + 10, top - 60, { color: muted });
  }
  // Client
  const cx = left + boxW + 16;
  page.drawRectangle({ x: cx, y: top - boxH, width: boxW, height: boxH, borderColor: trip.approval ? green : line, borderWidth: trip.approval ? 1.5 : 1 });
  text("CLIENT APPROVAL", cx + 10, top - 14, { font: bold, size: 8, color: trip.approval ? green : muted });
  if (trip.approval) {
    await drawSignature(trip.approval.signature, cx, top);
    text(trip.approval.name, cx + 10, top - 96, { font: bold, size: 10.5, maxWidth: boxW - 20 });
    text(trip.approval.email, cx + 10, top - 108, { size: 9, maxWidth: boxW - 20 });
    text(`Approved ${formatStamp(trip.approval.at)}`, cx + 10, top - 120, { size: 9, color: green, font: bold });
    wrap(`"${settings.clientDeclaration}"`, italic, 7.5, boxW - 20).forEach((l, i) => text(l, cx + 10, top - 133 - i * 9, { font: italic, size: 7.5, color: muted }));
  } else {
    text("NOT YET APPROVED", cx + 10, top - 55, { font: bold, size: 12, color: red });
    if (trip.submission) wrap(`Sent to ${trip.submission.supervisorName} (${trip.submission.supervisorEmail})`, regular, 9, boxW - 20).forEach((l, i) => text(l, cx + 10, top - 75 - i * 12, { size: 9, color: muted }));
  }
  y = top - boxH - 20;

  // ── History ──
  if (trip.events.length) {
    room(40);
    text("History", left, y, { font: bold, size: 10 });
    y -= 14;
    for (const e of trip.events) {
      room(14);
      text(formatStamp(e.at), left, y, { size: 8, color: muted });
      text(`${e.who}: ${e.what}`, left + 100, y, { size: 8, maxWidth: right - left - 100 });
      y -= 10;
    }
  }

  // ── Footer on every page ──
  const pages = pdf.getPages();
  const made = formatStamp(new Date().toISOString());
  pages.forEach((p, i) => {
    page = p;
    text(`${settings.companyName}  ·  ${trip.workerName}  ·  ${trip.installation}  ·  Printed ${made}`, left, 28, { size: 7.5, color: muted, maxWidth: right - left - 70 });
    text(`Page ${i + 1} of ${pages.length}`, right, 28, { size: 7.5, color: muted, alignRight: true });
  });

  return pdf.save();
}
