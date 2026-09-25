import { currentWeekStart, isISODate, mondayOf } from "./week";

/** Turns the ?week= value from the address bar into a Monday, defaulting to this week. Future weeks aren't allowed. */
export function resolveWeekParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const thisWeek = currentWeekStart();
  if (!isISODate(raw)) return thisWeek;
  const monday = mondayOf(raw);
  return monday > thisWeek ? thisWeek : monday;
}
