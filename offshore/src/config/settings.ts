/**
 * ─────────────────────────────────────────────────────────────
 *  SETTINGS: the one file to edit when setting the app up for a
 *  different contractor. Everything else reads from here.
 * ─────────────────────────────────────────────────────────────
 */

export const settings = {
  /** The service company (shown in headers, the supervisor's page and PDFs). */
  companyName: "Granite Offshore Services",
  /** Short name under the app icon on a phone's home screen. */
  shortName: "Offshore Trips",

  colours: {
    primary: "#0F4C6E",
    primaryDark: "#0A3650",
    primarySoft: "#E1EEF5",
    background: "#F4F6F8",
    surface: "#FFFFFF",
    text: "#14212B",
    muted: "#5E6B75",
    border: "#D9E0E6",
    danger: "#B3261E",
    warning: "#9A5B00",
    success: "#1E6B3A",
  },

  /** What the technician ticks before signing. */
  workerDeclaration: "I confirm this is a true record of my days and hours on this trip",
  /** What the client's supervisor ticks before approving. */
  clientDeclaration: "I confirm the days and hours on this trip are correct",
} as const;

/**
 * The kinds of day a technician can record, and the hours each one counts as.
 * Change the hours here if your contracts count them differently
 * (e.g. a travel day paid as 12 hours). "Custom" lets the technician type the hours.
 */
export const DAY_TYPES = {
  day: { label: "Day shift", short: "Day", hours: 12, worked: true, colour: "bg-sky-100 text-sky-900 border-sky-300" },
  night: { label: "Night shift", short: "Night", hours: 12, worked: true, colour: "bg-indigo-100 text-indigo-900 border-indigo-300" },
  travel: { label: "Travel day", short: "Travel", hours: 8, worked: true, colour: "bg-amber-100 text-amber-900 border-amber-300" },
  standby: { label: "Standby / weather", short: "Standby", hours: 12, worked: true, colour: "bg-teal-100 text-teal-900 border-teal-300" },
  off: { label: "Off", short: "Off", hours: 0, worked: false, colour: "bg-slate-100 text-slate-600 border-slate-300" },
  sick: { label: "Sick", short: "Sick", hours: 0, worked: false, colour: "bg-rose-100 text-rose-900 border-rose-300" },
  custom: { label: "Custom hours", short: "Custom", hours: 0, worked: true, colour: "bg-violet-100 text-violet-900 border-violet-300" },
} as const;

export type DayType = keyof typeof DAY_TYPES;
export const DAY_TYPE_ORDER: DayType[] = ["day", "night", "travel", "standby", "off", "sick", "custom"];
