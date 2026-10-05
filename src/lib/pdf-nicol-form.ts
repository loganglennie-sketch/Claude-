/**
 * Nicol of Skene's paper timesheet (form QA-F-27, procedure QA-P-10), filled
 * in from the app. Same landscape layout as the paper copy so it can be
 * printed, calculated and scanned exactly as before:
 *   one line per contract number, start/finish for each day Monday–Sunday,
 *   travel time, work away allowance nights and expenses on the same line,
 *   totals per day, Office Use Only, and employee / chargehand / line manager sign-off.
 * Holiday and sick days get their own line. Anything that doesn't fit on the
 * paper form (expense details, notes) goes in "Other details" at the bottom.
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { dayMinutes, dayTimeline, entryMinutes, expenseError, formatClock, parsePounds, travelMinutes, type EntrySpan } from "./hours";
import type { JobEntry, Timesheet } from "./types";
import { addDays, parseISODate } from "./week";

export type NicolFormInput = {
  workerName: string;
  sheet: Timesheet;
  /** PNG of the company logo (fetched by the caller), drawn top right. */
  logoPng?: Uint8Array | ArrayBuffer | null;
};

const W = 841.89;
const H = 595.28;
const ROWS_PER_PAGE = 12;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Cell = { entry: JobEntry; span: EntrySpan | null; minutes: number };
type Line = {
  job: string;
  cells: (Cell | "mark" | null)[];
  travel: number;
  away: number;
  food: number;
  pence: number;
  /** HOLIDAY / SICK lines: the word written across each marked day. */
  mark?: string;
};

/** Turns the week into the form's lines: one per contract number (more if it's worked twice in a day). */
export function formLines(sheet: Timesheet): Line[] {
  const lines: Line[] = [];
  const newLine = (job: string): Line => {
    const line: Line = { job, cells: Array(7).fill(null), travel: 0, away: 0, food: 0, pence: 0 };
    lines.push(line);
    return line;
  };
  const key = (s: string) => s.trim().toUpperCase();
  let lastUsed: Line | null = null;

  sheet.days.forEach((day, d) => {
    let longest: { line: Line; minutes: number } | null = null;
    if (day.worked) {
      for (const item of dayTimeline(day).items) {
        if (item.kind !== "job") continue;
        const job = key(item.entry.jobNumber);
        const line = lines.find((l) => !l.mark && l.job === job && l.cells[d] === null) ?? newLine(job);
        line.cells[d] = { entry: item.entry, span: item.span, minutes: item.minutes };
        line.travel += travelMinutes(item.entry) ?? 0;
        if (!longest || item.minutes > longest.minutes) longest = { line, minutes: item.minutes };
      }
    }
    // A night away or food goes on the line of the day's main job (or the last job worked).
    const target: Line | null = longest?.line ?? lastUsed ?? lines.find((l) => !l.mark) ?? null;
    if (!day.absence && (day.away || day.food)) {
      const line = target ?? newLine("");
      if (day.away) line.away++;
      if (day.food) line.food++;
    }
    if (longest) lastUsed = longest.line;
  });

  for (const e of sheet.expenses ?? []) {
    if (expenseError(e)) continue;
    const pence = parsePounds(e.amount);
    if (!pence) continue;
    const job = key(e.jobNumber);
    const line = lines.find((l) => !l.mark && l.job === job) ?? newLine(job);
    line.pence += pence;
  }

  for (const [absence, word] of [["holiday", "HOLIDAY"], ["sick", "SICK"]] as const) {
    if (!sheet.days.some((d) => !d.worked && d.absence === absence)) continue;
    const line = newLine(word);
    line.mark = word;
    sheet.days.forEach((d, i) => {
      if (!d.worked && d.absence === absence) line.cells[i] = "mark";
    });
  }
  return lines;
}

const ddmm = (iso: string) => {
  const d = parseISODate(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const ddmmyyyy = (iso: string) => `${ddmm(iso)}/${parseISODate(iso).getFullYear()}`;
const hours = (minutes: number) => (minutes / 60).toFixed(2);
const pounds = (pence: number) => (pence / 100).toFixed(2);
const londonDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/London" }).format(new Date(iso));
const londonStamp = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(iso));

export async function buildNicolFormPdf({ workerName, sheet, logoPng }: NicolFormInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Nicol of Skene Timesheet – ${workerName} – w/e ${ddmmyyyy(addDays(sheet.weekStart, 6))}`);
  pdf.setAuthor("Nicol of Skene");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo = null;
  try {
    if (logoPng) logo = await pdf.embedPng(logoPng);
  } catch {
    logo = null; // the form still works without the logo
  }
  const signature = sheet.signature?.startsWith("data:image/png") ? await pdf.embedPng(sheet.signature).catch(() => null) : null;

  const black = rgb(0, 0, 0);
  const grey = rgb(0.8, 0.8, 0.8);
  const ink = rgb(0.05, 0.15, 0.45); // filled-in answers in dark blue, like pen on the paper form
  const muted = rgb(0.35, 0.35, 0.35);

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
  const fit = (font: PDFFont, s: string, size: number, maxWidth: number) => {
    let out = safe(font, s);
    while (out.length > 1 && font.widthOfTextAtSize(out, size) > maxWidth) out = out.slice(0, -1);
    return out;
  };

  // Layout in points from the TOP-left (converted for pdf-lib, which measures from the bottom).
  const L = 25;
  const R = W - 25;
  const col = {
    job: [L, 103],
    day: (d: number) => [103 + d * 78, 103 + (d + 1) * 78] as const,
    travel: [649, 691],
    away: [691, 731],
    food: [731, 771],
    expenses: [771, R],
  } as const;
  const top = { title: 30, nameRow: 40, grid: 70 };
  const rowH = { day: 14, date: 14, sub: 30, line: 19, total: 22, office: 20 };
  const gridLinesTop = top.grid + rowH.day + rowH.date + rowH.sub;
  const totalsTop = gridLinesTop + ROWS_PER_PAGE * rowH.line;
  const officeTop = totalsTop + rowH.total;
  const gridBottom = officeTop + 2 * rowH.office;

  const lines = formLines(sheet);
  const pages = Math.max(1, Math.ceil(lines.length / ROWS_PER_PAGE));
  const otherDetails = buildOtherDetails(sheet);
  const overflow: string[] = []; // "Other details" lines that didn't fit on the form

  for (let p = 0; p < pages; p++) {
    const page = pdf.addPage([W, H]);
    const last = p === pages - 1;
    const pageLines = lines.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
    const t = (s: string, x: number, yTop: number, o: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; align?: "left" | "center" | "right"; width?: number } = {}) => {
      const font = o.font ?? regular;
      const size = o.size ?? 8;
      const clean = o.width ? fit(font, s, size, o.width) : safe(font, s);
      const w = font.widthOfTextAtSize(clean, size);
      const x0 = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x;
      page.drawText(clean, { x: x0, y: H - yTop, size, font, color: o.color ?? black });
    };
    const box = (x1: number, y1: number, x2: number, y2: number, fill?: ReturnType<typeof rgb>, thickness = 0.6) =>
      page.drawRectangle({ x: x1, y: H - y2, width: x2 - x1, height: y2 - y1, color: fill, borderColor: black, borderWidth: thickness });
    const hline = (x1: number, x2: number, y: number, thickness = 0.5) => page.drawLine({ start: { x: x1, y: H - y }, end: { x: x2, y: H - y }, thickness, color: black });
    // Text centred vertically in a cell (y1–y2 from the top).
    const mid = (y1: number, y2: number, size: number) => (y1 + y2) / 2 + size * 0.35;

    // ── Title, name and week ending ──
    t("Nicol of Skene Timesheet", L, top.title, { font: bold, size: 13 });
    t("[Procedure QA-P-10]", 192, top.title - 2, { font: bold, size: 6.5 });
    if (pages > 1) t(`Page ${p + 1} of ${pages}`, 300, top.title - 2, { size: 7, color: muted });
    if (logo) {
      const h = 46;
      const w = (logo.width / logo.height) * h;
      page.drawImage(logo, { x: R - w, y: H - 12 - h, width: w, height: h });
    }
    const nameTop = top.nameRow;
    const nameBottom = nameTop + 21;
    box(L, nameTop, 103, nameBottom, grey);
    t("Employee Name:", 100, mid(nameTop, nameBottom, 8.5), { font: bold, size: 8.5, align: "right" });
    box(103, nameTop, 528, nameBottom);
    t(workerName, 110, mid(nameTop, nameBottom, 11), { font: bold, size: 11, color: ink, width: 410 });
    box(528, nameTop, 610, nameBottom, grey);
    t("Week Ending:", 606, mid(nameTop, nameBottom, 8.5), { font: bold, size: 8.5, align: "right" });
    box(610, nameTop, 738, nameBottom);
    t(ddmmyyyy(addDays(sheet.weekStart, 6)), 674, mid(nameTop, nameBottom, 11), { font: bold, size: 11, color: ink, align: "center" });

    // ── Grid headings ──
    const g0 = top.grid;
    const g1 = g0 + rowH.day;
    const g2 = g1 + rowH.date;
    const g3 = gridLinesTop;
    box(col.job[0], g0, col.job[1], g1, grey);
    t("Day:", col.job[1] - 4, mid(g0, g1, 8), { font: bold, align: "right" });
    box(col.job[0], g1, col.job[1], g2, grey);
    t("Date:", col.job[1] - 4, mid(g1, g2, 8), { font: bold, align: "right" });
    box(col.job[0], g2, col.job[1], g3, grey);
    t("CONTRACT NUMBER", (col.job[0] + col.job[1]) / 2, mid(g2, g3, 6.5), { font: bold, size: 6.5, align: "center" });
    DAYS.forEach((name, d) => {
      const [x1, x2] = col.day(d);
      const xm = (x1 + x2) / 2;
      box(x1, g0, x2, g1, grey);
      t(name, xm, mid(g0, g1, 8), { font: bold, align: "center" });
      box(x1, g1, x2, g2);
      t(ddmm(addDays(sheet.weekStart, d)), xm, mid(g1, g2, 8), { font: bold, color: ink, align: "center" });
      box(x1, g2, xm, g3);
      box(xm, g2, x2, g3);
      t("Start", (x1 + xm) / 2, mid(g2, g3, 8), { font: bold, align: "center" });
      t("Finish", (xm + x2) / 2, mid(g2, g3, 7), { font: bold, size: 7, align: "center" });
    });
    // Right-hand headings: travel, work away allowance (BMSR nights + food), expenses.
    box(col.travel[0], g0, col.travel[1], g3, grey);
    t("Travel", (col.travel[0] + col.travel[1]) / 2, g0 + 22, { font: bold, size: 7.5, align: "center" });
    t("Time", (col.travel[0] + col.travel[1]) / 2, g0 + 31, { font: bold, size: 7.5, align: "center" });
    t("(hours)", (col.travel[0] + col.travel[1]) / 2, g0 + 40, { size: 6, align: "center" });
    box(col.away[0], g0, col.food[1], g2, grey);
    t("Work Away Allowance", (col.away[0] + col.food[1]) / 2, g0 + 12, { font: bold, size: 6.8, align: "center" });
    t("(No of Nights)", (col.away[0] + col.food[1]) / 2, g0 + 21, { size: 6, align: "center" });
    box(col.away[0], g2, col.away[1], g3, grey);
    t("Bench Mark", (col.away[0] + col.away[1]) / 2, g2 + 10, { font: bold, size: 6, align: "center" });
    t("Scale Rate", (col.away[0] + col.away[1]) / 2, g2 + 17, { font: bold, size: 6, align: "center" });
    t("(away)", (col.away[0] + col.away[1]) / 2, g2 + 24, { size: 5.5, align: "center" });
    box(col.food[0], g2, col.food[1], g3, grey);
    t("Food", (col.food[0] + col.food[1]) / 2, mid(g2, g3, 7), { font: bold, size: 7, align: "center" });
    box(col.expenses[0], g0, col.expenses[1], g3, grey);
    t("Expenses", (col.expenses[0] + col.expenses[1]) / 2, g0 + 18, { font: bold, size: 7.5, align: "center" });
    t("Amount", (col.expenses[0] + col.expenses[1]) / 2, g0 + 27, { font: bold, size: 7.5, align: "center" });
    t("(£ - Attach", (col.expenses[0] + col.expenses[1]) / 2, g0 + 36, { size: 5.5, align: "center" });
    t("receipts)", (col.expenses[0] + col.expenses[1]) / 2, g0 + 43, { size: 5.5, align: "center" });

    // ── Contract lines ──
    for (let r = 0; r < ROWS_PER_PAGE; r++) {
      const y1 = gridLinesTop + r * rowH.line;
      const y2 = y1 + rowH.line;
      const line = pageLines[r];
      box(col.job[0], y1, col.job[1], y2);
      for (let d = 0; d < 7; d++) {
        const [x1, x2] = col.day(d);
        const xm = (x1 + x2) / 2;
        box(x1, y1, xm, y2);
        box(xm, y1, x2, y2);
        const cell = line?.cells[d];
        if (!cell) continue;
        if (cell === "mark") {
          page.drawRectangle({ x: x1 + 0.6, y: H - y2 + 0.6, width: x2 - x1 - 1.2, height: rowH.line - 1.2, color: rgb(1, 1, 1) });
          t(line.mark!, (x1 + x2) / 2, mid(y1, y2, 8), { font: bold, color: ink, align: "center" });
          continue;
        }
        if (cell.span) {
          t(formatClock(cell.span.start), (x1 + xm) / 2, y1 + 10.5, { font: bold, size: 8.5, color: ink, align: "center" });
          t(`${formatClock(cell.span.end)}${cell.span.overnight ? "*" : ""}`, (xm + x2) / 2, y1 + 10.5, { font: bold, size: 8.5, color: ink, align: "center" });
          if (cell.entry.breakMins > 0) t(`${cell.entry.breakMins}m break`, (xm + x2) / 2, y1 + 17, { size: 5, color: ink, align: "center" });
        } else {
          // Hours typed without clock times (not used by Nicol, but never lose them).
          t(`${hours(entryMinutes(cell.entry).minutes)} h`, (x1 + x2) / 2, mid(y1, y2, 8.5), { font: bold, size: 8.5, color: ink, align: "center" });
        }
      }
      box(col.travel[0], y1, col.travel[1], y2);
      box(col.away[0], y1, col.away[1], y2);
      box(col.food[0], y1, col.food[1], y2);
      box(col.expenses[0], y1, col.expenses[1], y2);
      if (!line) continue;
      if (!line.mark) t(line.job || "–", (col.job[0] + col.job[1]) / 2, mid(y1, y2, 10), { font: bold, size: 10, color: ink, align: "center", width: 74 });
      else t(line.mark, (col.job[0] + col.job[1]) / 2, mid(y1, y2, 9), { font: bold, size: 9, color: ink, align: "center" });
      const val = (s: string, c: readonly [number, number]) => t(s, (c[0] + c[1]) / 2, mid(y1, y2, 9), { font: bold, size: 9, color: ink, align: "center" });
      if (line.travel) val(hours(line.travel), col.travel);
      if (line.away) val(String(line.away), col.away);
      if (line.food) val(String(line.food), col.food);
      if (line.pence) val(pounds(line.pence), col.expenses);
    }

    // ── Totals ──
    const tb = totalsTop + rowH.total;
    box(col.job[0], totalsTop, col.job[1], tb, grey);
    t("Total Hours Per Day:", col.job[1] - 3, mid(totalsTop, tb, 7), { font: bold, size: 7, align: "right" });
    for (let d = 0; d < 7; d++) {
      const [x1, x2] = col.day(d);
      box(x1, totalsTop, x2, tb);
      const day = sheet.days[d];
      if (last && day?.worked) {
        const mins = dayMinutes(day).minutes;
        if (mins) t(hours(mins), (x1 + x2) / 2, mid(totalsTop, tb, 10), { font: bold, size: 10, color: ink, align: "center" });
      }
    }
    const totalCell = (c: readonly [number, number], label: string, value: string) => {
      box(c[0], totalsTop, c[1], tb, grey);
      t(label, (c[0] + c[1]) / 2, totalsTop + 6.5, { font: bold, size: 5, align: "center" });
      if (last && value) {
        page.drawRectangle({ x: c[0] + 2, y: H - tb + 2, width: c[1] - c[0] - 4, height: 11, color: rgb(1, 1, 1) });
        t(value, (c[0] + c[1]) / 2, tb - 4.5, { font: bold, size: 8.5, color: ink, align: "center" });
      }
    };
    const sum = (pick: (l: Line) => number) => lines.reduce((n, l) => n + pick(l), 0);
    totalCell(col.travel, "Total Travel", sum((l) => l.travel) ? hours(sum((l) => l.travel)) : "");
    totalCell(col.away, "Total W.A", sum((l) => l.away) ? String(sum((l) => l.away)) : "");
    totalCell(col.food, "Total Food", sum((l) => l.food) ? String(sum((l) => l.food)) : "");
    totalCell(col.expenses, "Total Exp. (£)", sum((l) => l.pence) ? pounds(sum((l) => l.pence)) : "");

    // ── Office Use Only (left blank for the office) ──
    const o1 = officeTop;
    const o2 = o1 + rowH.office;
    const o3 = gridBottom;
    box(col.job[0], o1, col.job[1], o3);
    t("Office Use Only", (col.job[0] + col.job[1]) / 2, mid(o1, o3, 6.5), { font: bold, size: 6.5, align: "center" });
    for (let d = 0; d < 7; d++) {
      const [x1, x2] = col.day(d);
      box(x1, o1, x2, o2);
      box(x1, o2, x2, o3);
    }
    box(col.travel[0], o1, col.travel[1], o2);
    box(col.travel[0], o2, col.travel[1], o3);
    box(col.away[0], o1, col.expenses[1], o2);
    t("Attendance", (col.away[0] + col.expenses[1]) / 2, o1 + 7, { font: bold, size: 5.5, align: "center" });
    t("(To be completed by Line Manager)", (col.away[0] + col.expenses[1]) / 2, o1 + 14, { size: 5, align: "center" });
    box(col.away[0], o2, col.expenses[1], o3);
    t("YES", (col.away[0] + col.food[1]) / 2, mid(o2, o3, 10), { font: bold, size: 10, align: "center" });
    t("NO", (col.food[1] + col.expenses[1]) / 2, mid(o2, o3, 10), { font: bold, size: 10, align: "center" });
    page.drawRectangle({ x: L, y: H - gridBottom, width: R - L, height: gridBottom - top.grid, borderColor: black, borderWidth: 1.2 });

    t("Times are 24-hour.  * = finished the next day.  Total hours per day are after breaks.", L, gridBottom + 9, { size: 6, color: muted });

    // ── Sign-off ──
    const sign = (label: string, y: number, name?: string, date?: string, image?: typeof signature, path?: string) => {
      t(`${label} Name:`, L + 8, y, { font: bold, size: 8.5 });
      const nameX = L + 8 + bold.widthOfTextAtSize(`${label} Name: `, 8.5);
      hline(nameX, 330, y + 2);
      if (name) t(name, nameX + 4, y - 1, { font: bold, size: 10, color: ink, width: 330 - nameX - 6 });
      t("Signature:", 452, y, { font: bold, size: 8.5 });
      hline(495, 672, y + 2);
      if (image) {
        const h = 24;
        const w = Math.min(170, (image.width / image.height) * h);
        page.drawImage(image, { x: 500, y: H - y + 1, width: w, height: (w / image.width) * image.height });
      }
      // Demo timesheets carry the signature as a drawn line (300×90 box) instead of a picture.
      else if (path) page.drawSvgPath(path, { x: 500, y: H - y + 26, borderColor: ink, borderWidth: 1.2, scale: 0.3 });
      t("Date:", 694, y, { font: bold, size: 8.5 });
      hline(718, R, y + 2);
      if (date) t(date, 724, y - 1, { font: bold, size: 10, color: ink });
    };
    const submitted = sheet.submittedAt ? londonDate(sheet.submittedAt) : undefined;
    sign("Employee", gridBottom + 34, last ? workerName : undefined, last ? submitted : undefined, last ? signature : undefined, last && !signature ? sheet.signaturePath : undefined);
    sign("Chargehand", gridBottom + 62);
    sign("Line Manager", gridBottom + 90);

    // ── Other details (notes and expense descriptions) ──
    const notesTop = gridBottom + 102;
    const notesBottom = H - 22;
    page.drawRectangle({ x: L, y: H - notesBottom, width: R - L, height: notesBottom - notesTop, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
    t("Other details:", L + 5, notesTop + 9, { font: bold, size: 7 });
    if (last) {
      const wrapped = wrap(otherDetails, regular, 7, R - L - 80);
      const room = Math.floor((notesBottom - notesTop - 4) / 8.5);
      const shown = wrapped.length > room ? [...wrapped.slice(0, room - 1), "(continued on the next page)"] : wrapped;
      shown.forEach((line, i) => t(line, L + 62, notesTop + 9 + i * 8.5, { size: 7, color: ink }));
      if (wrapped.length > room) overflow.push(...wrapped.slice(room - 1));
    }

    // ── Footer ──
    t("QA-F-27 Rev 6 - OCT 17", L, H - 9, { size: 6 });
    const appLine = [
      "Completed in the timesheet app",
      sheet.reference && `ref ${sheet.reference}`,
      sheet.submittedAt && `submitted ${londonStamp(sheet.submittedAt)}`,
      sheet.approvedAt && `approved in app ${londonStamp(sheet.approvedAt)}`,
    ]
      .filter(Boolean)
      .join("  ·  ");
    t(appLine, R, H - 9, { size: 6, color: muted, align: "right" });
  }

  // Very long notes carry on to an extra page.
  if (overflow.length) {
    let page: PDFPage = pdf.addPage([W, H]);
    let y = 40;
    page.drawText(safe(bold, `Other details (continued) – ${workerName}, week ending ${ddmmyyyy(addDays(sheet.weekStart, 6))}`), { x: L, y: H - y, size: 11, font: bold });
    y += 20;
    for (const line of overflow) {
      if (y > H - 30) {
        page = pdf.addPage([W, H]);
        y = 40;
      }
      page.drawText(safe(regular, line), { x: L, y: H - y, size: 9, font: regular, color: ink });
      y += 12;
    }
  }
  return pdf.save();
}

/** Expense details and the worker's notes, for the "Other details" box. */
function buildOtherDetails(sheet: Timesheet): string {
  const parts: string[] = [];
  const expenses = (sheet.expenses ?? []).filter((e) => !expenseError(e) && parsePounds(e.amount));
  if (expenses.length) {
    parts.push(
      "Expenses: " +
        expenses.map((e) => `${e.jobNumber.trim() || "no job no."} £${pounds(parsePounds(e.amount)!)}${e.description.trim() ? ` ${e.description.trim()}` : ""}`).join("; ") +
        ".",
    );
  }
  if (sheet.notes?.trim()) parts.push(sheet.notes.trim());
  return parts.join("\n");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      let safeNext = next;
      try {
        font.encodeText(next);
      } catch {
        safeNext = next.replace(/[^\x20-\x7E£]/g, "?");
      }
      if (font.widthOfTextAtSize(safeNext, size) > maxWidth && line) {
        out.push(line);
        line = word;
      } else line = safeNext;
    }
    if (line) out.push(line);
  }
  return out;
}
