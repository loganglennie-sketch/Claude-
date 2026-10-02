/**
 * ─────────────────────────────────────────────────────────────
 *  VESSEL MODE SETTINGS
 *  For marine companies (appMode "vessel" in brand.ts). One person on
 *  each vessel fills in a trip sheet for everyone on board.
 *  Edit this file to match the company's current Excel trip sheet.
 * ─────────────────────────────────────────────────────────────
 */

/** What each person did on a day of the trip. */
export type ShiftCode = "day" | "night" | "travel" | "standby" | "sick" | "off";

export type ShiftType = {
  code: ShiftCode;
  /** Shown in the grid and on the PDF. Keep it to 1–2 letters. */
  short: string;
  label: string;
  /** Hours filled in when this shift is picked (can be changed per cell). */
  defaultHours: number;
  /** Counts as a paid day in the payroll export. */
  paidDay: boolean;
  /** Charged to the client in the invoicing export. */
  chargeable: boolean;
};

/**
 * The choices for each day in the grid, in the order they're offered.
 * TODO: match these to the columns of the company's current spreadsheet.
 */
export const SHIFT_TYPES: ShiftType[] = [
  { code: "day", short: "D", label: "Day shift", defaultHours: 12, paidDay: true, chargeable: true },
  { code: "night", short: "N", label: "Night shift", defaultHours: 12, paidDay: true, chargeable: true },
  { code: "travel", short: "T", label: "Travel", defaultHours: 8, paidDay: true, chargeable: true },
  { code: "standby", short: "S", label: "Standby", defaultHours: 12, paidDay: true, chargeable: true },
  { code: "sick", short: "X", label: "Sick", defaultHours: 0, paidDay: true, chargeable: false },
  { code: "off", short: "O", label: "Off", defaultHours: 0, paidDay: false, chargeable: false },
];

export const shiftType = (code: ShiftCode) => SHIFT_TYPES.find((s) => s.code === code)!;

export const vesselSettings = {
  /** What every day is filled with when someone is added to a trip. */
  defaultShift: "day" as ShiftCode,
  /** What a person's first and last day on board is filled with (null = same as defaultShift). */
  joinLeaveShift: "travel" as ShiftCode | null,
  /** Planned trip length offered when starting a trip, in days (mob and demob days included). */
  defaultTripDays: 21,
  /** Ranks offered when adding someone to the personnel list, most senior first. */
  ranks: ["Master", "Chief Officer", "2nd Officer", "Chief Engineer", "2nd Engineer", "3rd Engineer", "ETO", "Bosun", "AB", "OS", "Cook", "Steward"],
  /** Wording the master signs under at the end of the trip. */
  declaration: "I confirm this trip sheet is a true and accurate record of everyone on board",
} as const;

/** Sorts crew by rank (as listed above), then by name. */
export function rankOrder(role: string): number {
  const i = (vesselSettings.ranks as readonly string[]).indexOf(role);
  return i === -1 ? 99 : i;
}
