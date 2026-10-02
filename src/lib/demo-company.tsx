"use client";

/**
 * DEMO ONLY: lets one demo app be shown to several businesses.
 *  - /?demo=nicol switches this device to a test company from demo-companies.ts
 *    (its logo, colours, made-up team and job numbers). /?demo= goes back.
 *  - /?company=Smith%20Joinery just shows a different company name.
 *    /?company= (empty) goes back to the normal name.
 * Both are remembered on the device.
 */
import { useEffect, useSyncExternalStore } from "react";
import { colourVars, DEMO_COMPANIES, findDemoCompany, PRESET_KEY, type DemoCompany } from "@/config/demo-companies";

const NAME_KEY = "timesheets:demo:company";
const MAX_LENGTH = 60;
const listeners = new Set<() => void>();

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Private browsing etc. – the demo still works, it just won't remember.
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useDemoCompany(): DemoCompany {
  return findDemoCompany(useSyncExternalStore(subscribe, () => get(PRESET_KEY), () => null));
}

export function useCompanyName(): string {
  const company = useDemoCompany();
  return useSyncExternalStore(subscribe, () => get(NAME_KEY), () => null) || company.companyName;
}

function applyColours(company: DemoCompany) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(colourVars(company.colours))) root.style.setProperty(name, value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", company.colours.primary);
}

/** Picks up ?demo= and ?company= from the address bar. Mounted once in the root layout. */
export function CompanyFromLink() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("demo")) {
      const id = params.get("demo") ?? "";
      set(PRESET_KEY, DEMO_COMPANIES[id] ? id : null);
      set(NAME_KEY, null); // a test company brings its own name
    }
    if (params.has("company")) {
      set(NAME_KEY, (params.get("company") ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_LENGTH) || null);
    }
    applyColours(findDemoCompany(get(PRESET_KEY)));
    listeners.forEach((l) => l());
  }, []);
  return null;
}

export function CompanyName() {
  return <>{useCompanyName()}</>;
}

export function CompanyIcon({ className }: { className?: string }) {
  const company = useDemoCompany();
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={company.iconPath} alt="" width={40} height={40} className={className} />;
}
