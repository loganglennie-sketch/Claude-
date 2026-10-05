"use client";

/**
 * LIVE addresses: the signed-in worker's own timesheets, read from and saved
 * to the database (the security rules only ever return their own).
 *
 * Works without signal: every change is kept on the phone straight away
 * (an "outbox") and sent when there is signal. A timesheet signed with no
 * signal is queued and submits itself as soon as the phone is back online.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { brand } from "@/config/brand";
import { useAppMode, type AppMode } from "@/lib/app-mode";
import { normaliseTimesheet } from "@/lib/jobs";
import { browserClient } from "@/lib/supabase/browser";
import type { Timesheet } from "@/lib/types";

/** "offline" = kept on the phone, waiting for signal to send. */
export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "error";
type State = {
  userId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  sheets: Record<string, Timesheet>;
  save: SaveStatus;
  /** Last attempt to reach the server failed for lack of signal. */
  offline: boolean;
};

const EMPTY: State = { userId: null, status: "idle", sheets: {}, save: "idle", offline: false };
let state: State = EMPTY;
const listeners = new Set<() => void>();
const update = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

let db: SupabaseClient | null = null;
const SAVE_DELAY_MS = 800;
const RETRY_MS = 30_000;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

// ── Copy kept on the phone ────────────────────────────────────────────
type Outbox = {
  /** Latest version of each week not yet saved to the server. */
  drafts: Record<string, { sheet: Timesheet; at: number }>;
  /** Weeks signed and waiting for signal to submit. */
  submits: Record<string, { sheet: Timesheet; signature: string; at: number }>;
};
type Local = { cache: Record<string, Timesheet>; outbox: Outbox };
const CACHE_WEEKS = 12;
const localKey = (userId: string) => `timesheets:live:v1:${userId}`;
const emptyLocal = (): Local => ({ cache: {}, outbox: { drafts: {}, submits: {} } });

function readLocal(userId: string): Local {
  try {
    const raw = localStorage.getItem(localKey(userId));
    if (!raw) return emptyLocal();
    const parsed = JSON.parse(raw) as Partial<Local>;
    return { cache: parsed.cache ?? {}, outbox: { drafts: parsed.outbox?.drafts ?? {}, submits: parsed.outbox?.submits ?? {} } };
  } catch {
    return emptyLocal();
  }
}
function writeLocal(userId: string, local: Local) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(local));
  } catch {
    // Storage full or blocked: still works online, just not without signal.
  }
}
function changeLocal(fn: (local: Local) => void) {
  if (!state.userId) return;
  const local = readLocal(state.userId);
  fn(local);
  writeLocal(state.userId, local);
}
/** The last few weeks as the server had them, without signature pictures (to keep it small). */
function cacheFromSheets(sheets: Record<string, Timesheet>): Record<string, Timesheet> {
  const weeks = Object.keys(sheets).sort().reverse().slice(0, CACHE_WEEKS);
  return Object.fromEntries(weeks.map((w) => [w, { ...sheets[w], signature: undefined, queued: undefined, sendError: undefined }]));
}

/** Unsent changes on this phone for the signed-in worker. */
export function unsentCount(): number {
  if (!state.userId) return 0;
  const { outbox } = readLocal(state.userId);
  return Object.keys(outbox.drafts).length + Object.keys(outbox.submits).length;
}

/** Signing out: forget the copy of past weeks, but keep anything not yet sent. */
export function forgetLocalCopy() {
  changeLocal((local) => (local.cache = {}));
}

// No signal (or the server couldn't be reached) rather than a real problem with the timesheet.
function isConnectionProblem(error: { message?: string; code?: string; status?: number } | null): boolean {
  if (!error) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|aborted/i.test(error.message ?? "") || error.status === 0;
}

type Row = {
  week_start: string;
  status: Timesheet["status"];
  content: { days?: Timesheet["days"]; expenses?: Timesheet["expenses"]; notes?: string } | null;
  reference: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  signatures: { image_png: string } | { image_png: string }[] | null;
};

export function rowToSheet(r: Row): Timesheet {
  const sig = Array.isArray(r.signatures) ? r.signatures[0] : r.signatures;
  return normaliseTimesheet({
    weekStart: r.week_start,
    days: r.content?.days ?? [],
    expenses: r.content?.expenses ?? [],
    notes: r.content?.notes ?? "",
    status: r.status,
    reference: r.reference ?? undefined,
    submittedAt: r.submitted_at ?? undefined,
    approvedAt: r.approved_at ?? undefined,
    signature: sig?.image_png ?? undefined,
  });
}
/** What gets stored for a week: the days, plus expenses and notes. */
export const sheetContent = (sheet: Timesheet) => ({ weekStart: sheet.weekStart, days: sheet.days, expenses: sheet.expenses ?? [], notes: sheet.notes ?? "" });

export const SHEET_COLUMNS = "week_start, status, content, reference, submitted_at, approved_at, signatures(image_png)";

let loadingFor: string | null = null;

async function load(mode: AppMode) {
  if (!mode.supabase || !mode.me) return;
  const userId = mode.me.id;
  loadingFor = userId;
  const client = browserClient(mode.supabase.url, mode.supabase.publishableKey);
  db = client;
  pending.forEach(clearTimeout);
  pending.clear();

  // Show what's on the phone straight away (works with no signal).
  const local = readLocal(userId);
  const fromPhone = withOutbox({ ...local.cache }, local.outbox);
  const hasLocal = Object.keys(fromPhone).length > 0;
  update({ ...EMPTY, userId, status: hasLocal ? "ready" : "loading", sheets: fromPhone });

  let data: unknown[] | null = null;
  let error: { message?: string } | null = null;
  try {
    ({ data, error } = await client.from("timesheets").select(SHEET_COLUMNS).eq("user_id", userId).order("week_start", { ascending: false }).limit(104));
  } catch (e) {
    error = { message: String(e) };
  }
  if (loadingFor !== userId) return; // someone else signed in meanwhile
  if (error || !data) {
    // No signal: carry on with the copy on the phone (a fresh week if there's nothing yet).
    if (isConnectionProblem(error)) return update({ status: "ready", offline: true });
    return update({ status: hasLocal ? "ready" : "error" });
  }
  const server: Record<string, Timesheet> = {};
  for (const r of data as Row[]) {
    const sheet = rowToSheet(r);
    // A draft saved with no days yet is treated like a fresh week.
    if (sheet.status !== "draft" || sheet.days.length === 7) server[sheet.weekStart] = sheet;
  }
  changeLocal((l) => {
    l.cache = cacheFromSheets(server);
    // Anything the server already has as submitted no longer needs sending.
    for (const week of Object.keys(l.outbox.drafts)) if (server[week] && server[week].status !== "draft") delete l.outbox.drafts[week];
    for (const week of Object.keys(l.outbox.submits)) if (server[week] && server[week].status !== "draft") delete l.outbox.submits[week];
  });
  update({ status: "ready", offline: false, sheets: withOutbox(server, readLocal(userId).outbox) });
  void sync();
}

/** Server (or cached) weeks with the phone's unsent changes laid on top. */
function withOutbox(sheets: Record<string, Timesheet>, outbox: Outbox): Record<string, Timesheet> {
  const out = { ...sheets };
  for (const [week, { sheet }] of Object.entries(outbox.drafts)) {
    if (!out[week] || out[week].status === "draft") out[week] = { ...sheet, status: "draft" };
  }
  for (const [week, { sheet }] of Object.entries(outbox.submits)) {
    if (!out[week] || out[week].status === "draft") out[week] = { ...sheet, status: "draft", queued: true };
  }
  return out;
}

async function sendDraft(sheet: Timesheet): Promise<{ message?: string } | null> {
  if (!db) return { message: "Not signed in" };
  try {
    const { error } = await db.rpc("save_draft", { p_week_start: sheet.weekStart, p_content: sheetContent(sheet) });
    return error;
  } catch (e) {
    return { message: String(e) };
  }
}

async function writeDraft(sheet: Timesheet, at: number): Promise<string | null> {
  update({ save: "saving" });
  const error = await sendDraft(sheet);
  if (!error) {
    changeLocal((l) => {
      if (l.outbox.drafts[sheet.weekStart]?.at === at) delete l.outbox.drafts[sheet.weekStart];
    });
    update({ save: "saved", offline: false });
    return null;
  }
  if (isConnectionProblem(error)) {
    update({ save: "offline", offline: true });
    return null; // kept on the phone; sent later
  }
  update({ save: "error" });
  return error.message ?? "Couldn't save";
}

/** Keeps the week on the phone at once, and sends it shortly after the worker stops typing. */
export function saveDraftLive(sheet: Timesheet) {
  const current = state.sheets[sheet.weekStart];
  if ((current && current.status !== "draft") || current?.queued) return;
  const at = Date.now();
  const clean = { ...sheet, status: "draft" as const, queued: undefined, sendError: undefined };
  changeLocal((l) => (l.outbox.drafts[sheet.weekStart] = { sheet: clean, at }));
  update({ sheets: { ...state.sheets, [sheet.weekStart]: clean } });
  const existing = pending.get(sheet.weekStart);
  if (existing) clearTimeout(existing);
  pending.set(
    sheet.weekStart,
    setTimeout(() => {
      pending.delete(sheet.weekStart);
      void writeDraft(clean, at);
    }, SAVE_DELAY_MS),
  );
}

/** Sends anything still waiting (e.g. when the phone screen is switched off). */
export function flushDrafts() {
  for (const [week, timer] of pending) {
    clearTimeout(timer);
    pending.delete(week);
  }
  void sync();
}

type SubmitResult = { ok: true; queued?: boolean } | { ok: false; error: string };

async function sendSubmit(sheet: Timesheet, signature: string): Promise<{ ok: true } | { ok: false; error: string; connection: boolean }> {
  if (!db) return { ok: false, error: "Please sign in again.", connection: true };
  const saveError = await sendDraft(sheet);
  if (saveError) return { ok: false, error: saveError.message ?? "Couldn't save", connection: isConnectionProblem(saveError) };
  let error: { message?: string } | null = null;
  try {
    ({ error } = await db.rpc("submit_timesheet", { p_week_start: sheet.weekStart, p_signature_png: signature, p_declaration: `${brand.declaration}.` }));
  } catch (e) {
    error = { message: String(e) };
  }
  // Sent before but the reply was lost: it's in, so treat it as done.
  if (error && !/already been submitted/i.test(error.message ?? "")) return { ok: false, error: error.message ?? "Couldn't submit", connection: isConnectionProblem(error) };
  try {
    const { data } = await db.from("timesheets").select(SHEET_COLUMNS).eq("week_start", sheet.weekStart).neq("status", "draft").maybeSingle();
    if (data) update({ sheets: { ...state.sheets, [sheet.weekStart]: rowToSheet(data as Row) } });
  } catch {
    // shown properly next time the list loads
  }
  return { ok: true };
}

/** Signs the week off. With no signal it's queued on the phone and sends itself later. */
export async function submitLive(sheet: Timesheet, signature: string): Promise<SubmitResult> {
  const waiting = pending.get(sheet.weekStart);
  if (waiting) {
    clearTimeout(waiting);
    pending.delete(sheet.weekStart);
  }
  const clean = { ...sheet, status: "draft" as const, queued: undefined, sendError: undefined };
  const queue = () => {
    changeLocal((l) => {
      l.outbox.submits[sheet.weekStart] = { sheet: clean, signature, at: Date.now() };
      delete l.outbox.drafts[sheet.weekStart];
    });
    update({ offline: true, save: "offline", sheets: { ...state.sheets, [sheet.weekStart]: { ...clean, queued: true } } });
    return { ok: true as const, queued: true };
  };
  if (typeof navigator !== "undefined" && !navigator.onLine) return queue();
  const result = await sendSubmit(clean, signature);
  if (result.ok) {
    changeLocal((l) => {
      delete l.outbox.drafts[sheet.weekStart];
      delete l.outbox.submits[sheet.weekStart];
    });
    update({ offline: false, save: "saved" });
    return { ok: true };
  }
  if (result.connection) return queue();
  return { ok: false, error: result.error };
}

let syncing = false;
/** Sends everything waiting on the phone. Safe to call often. */
async function sync() {
  if (syncing || !db || !state.userId) return;
  syncing = true;
  try {
    const { outbox } = readLocal(state.userId);
    for (const [week, { sheet, at }] of Object.entries(outbox.drafts)) {
      if (outbox.submits[week]) continue;
      update({ save: "saving" });
      const error = await sendDraft(sheet);
      if (error && isConnectionProblem(error)) return update({ save: "offline", offline: true });
      changeLocal((l) => {
        if (l.outbox.drafts[week]?.at === at) delete l.outbox.drafts[week];
      });
      update({ save: error ? "error" : "saved", offline: false });
    }
    for (const [week, { sheet, signature }] of Object.entries(outbox.submits)) {
      const result = await sendSubmit(sheet, signature);
      if (!result.ok && result.connection) return update({ save: "offline", offline: true });
      changeLocal((l) => {
        delete l.outbox.submits[week];
        if (!result.ok) l.outbox.drafts[week] = { sheet, at: Date.now() };
      });
      if (!result.ok) {
        // The database refused it (e.g. a rule changed): back to the worker to fix and resend.
        update({ sheets: { ...state.sheets, [week]: { ...sheet, status: "draft", queued: undefined, sendError: result.error } } });
      }
      update({ offline: false });
    }
  } finally {
    syncing = false;
  }
}

/** The signed-in worker's timesheets (loads once per person; reloads if someone else signs in). */
export function useLiveWorkerSheets(): State {
  const mode = useAppMode();
  const snapshot = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  useEffect(() => {
    if (mode.live && mode.me && state.userId !== mode.me.id) void load(mode);
  }, [mode]);
  useEffect(() => {
    if (!mode.live) return;
    const onVisibility = () => (document.visibilityState === "hidden" ? flushDrafts() : void sync());
    const onOnline = () => void sync();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    // Keep trying every 30 seconds while something is waiting.
    const timer = setInterval(() => unsentCount() > 0 && void sync(), RETRY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      clearInterval(timer);
    };
  }, [mode.live]);
  return snapshot;
}
