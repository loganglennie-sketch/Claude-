/**
 * ─────────────────────────────────────────────────────────────
 *  BRANDING & BUSINESS SETTINGS
 *  This is the ONE file to edit when you rebrand the app or set it
 *  up for a different business. Everything else reads from here.
 * ─────────────────────────────────────────────────────────────
 */
export const brand = {
  /** Full company name, shown in headers, emails and PDFs. */
  companyName: "Your Company Ltd",
  /** Short name shown under the app icon on a phone's home screen (max ~12 characters). */
  shortName: "Timesheets",
  /** Logo shown in the app header. Put the file in the /public folder. */
  logoPath: "/logo.svg",

  colours: {
    /** Main colour: buttons, headers, highlights. */
    primary: "#1F5A48",
    /** Slightly darker version of the main colour, used when a button is pressed. */
    primaryDark: "#16443A",
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

  /** Weekly hours after which time counts as overtime. */
  overtimeThresholdHours: 40,

  /** Wording of the declaration workers tick before signing. */
  declaration: "I confirm these hours are a true and accurate record",
} as const;

export type Brand = typeof brand;
