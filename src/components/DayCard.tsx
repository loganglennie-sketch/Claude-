"use client";

import { dayMinutes, entryMinutes, formatHM, minutesToHoursText, parseHours } from "@/lib/hours";
import { newJobEntry } from "@/lib/jobs";
import type { DayEntry, JobEntry } from "@/lib/types";
import { formatDayMonth, formatDayName, toISODate } from "@/lib/week";

const BREAK_CHOICES = [0, 15, 30, 45, 60];
const STEP_MINUTES = 30;

type Props = {
  day: DayEntry;
  readOnly?: boolean;
  jobSuggestionsId: string;
  onChange: (patch: Partial<DayEntry>) => void;
  onCopyPrevious?: () => void;
};

export function DayCard({ day, readOnly, jobSuggestionsId, onChange, onCopyPrevious }: Props) {
  const { minutes } = dayMinutes(day);
  const isToday = day.date === toISODate(new Date());
  const labelId = `day-${day.date}`;
  const dayName = formatDayName(day.date);

  const setJobs = (jobs: JobEntry[]) => onChange({ jobs });
  const patchJob = (id: string, patch: Partial<JobEntry>) => setJobs(day.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  const removeJob = (id: string) => setJobs(day.jobs.filter((j) => j.id !== id));
  const addJob = () => setJobs([...day.jobs, newJobEntry()]);

  return (
    <section
      aria-labelledby={labelId}
      className={`rounded-2xl border bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${isToday ? "border-brand border-2" : "border-line"}`}
    >
      <div className="flex items-center gap-3">
        <h2 id={labelId} className="text-lg font-semibold">
          {dayName} <span className="font-normal text-muted">{formatDayMonth(day.date)}</span>
        </h2>
        {isToday && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-dark">Today</span>}
        <span
          aria-label={day.worked ? `${dayName} total ${formatHM(minutes)}` : `${dayName} off`}
          className={`ml-auto rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
            day.worked && minutes > 0 ? "bg-brand text-white" : "bg-page text-muted"
          }`}
        >
          {day.worked ? (minutes > 0 ? formatHM(minutes) : "–") : "Off"}
        </span>
      </div>

      {!readOnly && (
        <div role="radiogroup" aria-label={`${dayName}: worked or day off`} className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-page p-1">
          {[
            { value: true, label: "Worked" },
            { value: false, label: "Day off" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={day.worked === opt.value}
              onClick={() => onChange(opt.value && day.jobs.length === 0 ? { worked: true, jobs: [newJobEntry()] } : { worked: opt.value })}
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
        <div className="mt-4 space-y-3">
          {day.jobs.map((entry, i) =>
            readOnly ? (
              <ReadOnlyEntry key={entry.id} entry={entry} />
            ) : (
              <JobEntryEditor
                key={entry.id}
                entry={entry}
                index={i}
                dayName={dayName}
                jobSuggestionsId={jobSuggestionsId}
                onChange={(patch) => patchJob(entry.id, patch)}
                onRemove={() => removeJob(entry.id)}
              />
            ),
          )}

          {!readOnly && day.jobs.length === 0 && <p className="text-sm text-muted">No jobs yet for {dayName}.</p>}

          {!readOnly && (
            <button
              type="button"
              onClick={addJob}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/40 text-base font-semibold text-brand"
            >
              <span aria-hidden className="text-xl leading-none">+</span> {day.jobs.length === 0 ? "Add a job" : "Add another job"}
            </button>
          )}

          {day.jobs.length > 1 && (
            <div className="flex justify-between border-t border-line pt-3 text-sm">
              <span className="text-muted">{dayName} total</span>
              <span className="font-semibold tabular-nums">{formatHM(minutes)}</span>
            </div>
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

type EditorProps = {
  entry: JobEntry;
  index: number;
  dayName: string;
  jobSuggestionsId: string;
  onChange: (patch: Partial<JobEntry>) => void;
  onRemove: () => void;
};

function JobEntryEditor({ entry, index, dayName, jobSuggestionsId, onChange, onRemove }: EditorProps) {
  const { minutes, error } = entryMinutes(entry);
  const touched = !!(entry.jobNumber || entry.hours || entry.start || entry.finish);
  const label = `${dayName} job ${index + 1}`;

  function step(by: number) {
    const current = parseHours(entry.hours) ?? 0;
    const next = Math.min(24 * 60, Math.max(0, current + by));
    onChange({ hours: next === 0 ? "" : minutesToHoursText(next) });
  }

  function switchMode() {
    if (entry.mode === "times") {
      onChange({ mode: "hours", hours: minutes > 0 ? minutesToHoursText(minutes) : entry.hours });
    } else {
      onChange({ mode: "times" });
    }
  }

  return (
    <div role="group" aria-label={label} className="rounded-xl border border-line bg-page/60 p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-muted">Job {index + 1}</span>
        {minutes > 0 && <span className="text-sm font-semibold tabular-nums text-ink">· {formatHM(minutes)}</span>}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Delete ${label}${entry.jobNumber ? ` (${entry.jobNumber})` : ""}`}
          className="-mr-1 ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
          </svg>
        </button>
      </div>

      <div className="mt-1 grid grid-cols-[1fr_auto] items-end gap-3">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-sm font-medium text-muted">Job number</span>
          <input
            type="text"
            list={jobSuggestionsId}
            value={entry.jobNumber}
            onChange={(e) => onChange({ jobNumber: e.target.value.slice(0, 20) })}
            placeholder="e.g. 1042"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="min-h-14 w-full rounded-xl border-2 border-line bg-surface px-3 text-xl font-semibold tracking-wide placeholder:font-normal placeholder:tracking-normal placeholder:text-muted/60 focus:border-brand focus:outline-none"
          />
        </label>

        {entry.mode === "hours" && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted" id={`${entry.id}-hours`}>
              Hours
            </span>
            <div className="flex items-stretch overflow-hidden rounded-xl border-2 border-line bg-surface focus-within:border-brand">
              <button type="button" onClick={() => step(-STEP_MINUTES)} aria-label="Half an hour less" className="w-11 text-2xl text-brand active:bg-brand-soft">
                −
              </button>
              <input
                type="text"
                inputMode="decimal"
                aria-labelledby={`${entry.id}-hours`}
                value={entry.hours}
                onChange={(e) => onChange({ hours: e.target.value.replace(/[^\d.,:h]/gi, "").slice(0, 5) })}
                placeholder="0"
                className="min-h-13 w-14 bg-transparent text-center text-xl font-semibold tabular-nums placeholder:text-muted/50 focus:outline-none"
              />
              <button type="button" onClick={() => step(STEP_MINUTES)} aria-label="Half an hour more" className="w-11 text-2xl text-brand active:bg-brand-soft">
                +
              </button>
            </div>
          </div>
        )}
      </div>

      {entry.mode === "times" && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TimeField label="Start" value={entry.start} onChange={(start) => onChange({ start })} />
            <TimeField label="Finish" value={entry.finish} onChange={(finish) => onChange({ finish })} />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-muted">Break (minutes)</legend>
            <div className="flex flex-wrap gap-2">
              {BREAK_CHOICES.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  aria-pressed={entry.breakMins === mins}
                  onClick={() => onChange({ breakMins: mins })}
                  className={`min-h-11 min-w-11 flex-1 rounded-xl border-2 px-2 text-base font-semibold tabular-nums transition ${
                    entry.breakMins === mins ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink"
                  }`}
                >
                  {mins}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      <button type="button" onClick={switchMode} className="mt-2 min-h-10 text-sm font-semibold text-brand underline-offset-4 hover:underline">
        {entry.mode === "hours" ? "Use start & finish times instead" : "Type the hours instead"}
      </button>

      {error && touched && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function ReadOnlyEntry({ entry }: { entry: JobEntry }) {
  const { minutes } = entryMinutes(entry);
  return (
    <div className="flex items-baseline gap-3 rounded-xl bg-page/60 px-3 py-2.5">
      <span className="text-lg font-semibold tracking-wide">{entry.jobNumber || "—"}</span>
      {entry.mode === "times" && (
        <span className="text-sm text-muted tabular-nums">
          {entry.start}–{entry.finish}
          {entry.breakMins > 0 && ` · ${entry.breakMins}m break`}
        </span>
      )}
      <span className="ml-auto font-semibold tabular-nums">{formatHM(minutes)}</span>
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      <input
        type="time"
        step={300}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-13 w-full rounded-xl border-2 border-line bg-surface px-3 text-lg tabular-nums focus:border-brand focus:outline-none"
      />
    </label>
  );
}
