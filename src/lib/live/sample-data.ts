import "server-only";
import { deflateSync } from "node:zlib";
import { entryMinutes, entrySpan } from "@/lib/hours";
import type { Timesheet } from "@/lib/types";

/** One row for the job_entries table, worked out from a week as the worker filled it in. */
export function jobEntryRows(sheet: Timesheet) {
  return sheet.days
    .filter((d) => d.worked)
    .flatMap((day) =>
      day.jobs
        .map((job) => ({ job, span: entrySpan(job), minutes: entryMinutes(job).minutes }))
        .filter((j) => j.minutes > 0)
        .sort((a, b) => (a.span?.start ?? 0) - (b.span?.start ?? 0))
        .map(({ job, span, minutes }, position) => ({
          work_date: day.date,
          position,
          job_number: job.jobNumber,
          start_time: span ? job.start : null,
          finish_time: span ? job.finish : null,
          break_minutes: span ? job.breakMins : 0,
          overnight: span?.overnight ?? false,
          minutes,
        })),
    );
}

// ── Sample signatures ────────────────────────────────────────────────
// The database only accepts PNG images. The made-up signatures are SVG
// paths (300×90), so draw them into a small PNG here.
const W = 600;
const H = 180;
const SCALE = 2;

export function signaturePathToPng(path: string): string {
  const alpha = new Uint8Array(W * H);
  const dot = (x: number, y: number) => {
    const r = 2.2;
    for (let py = Math.floor(y - r); py <= Math.ceil(y + r); py++) {
      for (let px = Math.floor(x - r); px <= Math.ceil(x + r); px++) {
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const d = Math.hypot(px - x, py - y);
        const a = Math.max(0, Math.min(1, r + 0.5 - d)) * 255;
        if (a > alpha[py * W + px]) alpha[py * W + px] = a;
      }
    }
  };
  const curve = (pts: [number, number][]) => {
    const steps = 400; // enough for a smooth line across the whole box
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // De Casteljau: works for quadratic and cubic curves alike.
      let p = pts.map((q) => [...q] as [number, number]);
      while (p.length > 1) p = p.slice(1).map((q, k) => [p[k][0] + (q[0] - p[k][0]) * t, p[k][1] + (q[1] - p[k][1]) * t] as [number, number]);
      dot(p[0][0] * SCALE, p[0][1] * SCALE);
    }
  };

  const tokens = path.replace(/,/g, " ").trim().split(/\s+/);
  let i = 0;
  const num = () => Number(tokens[i++]);
  let cur: [number, number] = [0, 0];
  let lastCtrl: [number, number] | null = null;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "M") {
      cur = [num(), num()];
      lastCtrl = null;
    } else if (cmd === "C") {
      const c1: [number, number] = [num(), num()];
      const c2: [number, number] = [num(), num()];
      const end: [number, number] = [num(), num()];
      curve([cur, c1, c2, end]);
      lastCtrl = c2;
      cur = end;
    } else if (cmd === "S") {
      const c1: [number, number] = lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
      const c2: [number, number] = [num(), num()];
      const end: [number, number] = [num(), num()];
      curve([cur, c1, c2, end]);
      lastCtrl = c2;
      cur = end;
    } else if (cmd === "Q") {
      const c: [number, number] = [num(), num()];
      const end: [number, number] = [num(), num()];
      curve([cur, c, end]);
      lastCtrl = null;
      cur = end;
    } else {
      break; // not something the sample generator makes
    }
  }

  // Dark ink on a transparent background, one filter byte (0) per row.
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * (W * 4 + 1) + 1 + x * 4;
      raw[o] = 0x1a;
      raw[o + 1] = 0x20;
      raw[o + 2] = 0x33;
      raw[o + 3] = alpha[y * W + x];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}
