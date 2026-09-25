"use client";

/**
 * DEMO ONLY: lets one demo app be shown to several businesses.
 * Opening a link like /?company=Smith%20Joinery shows "Smith Joinery"
 * instead of the name in brand.ts, and remembers it on that device.
 * Opening /?company= (empty) goes back to the default name.
 */
import { useEffect, useSyncExternalStore } from "react";
import { brand } from "@/config/brand";

const KEY = "timesheets:demo:company";
const MAX_LENGTH = 60;
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useCompanyName(): string {
  return useSyncExternalStore(subscribe, read, () => null) || brand.companyName;
}

/** Picks up ?company= from the address bar. Mounted once in the root layout. */
export function CompanyFromLink() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("company")) return;
    const name = (params.get("company") ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_LENGTH);
    try {
      if (name) localStorage.setItem(KEY, name);
      else localStorage.removeItem(KEY);
    } catch {
      return;
    }
    listeners.forEach((l) => l());
  }, []);
  return null;
}

export function CompanyName() {
  return <>{useCompanyName()}</>;
}
