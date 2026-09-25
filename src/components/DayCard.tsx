"use client";

import { dayMinutes, formatHM } from "@/lib/hours";
import type { DayEntry } from "@/lib/types";
import { formatDayMonth, formatDayName, toISODate } from "@/lib/week";

const BREAK_CHOICES = [0, 15, 30, 45, 60];

type Props = {
  day: DayEntry;
  readOnly?: boolean;
  jobSuggestionsId: string;
  onChange: (patch: Partial<DayEntry>) => void;
  onCopyPrevious?: () => void;
};

export function DayCard({ day, readOnly, jobSuggestionsId, onChange, onCopyPrevious }: Props) {
  const { minutes, error } = dayMinutes(day);
  const isToday = day.date === toISODate(new Date());
  const labelId = `day-${day.date}`;

  return (
    <section
      aria-labelledby={labelId}
      className={`rounded-2xl border bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${isToday ? "border-brand border-2" : "border-line"}`}
    >
      <div className="flex items-center gap-3">
        <h2 id={labelId} className="text-lg font-semibold">
          {formatDayName(day.date)} <span className="font-normal text-muted">{formatDayMonth(day.date)}</span>
        </h2>
        {isToday && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-dark">Today</span>}
        <span
          className={`ml-auto rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
            day.worked && minutes > 0 ? "bg-brand text-white" : "bg-page text-muted"
          }`}
        >
          {day.worked ? (minutes > 0 ? formatHM(minutes) : "–") : "Off"}
        </span>
      </div>

      {!readOnly && (
        <div role="radiogroup" aria-label={`${formatDayName(day.date)}: worked or day off`} className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
          {[
            { value: true, label: "Worked" },
            { value: false, label: "Day off" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={day.worked === opt.value}
              onClick={() => onChange({ worked: opt.value })}
              className={`min-h-12 rounded-lg text-base font-semibold transition ${
                day.worked === opt.value ? "bg-surface text-brand shadow-sm" : "text-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {day.worked && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <TimeField label="Start" value={day.start} readOnly={readOnly} onChange={(start) => onChange({ start })} />
            <TimeField label="Finish" value={day.finish} readOnly={readOnly} onChange={(finish) => onChange({ finish })} />
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-muted">Break (minutes)</legend>
            {readOnly ? (
              <div className="text-lg">{day.breakMins} mins</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {BREAK_CHOICES.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    aria-pressed={day.breakMins === mins}
                    onClick={() => onChange({ breakMins: mins })}
                    className={`min-h-12 min-w-12 flex-1 rounded-xl border-2 px-2 text-base font-semibold tabular-nums transition ${
                      day.breakMins === mins ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink"
                    }`}
                  >
                    {mins}
                  </button>
                ))}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={600}
                  step={5}
                  aria-label="Other break length in minutes"
                  placeholder="Other"
                  value={BREAK_CHOICES.includes(day.breakMins) ? "" : day.breakMins}
                  onChange={(e) => onChange({ breakMins: Math.max(0, Math.min(600, Number(e.target.value) || 0)) })}
                  className="min-h-12 w-20 flex-1 rounded-xl border-2 border-line bg-surface px-2 text-center text-base"
                />
              </div>
            )}
          </fieldset>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">Job / site</span>
            {readOnly ? (
              <div className="text-lg">{day.job || "—"}</div>
            ) : (
              <input
                type="text"
                list={jobSuggestionsId}
                value={day.job}
                onChange={(e) => onChange({ job: e.target.value })}
                placeholder="e.g. 14 High St – kitchen refit"
                autoComplete="off"
                className="min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3 text-base placeholder:text-muted/60 focus:border-brand focus:outline-none"
              />
            )}
          </label>

          {error && (day.start || day.finish) && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      {!readOnly && onCopyPrevious && (
        <button type="button" onClick={onCopyPrevious} className="mt-3 min-h-11 text-sm font-semibold text-brand underline-offset-4 hover:underline">
          ↺ Same as previous day
        </button>
      )}
    </section>
  );
}

function TimeField({ label, value, readOnly, onChange }: { label: string; value: string; readOnly?: boolean; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {readOnly ? (
        <div className="text-lg tabular-nums">{value || "—"}</div>
      ) : (
        <input
          type="time"
          step={300}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-14 w-full rounded-xl border-2 border-line bg-surface px-3 text-xl tabular-nums focus:border-brand focus:outline-none"
        />
      )}
    </label>
  );
}
