"use client";

import { expenseError, formatHM, formatPounds, parsePounds, travelMinutes, weekTotals } from "@/lib/hours";
import { newId } from "@/lib/jobs";
import type { DemoCompany } from "@/config/demo-companies";
import type { Expense, Timesheet } from "@/lib/types";

const input =
  "min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3 text-base placeholder:text-muted/60 focus:border-brand focus:outline-none";
export const NOTES_MAX = 1000;

/** Below the days: expenses (if the company has allowances) and a free notes box, like writing on the paper sheet. */
export function WeekExtrasEditor({
  sheet,
  readOnly,
  showExpenses,
  jobSuggestionsId,
  onChange,
}: {
  sheet: Timesheet;
  readOnly: boolean;
  showExpenses: boolean;
  jobSuggestionsId: string;
  onChange: (patch: Partial<Timesheet>) => void;
}) {
  const expenses = sheet.expenses ?? [];
  const setExpenses = (next: Expense[]) => onChange({ expenses: next });
  const patch = (id: string, p: Partial<Expense>) => setExpenses(expenses.map((e) => (e.id === id ? { ...e, ...p } : e)));

  if (readOnly) {
    if (!expenses.length && !sheet.notes?.trim()) return null;
    return (
      <section className="rounded-2xl border border-line bg-surface p-4">
        <WeekExtrasList sheet={sheet} />
      </section>
    );
  }

  return (
    <>
      {showExpenses && (
        <section aria-labelledby="expenses-heading" className="rounded-2xl border border-line bg-surface p-4">
          <h2 id="expenses-heading" className="text-lg font-semibold">
            Expenses
          </h2>
          <p className="text-sm text-muted">Anything you paid for this week. Hand the receipts in to the office.</p>
          <div className="mt-3 space-y-3">
            {expenses.map((e, i) => {
              const error = expenseError(e);
              return (
                <div key={e.id} role="group" aria-label={`Expense ${i + 1}`} className="rounded-xl border border-line bg-page/60 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-muted">Job number</span>
                      <input
                        value={e.jobNumber}
                        list={jobSuggestionsId}
                        onChange={(ev) => patch(e.id, { jobNumber: ev.target.value.slice(0, 20) })}
                        autoCapitalize="characters"
                        autoComplete="off"
                        className={input}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-muted">Amount (£)</span>
                      <input
                        value={e.amount}
                        inputMode="decimal"
                        onChange={(ev) => patch(e.id, { amount: ev.target.value.replace(/[^\d.£]/g, "").slice(0, 9) })}
                        placeholder="0.00"
                        className={`${input} tabular-nums`}
                      />
                    </label>
                  </div>
                  <label className="mt-2 block">
                    <span className="mb-1 block text-sm font-medium text-muted">What for</span>
                    <input value={e.description} onChange={(ev) => patch(e.id, { description: ev.target.value.slice(0, 80) })} placeholder="e.g. parking, fuel, materials" className={input} />
                  </label>
                  <div className="mt-1 flex items-center">
                    {error && <p className="text-sm font-medium text-danger">{error}</p>}
                    <button type="button" onClick={() => setExpenses(expenses.filter((x) => x.id !== e.id))} className="ml-auto min-h-11 px-2 text-sm font-semibold text-danger">
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setExpenses([...expenses, { id: newId(), jobNumber: "", amount: "", description: "" }])}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/40 text-base font-semibold text-brand"
            >
              <span aria-hidden className="text-xl leading-none">+</span> Add an expense
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4">
        <label className="block">
          <span className="block text-lg font-semibold">Other details</span>
          <span className="mb-2 block text-sm text-muted">Anything else the office should know, like you&apos;d write on the paper sheet.</span>
          <textarea
            value={sheet.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value.slice(0, NOTES_MAX) })}
            rows={3}
            className="w-full rounded-xl border-2 border-line bg-surface p-3 text-base focus:border-brand focus:outline-none"
          />
        </label>
      </section>
    </>
  );
}

/** Read-only list of expenses and notes (review screen, office). */
export function WeekExtrasList({ sheet }: { sheet: Timesheet }) {
  const expenses = (sheet.expenses ?? []).filter((e) => !expenseError(e) && parsePounds(e.amount));
  return (
    <div className="space-y-3">
      {expenses.length > 0 && (
        <div>
          <h3 className="font-semibold">Expenses</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {expenses.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="font-semibold">{e.jobNumber.trim() || "–"}</span>
                <span className="text-muted">{e.description}</span>
                <span className="ml-auto font-semibold tabular-nums">{formatPounds(parsePounds(e.amount)!)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sheet.notes?.trim() && (
        <div>
          <h3 className="font-semibold">Other details</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm">{sheet.notes.trim()}</p>
        </div>
      )}
    </div>
  );
}

/** One line per allowance, e.g. "Travel 5h · Away 4 nights · Food 4 · Expenses £12.50 · 1 day holiday". */
export function allowanceSummary(sheet: Timesheet, allowances: DemoCompany["allowances"]): string[] {
  const t = weekTotals(sheet.days, sheet.expenses);
  const parts: string[] = [];
  if (allowances) {
    if (t.travelMinutes) parts.push(`Travel ${formatHM(t.travelMinutes)}`);
    if (t.awayNights) parts.push(`${allowances.awayShort} ${t.awayNights} night${t.awayNights === 1 ? "" : "s"}`);
    if (t.foodDays) parts.push(`${allowances.foodShort} ${t.foodDays}`);
    if (t.expensesPence) parts.push(`Expenses ${formatPounds(t.expensesPence)}`);
  }
  if (t.holidayDays) parts.push(`${t.holidayDays} day${t.holidayDays === 1 ? "" : "s"} holiday`);
  if (t.sickDays) parts.push(`${t.sickDays} day${t.sickDays === 1 ? "" : "s"} sick`);
  return parts;
}

/** Under a day's jobs: "Travel 1h 30m · Away · Food". */
export function dayExtrasText(day: Timesheet["days"][number], allowances: DemoCompany["allowances"]): string {
  if (!allowances || day.absence) return "";
  const travel = day.worked ? day.jobs.reduce((sum, j) => sum + (travelMinutes(j) ?? 0), 0) : 0;
  return [travel && `Travel ${formatHM(travel)}`, day.away && `✓ ${allowances.awayShort}`, day.food && `✓ ${allowances.foodShort}`].filter(Boolean).join(" · ");
}
