"use client";

import { useState } from "react";
import { normaliseTime } from "@/lib/hours";

type Props = { label: string; value: string; onChange: (value: string) => void };

/**
 * 24-hour time box. Phones' own time pickers show AM/PM on some handsets,
 * so workers type the time instead: "0730", "7:30" and "19.45" all work.
 */
export function TimeInput({ label, value, onChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  function type(raw: string) {
    const cleaned = raw.replace(/[^\d:.]/g, "").slice(0, 5);
    setDraft(cleaned);
    // Fill in as soon as a full time has been typed (e.g. "0730" or "19:45").
    const digits = cleaned.replace(/\D/g, "");
    const full = normaliseTime(cleaned);
    if (full && digits.length === 4) onChange(full);
    else if (!cleaned) onChange("");
  }

  function finish() {
    if (draft === null) return;
    const full = normaliseTime(draft);
    // Something that isn't a real time is kept so the worker sees the warning.
    onChange(full ?? draft);
    setDraft(null);
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="00:00"
        aria-label={`${label} time, 24-hour clock`}
        value={draft ?? value}
        onChange={(e) => type(e.target.value)}
        onBlur={finish}
        className="min-h-13 w-full rounded-xl border-2 border-line bg-surface px-3 text-center text-xl font-semibold tabular-nums tracking-wider placeholder:font-normal placeholder:text-muted/40 focus:border-brand focus:outline-none"
      />
    </label>
  );
}
