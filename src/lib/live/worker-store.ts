"use client";

/**
 * LIVE addresses: the signed-in worker's own timesheets, read from and saved
 * to the database (the security rules only ever return their own).
 */
import { useEffect, useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { brand } from "@/config/brand";
import { useAppMode, type AppMode } from "@/lib/app-mode";
import { normaliseTimesheet } from "@/lib/jobs";
import { browserClient } from "@/lib/supabase/browser";
import type { Timesheet } from "@/lib/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
type State = { userId: string | null; status: "idle" | "loading" | "ready" | "error"; sheets: Record<string, Timesheet>; save: SaveStatus };

const EMPTY: State = { userId: null, status: "idle", sheets: {}, save: "idle" };
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
const pending = new Map<string, { sheet: Timesheet; timer: ReturnType<typeof setTimeout> }>();

type Row = {
  week_start: string;
  status: Timesheet["status"];
  content: { days?: Timesheet["days"] } | null;
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
    status: r.status,
    reference: r.reference ?? undefined,
    submittedAt: r.submitted_at ?? undefined,
    approvedAt: r.approved_at ?? undefined,
    signature: sig?.image_png ?? undefined,
  });
}
export const SHEET_COLUMNS = "week_start, status, content, reference, submitted_at, approved_at, signatures(image_png)";

async function load(mode: AppMode) {
  if (!mode.supabase || !mode.me) return;
  const client = browserClient(mode.supabase.url, mode.supabase.publishableKey);
  db = client;
  pending.clear();
  update({ ...EMPTY, userId: mode.me.id, status: "loading" });
  const { data, error } = await client.from("timesheets").select(SHEET_COLUMNS).eq("user_id", mode.me.id).order("week_start", { ascending: false }).limit(104);
  if (error) return update({ status: "error" });
  const sheets: Record<string, Timesheet> = {};
  for (const r of (data ?? []) as Row[]) {
    const sheet = rowToSheet(r);
    // A draft saved with no days yet is treated like a fresh week.
    if (sheet.status !== "draft" || sheet.days.length === 7) sheets[sheet.weekStart] = sheet;
  }
  update({ status: "ready", sheets });
}

async function writeDraft(sheet: Timesheet): Promise<string | null> {
  if (!db) return "Not signed in";
  update({ save: "saving" });
  const { error } = await db.rpc("save_draft", { p_week_start: sheet.weekStart, p_content: { weekStart: sheet.weekStart, days: sheet.days } });
  update({ save: error ? "error" : "saved" });
  return error ? error.message : null;
}

/** Saves the week shortly after the worker stops typing. */
export function saveDraftLive(sheet: Timesheet) {
  if (state.sheets[sheet.weekStart] && state.sheets[sheet.weekStart].status !== "draft") return;
  update({ sheets: { ...state.sheets, [sheet.weekStart]: { ...sheet, status: "draft" } } });
  const existing = pending.get(sheet.weekStart);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    pending.delete(sheet.weekStart);
    void writeDraft(sheet);
  }, SAVE_DELAY_MS);
  pending.set(sheet.weekStart, { sheet, timer });
}

/** Saves anything still waiting (e.g. when the phone screen is switched off). */
export function flushDrafts() {
  for (const [week, { sheet, timer }] of pending) {
    clearTimeout(timer);
    pending.delete(week);
    void writeDraft(sheet);
  }
}

/** Saves the final version, then the database checks everything and locks it. */
export async function submitLive(sheet: Timesheet, signature: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!db) return { ok: false, error: "Please sign in again." };
  const waiting = pending.get(sheet.weekStart);
  if (waiting) {
    clearTimeout(waiting.timer);
    pending.delete(sheet.weekStart);
  }
  const saveError = await writeDraft(sheet);
  if (saveError) return { ok: false, error: saveError };
  const { error } = await db.rpc("submit_timesheet", {
    p_week_start: sheet.weekStart,
    p_signature_png: signature,
    p_declaration: `${brand.declaration}.`,
  });
  if (error) return { ok: false, error: error.message };
  const { data } = await db.from("timesheets").select(SHEET_COLUMNS).eq("week_start", sheet.weekStart).eq("status", "submitted").maybeSingle();
  if (data) update({ sheets: { ...state.sheets, [sheet.weekStart]: rowToSheet(data as Row) } });
  return { ok: true };
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
    const onHide = () => document.visibilityState === "hidden" && flushDrafts();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [mode.live]);
  return snapshot;
}
