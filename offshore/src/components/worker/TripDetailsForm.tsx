"use client";

import { useState } from "react";
import { addDays, datesBetween } from "@/lib/dates";
import { installations } from "@/lib/demo-server";
import type { Pattern } from "@/lib/trip";
import { Button, Field, inputClass } from "../ui";

export type TripDetails = { installation: string; client: string; poNumber: string; workOrder: string; startDate: string; endDate: string };

type Props = {
  initial: TripDetails;
  /** New trips: also ask how to pre-fill the days. */
  pattern?: Pattern;
  submitLabel: string;
  onSubmit: (details: TripDetails, pattern?: Pattern) => void;
  onCancel?: () => void;
};

export function TripDetailsForm({ initial, pattern: initialPattern, submitLabel, onSubmit, onCancel }: Props) {
  const [d, setD] = useState(initial);
  const [pattern, setPattern] = useState(initialPattern);
  const known = installations();
  const set = (k: keyof TripDetails, v: string) => setD((x) => ({ ...x, [k]: v }));

  function chooseInstallation(name: string) {
    const match = known.find((i) => i.name.toLowerCase() === name.trim().toLowerCase());
    // A known installation fills in its client, PO and work order (still changeable).
    setD((x) => (match ? { ...x, installation: match.name, client: match.client, poNumber: match.poNumber, workOrder: match.workOrder } : { ...x, installation: name }));
  }

  const length = d.startDate && d.endDate && d.endDate >= d.startDate ? datesBetween(d.startDate, d.endDate).length : 0;
  const datesProblem = !d.startDate || !d.endDate ? "Enter both dates." : d.endDate < d.startDate ? "The last day is before the first day." : length > 60 ? "A trip can be up to 60 days." : null;
  const ready = !datesProblem && d.installation.trim() && d.client.trim();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSubmit({ ...d, installation: d.installation.trim(), client: d.client.trim(), poNumber: d.poNumber.trim(), workOrder: d.workOrder.trim() }, pattern);
      }}
    >
      <Field label="Installation" hint="Platform, rig or vessel">
        <input className={inputClass} list="installations" value={d.installation} onChange={(e) => chooseInstallation(e.target.value)} placeholder="e.g. Corrie Alpha" required />
        <datalist id="installations">
          {known.map((i) => (
            <option key={i.name} value={i.name} />
          ))}
        </datalist>
      </Field>
      <Field label="Client">
        <input className={inputClass} value={d.client} onChange={(e) => set("client", e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="PO number">
          <input className={inputClass} value={d.poNumber} onChange={(e) => set("poNumber", e.target.value)} />
        </Field>
        <Field label="Work order / cost code">
          <input className={inputClass} value={d.workOrder} onChange={(e) => set("workOrder", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First day">
          <input
            type="date"
            className={inputClass}
            value={d.startDate}
            onChange={(e) => {
              const start = e.target.value;
              // Keep the same trip length when the first day moves.
              setD((x) => ({ ...x, startDate: start, endDate: start && x.startDate && x.endDate ? addDays(start, datesBetween(x.startDate, x.endDate).length - 1) : x.endDate }));
            }}
            required
          />
        </Field>
        <Field label="Last day">
          <input type="date" className={inputClass} value={d.endDate} min={d.startDate} onChange={(e) => set("endDate", e.target.value)} required />
        </Field>
      </div>
      <p className={`text-sm ${datesProblem ? "text-danger" : "text-muted"}`}>{datesProblem ?? `${length} days, including travel days.`}</p>

      {pattern && (
        <fieldset className="space-y-3 rounded-xl border border-line p-3">
          <legend className="px-1 text-sm font-semibold">Fill in the days for me</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["day", "night"] as const).map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setPattern({ ...pattern, shift: s })}
                className={`min-h-12 rounded-xl border-2 font-semibold ${pattern.shift === s ? "border-brand bg-brand text-white" : "border-line bg-surface"}`}
                aria-pressed={pattern.shift === s}
              >
                12h {s} shifts
              </button>
            ))}
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="h-5 w-5" checked={pattern.travelFirst} onChange={(e) => setPattern({ ...pattern, travelFirst: e.target.checked })} />
            First day is a travel day
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="h-5 w-5" checked={pattern.travelLast} onChange={(e) => setPattern({ ...pattern, travelLast: e.target.checked })} />
            Last day is a travel day
          </label>
          <p className="text-xs text-muted">You only need to change the days that were different (weather, sick, extra hours…).</p>
        </fieldset>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={!ready}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
