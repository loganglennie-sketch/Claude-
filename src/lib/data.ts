"use client";

/**
 * One front door for the worker's timesheets: the on-device demo store, or the
 * database on live addresses. Screens use these and don't need to know which.
 */
import { useAppMode } from "./app-mode";
import { saveDraft as saveDemoDraft, submitTimesheet as submitDemo, useHydrated, useTimesheets } from "./demo-store";
import { saveDraftLive, submitLive, useLiveWorkerSheets, type SaveStatus } from "./live/worker-store";
import type { Timesheet } from "./types";

export type WorkerSheets = {
  live: boolean;
  ready: boolean;
  loadError: boolean;
  sheets: Record<string, Timesheet>;
  saveStatus: SaveStatus;
};

export function useWorkerSheets(): WorkerSheets {
  const mode = useAppMode();
  const demoReady = useHydrated();
  const demoSheets = useTimesheets();
  const live = useLiveWorkerSheets();
  if (!mode.live) return { live: false, ready: demoReady, loadError: false, sheets: demoSheets, saveStatus: "idle" };
  return { live: true, ready: live.status === "ready", loadError: live.status === "error", sheets: live.sheets, saveStatus: live.save };
}

export function saveSheet(live: boolean, sheet: Timesheet) {
  if (live) saveDraftLive(sheet);
  else saveDemoDraft(sheet);
}

/** queued: signed with no signal; it sends itself when the phone is back online. */
export async function submitSheet(live: boolean, sheet: Timesheet, signature: string): Promise<{ ok: true; queued?: boolean } | { ok: false; error: string }> {
  if (live) return submitLive(sheet, signature);
  submitDemo(sheet.weekStart, signature);
  return { ok: true };
}
