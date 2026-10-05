"use client";

/**
 * DEMO ONLY: lets one demo app be shown to several businesses.
 *  - /?demo=nicol switches this device to a test company from demo-companies.ts
 *    (its logo, colours, made-up team and job numbers). /?demo= goes back.
 *  - An address containing a company's hostKeyword (e.g. nicolofskene-…vercel.app)
 *    opens as that company without any ?demo= part.
 *  - /?company=Smith%20Joinery just shows a different company name.
 *    /?company= (empty) goes back to the normal name.
 * Both are remembered on the device.
 */
import { useEffect, useSyncExternalStore } from "react";
import { colourVars, companyIdForHost, DEMO_COMPANIES, findDemoCompany, PRESET_KEY, type DemoCompany } from "@/config/demo-companies";
import { useAppMode } from "./app-mode";

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

/** The chosen test company: picked by link on this device, otherwise by web address. */
function chosenId(): string | null {
  return get(PRESET_KEY) ?? companyIdForHost(window.location.hostname);
}

export function useDemoCompany(): DemoCompany {
  const { live, company: liveCompany } = useAppMode();
  const demo = findDemoCompany(useSyncExternalStore(subscribe, chosenId, () => null));
  const byAddress = useSyncExternalStore(subscribe, () => companyIdForHost(window.location.hostname), () => null);
  if (!live || !liveCompany) return demo;
  // Live: branding from the company's look (by its short name, or failing that its web
  // address); name and rules from the database. No made-up team or job numbers.
  const look = DEMO_COMPANIES[liveCompany.slug] ?? findDemoCompany(byAddress);
  return {
    ...look,
    companyName: liveCompany.name,
    entryMode: liveCompany.entry_mode,
    showOvertime: liveCompany.show_overtime,
    team: [],
    jobs: [],
  };
}

export function useCompanyName(): string {
  const company = useDemoCompany();
  const { live } = useAppMode();
  const override = useSyncExternalStore(subscribe, () => get(NAME_KEY), () => null);
  return (!live && override) || company.companyName;
}

function applyColours(company: DemoCompany) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(colourVars(company.colours))) root.style.setProperty(name, value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", company.colours.primary);
  // Home-screen icon and manifest, for when ?demo= picked a company on another address.
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]').forEach((link) => {
    const href = link.getAttribute("href");
    if (href?.startsWith("/icons/")) link.setAttribute("href", href.replace(/^\/icons\/[^/]+\//, `${company.iconSet}/`));
  });
}

/** Picks up ?demo= and ?company= from the address bar. Mounted once in the root layout. */
export function CompanyFromLink() {
  const { live, company } = useAppMode();
  useEffect(() => {
    // Live addresses always show their own company; demo links are ignored there.
    if (live && company) {
      applyColours(DEMO_COMPANIES[company.slug] ?? findDemoCompany(companyIdForHost(window.location.hostname)));
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.has("demo")) {
      const id = params.get("demo") ?? "";
      // "default" is stored explicitly so ?demo= also works on a company's own address.
      set(PRESET_KEY, DEMO_COMPANIES[id] ? id : "default");
      set(NAME_KEY, null); // a test company brings its own name
    }
    if (params.has("company")) {
      set(NAME_KEY, (params.get("company") ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_LENGTH) || null);
    }
    applyColours(findDemoCompany(chosenId()));
    listeners.forEach((l) => l());
  }, [live, company]);
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
