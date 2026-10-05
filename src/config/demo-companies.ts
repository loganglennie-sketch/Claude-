/**
 * DEMO ONLY: test companies that can be shown from the same app.
 * Open the app with ?demo=<id> (e.g. ?demo=nicol) to switch a device to one;
 * ?demo= (empty) goes back to the normal setup in brand.ts.
 * A company can also be picked automatically by web address: any address
 * containing its hostKeyword (e.g. nicolofskene-timesheets.vercel.app) opens as it.
 * The real app for a company uses brand.ts instead of this file.
 */
import { brand, type EntryMode } from "./brand";

export type Colours = Record<keyof typeof brand.colours, string>;
export type DemoStatus = "approved" | "submitted" | "not_submitted";
export type DemoCompany = {
  id: string;
  companyName: string;
  logoPath: string;
  iconPath: string;
  logoIncludesName: boolean;
  /** How workers record each job (see EntryMode in brand.ts). */
  entryMode: EntryMode;
  /** Show "overtime over 40h" figures (see brand.ts). */
  showOvertime: boolean;
  /** Folder in /public holding home-screen icons and manifest.webmanifest. */
  iconSet: string;
  colours: Colours;
  /** Made-up workers shown on the payroll dashboard. */
  team: { id: string; name: string; role: string }[];
  /** Status of each team member's timesheet in the latest week (older weeks are all approved). */
  latestStatuses: DemoStatus[];
  /** Job numbers used in the made-up timesheets, and suggested to the demo worker. */
  jobs: string[];
  /** Web addresses containing this word open as this company. */
  hostKeyword?: string;
};

export const DEFAULT_COMPANY: DemoCompany = {
  id: "default",
  companyName: brand.companyName,
  logoPath: brand.logoPath,
  iconPath: brand.iconPath,
  logoIncludesName: brand.logoIncludesName,
  entryMode: brand.entryMode,
  showOvertime: brand.showOvertime,
  iconSet: "/icons/default",
  colours: { ...brand.colours },
  team: [
    { id: "w1", name: "Aaron Mitchell", role: "Joiner" },
    { id: "w2", name: "Bethany Clarke", role: "Electrician" },
    { id: "w3", name: "Callum Reid", role: "Plumber" },
    { id: "w4", name: "Dev Patel", role: "Apprentice" },
    { id: "w5", name: "Ewan Fraser", role: "Labourer" },
    { id: "w6", name: "Grace Thompson", role: "Plasterer" },
    { id: "w7", name: "Harry Wilson", role: "Site supervisor" },
    { id: "w8", name: "Jamie O'Neill", role: "Roofer" },
  ],
  latestStatuses: ["approved", "submitted", "submitted", "not_submitted", "submitted", "approved", "submitted", "not_submitted"],
  jobs: ["1042", "1051", "1063", "1077", "1088", "1094"],
};

export const DEMO_COMPANIES: Record<string, DemoCompany> = {
  nicol: {
    id: "nicol",
    hostKeyword: "nicol",
    companyName: "Nicol of Skene",
    logoPath: "/demo/nicol-logo.png",
    iconPath: "/demo/nicol-icon.png",
    logoIncludesName: true,
    // Pay depends on when work was done (day, evening, night, weekend), so every job needs clock times.
    entryMode: "times",
    // Their job costing program applies all pay rules, so the app shows hours only.
    showOvertime: false,
    iconSet: "/icons/nicol",
    colours: {
      primary: "#224596", // blue from the logo
      primaryDark: "#1A3573",
      accent: "#E73B2D", // thistle red from the logo
      primarySoft: "#E4EAF6",
      background: "#F6F7FB",
      surface: "#FFFFFF",
      text: "#1A2033",
      muted: "#5F6678",
      border: "#DDE2EE",
      danger: "#B3261E",
    },
    team: [
      { id: "n1", name: "Calum Ross", role: "Joiner" },
      { id: "n2", name: "Fraser McLeod", role: "Bricklayer" },
      { id: "n3", name: "Kirsty Duncan", role: "Site manager" },
      { id: "n4", name: "Iain Gordon", role: "Groundworker" },
      { id: "n5", name: "Lewis Anderson", role: "Apprentice joiner" },
    ],
    latestStatuses: ["approved", "submitted", "submitted", "not_submitted", "submitted"],
    jobs: ["3105", "3112", "3118", "3124", "3131", "3137"],
  },
};

export const findDemoCompany = (id: string | null | undefined): DemoCompany => (id && DEMO_COMPANIES[id]) || DEFAULT_COMPANY;

/** The test company a web address belongs to, if any (e.g. "nicolofskene-timesheets.vercel.app" → "nicol"). */
export function companyIdForHost(hostname: string): string | null {
  const host = hostname.toLowerCase();
  return Object.values(DEMO_COMPANIES).find((c) => c.hostKeyword && host.includes(c.hostKeyword))?.id ?? null;
}

/** The colour settings as the CSS variables the pages use. */
export function colourVars(c: Colours): Record<string, string> {
  return {
    "--brand-primary": c.primary,
    "--brand-primary-dark": c.primaryDark,
    "--brand-primary-soft": c.primarySoft,
    "--brand-accent": c.accent,
    "--brand-background": c.background,
    "--brand-surface": c.surface,
    "--brand-text": c.text,
    "--brand-muted": c.muted,
    "--brand-border": c.border,
    "--brand-danger": c.danger,
  };
}

/** Where the chosen test company is remembered on the device. */
export const PRESET_KEY = "timesheets:demo:preset";

/**
 * Tiny script for <head>: applies a saved test company's colours before the
 * page is drawn, so it doesn't flash in the default colours first.
 */
export function earlyColourScript(): string {
  const map = Object.fromEntries(Object.entries(DEMO_COMPANIES).map(([id, c]) => [id, colourVars(c.colours)]));
  const hosts = Object.values(DEMO_COMPANIES).filter((c) => c.hostKeyword).map((c) => [c.hostKeyword, c.id]);
  return `try{if(document.documentElement.dataset.live)throw 0;var m=${JSON.stringify(map)},h=${JSON.stringify(hosts)},id=null;try{id=localStorage.getItem(${JSON.stringify(PRESET_KEY)})}catch(e){}if(!id)for(var i=0;i<h.length;i++)if(location.hostname.toLowerCase().indexOf(h[i][0])>-1)id=h[i][1];var v=m[id];if(v)for(var k in v)document.documentElement.style.setProperty(k,v[k])}catch(e){}`;
}
