/**
 * ─────────────────────────────────────────────────────────────
 *  BRANDING & BUSINESS SETTINGS
 *  This is the ONE file to edit when you rebrand the app or set it
 *  up for a different business. Everything else reads from here.
 * ─────────────────────────────────────────────────────────────
 */

/**
 * How workers record each job:
 *  "times"          – start and finish time for every job (hours worked out from them)
 *  "hours-or-times" – type the hours, or switch to start and finish times
 */
export type EntryMode = "times" | "hours-or-times";

/**
 * Which app this company gets:
 *  "trade"  – each worker fills in their own weekly timesheet
 *  "vessel" – one person on each vessel fills in a trip sheet for everyone on board
 *             (settings in src/config/vessel.ts)
 */
export type AppMode = "trade" | "vessel";

export const brand = {
  /** Which app this company gets (see AppMode above). */
  appMode: "trade" as AppMode,
  /** Full company name, shown in headers, emails and PDFs. */
  companyName: "Your Company",
  /** Short name shown under the app icon on a phone's home screen (max ~12 characters). */
  shortName: "Timesheets",
  /** Full logo, shown large on the sign-in screen. Put the file in the /public folder. */
  logoPath: "/logo.svg",
  /** Square icon shown small in the app's top bar (often just the symbol from the logo). */
  iconPath: "/logo.svg",
  /** Set to true if the logo already spells out the company name, so it isn't shown twice. */
  logoIncludesName: false,

  colours: {
    /** Main colour: buttons, headers, highlights. */
    primary: "#1F5A48",
    /** Slightly darker version of the main colour, used when a button is pressed. */
    primaryDark: "#16443A",
    /** Second brand colour, used for a thin stripe under the top bar. Same as primary to hide it. */
    accent: "#1F5A48",
    /** Soft tint of the main colour, used for highlighted backgrounds. */
    primarySoft: "#E3EDE8",
    /** Page background (warm off-white). */
    background: "#FAF7F2",
    /** Card / panel background. */
    surface: "#FFFFFF",
    /** Main text colour. */
    text: "#1E2421",
    /** Secondary text colour (labels, hints). */
    muted: "#66706B",
    /** Border colour for cards and inputs. */
    border: "#E4DED4",
    /** Warnings and errors. */
    danger: "#B3261E",
  },

  /** Inbox that receives every signed timesheet PDF. */
  payrollEmail: "payroll@example.co.uk",

  /** How workers record each job (see EntryMode above). */
  entryMode: "hours-or-times" as EntryMode,

  /**
   * Show "overtime over X hours" figures. Turn off for companies whose own
   * payroll or job costing program applies its pay rules.
   */
  showOvertime: true,

  /** Weekly hours after which time counts as overtime. */
  overtimeThresholdHours: 40,

  /** Wording of the declaration workers tick before signing. */
  declaration: "I confirm these hours are a true and accurate record",
} as const;

export type Brand = typeof brand;
