"use client";

import { useState, type ReactNode } from "react";
import { DAY_TYPES, DAY_TYPE_ORDER, type DayType } from "@/config/settings";
import { formatDayMonth, formatDayName, formatStamp } from "@/lib/dates";
import { dayHours, formatHours, tripTotals } from "@/lib/trip";
import type { Day, Query } from "@/lib/types";

type Props = {
  days: Day[];
  queries?: Query[];
  /** Technician changing their days. */
  onChange?: (days: Day[]) => void;
  /** Supervisor: extra controls under each day (e.g. "Query this day"). */
  renderExtra?: (day: Day) => ReactNode;
};

export function TypeChip({ type }: { type: DayType }) {
  return <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-semibold ${DAY_TYPES[type].colour}`}>{DAY_TYPES[type].label}</span>;
}

export function DayList({ days, queries = [], onChange, renderExtra }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  function update(date: string, change: Partial<Day>, restToo = false) {
    if (!onChange) return;
    onChange(days.map((d) => (d.date === date || (restToo && d.date > date) ? { ...d, ...change } : d)));
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {days.map((day, i) => {
        const dayQueries = queries.filter((q) => q.date === day.date);
        const openQuery = dayQueries.some((q) => !q.resolvedAt);
        const isOpen = open === day.date && !!onChange;
        return (
          <li key={day.date} className={openQuery ? "bg-rose-50" : ""}>
            <button
              type="button"
              disabled={!onChange}
              onClick={() => setOpen(isOpen ? null : day.date)}
              className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-default"
              aria-expanded={onChange ? isOpen : undefined}
            >
              <span className="w-16 shrink-0 leading-tight">
                <span className="block text-sm font-semibold">{formatDayName(day.date)}</span>
                <span className="block text-xs text-muted">{formatDayMonth(day.date)}</span>
              </span>
              <span className="flex-1">
                <TypeChip type={day.type} />
                {day.note && <span className="mt-0.5 block text-xs text-muted">{day.note}</span>}
              </span>
              <span className="w-14 shrink-0 text-right font-semibold tabular-nums">{dayHours(day) ? `${formatHours(dayHours(day))} h` : "–"}</span>
              {onChange && <span className="w-4 text-muted" aria-hidden>{isOpen ? "▴" : "▾"}</span>}
            </button>

            {dayQueries.map((q) => (
              <div key={q.id} className={`mx-3 mb-2 rounded-lg border p-2 text-sm ${q.resolvedAt ? "border-line bg-page text-muted" : "border-rose-300 bg-white text-rose-900"}`}>
                <div className="font-semibold">
                  Queried by {q.byName} · {formatStamp(q.at)}
                  {q.resolvedAt && " · answered"}
                </div>
                <div>“{q.comment}”</div>
                {q.reply && <div className="mt-1 text-ink">Technician: “{q.reply}”</div>}
              </div>
            ))}

            {isOpen && (
              <div className="space-y-3 border-t border-line bg-page px-3 py-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DAY_TYPE_ORDER.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update(day.date, { type: t, hours: t === "custom" ? day.hours || dayHours(day) || 12 : 0 })}
                      className={`min-h-12 rounded-xl border-2 px-2 text-sm font-semibold ${day.type === t ? "border-brand bg-brand text-white" : "border-line bg-surface"}`}
                      aria-pressed={day.type === t}
                    >
                      {DAY_TYPES[t].label}
                      {t !== "custom" && <span className="block text-xs font-normal opacity-80">{DAY_TYPES[t].hours} h</span>}
                    </button>
                  ))}
                </div>
                {day.type === "custom" && (
                  <label className="flex items-center gap-3">
                    <span className="text-sm font-semibold">Hours</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={24}
                      step={0.25}
                      value={day.hours || ""}
                      onChange={(e) => update(day.date, { hours: Math.max(0, Math.min(24, Number(e.target.value) || 0)) })}
                      className="min-h-12 w-28 rounded-xl border-2 border-line bg-surface px-3 text-lg focus:border-brand focus:outline-none"
                    />
                  </label>
                )}
                <input
                  type="text"
                  value={day.note ?? ""}
                  onChange={(e) => update(day.date, { note: e.target.value || undefined })}
                  placeholder="Note (optional), e.g. helideck closed"
                  maxLength={200}
                  className="min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3 focus:border-brand focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  {i < days.length - 1 && (
                    <button
                      type="button"
                      className="min-h-10 rounded-lg border border-line bg-surface px-3 text-sm font-semibold"
                      onClick={() => update(day.date, { type: day.type, hours: day.hours }, true)}
                    >
                      Same for every day after this
                    </button>
                  )}
                  <button type="button" className="min-h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white" onClick={() => setOpen(null)}>
                    Done
                  </button>
                </div>
              </div>
            )}
            {renderExtra?.(day)}
          </li>
        );
      })}
    </ul>
  );
}

/** Day counts by type and total hours. */
export function TotalsSummary({ days }: { days: Day[] }) {
  const t = tripTotals(days);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">Trip total</span>
        <span className="text-2xl font-bold tabular-nums">{formatHours(t.hours)} h</span>
      </div>
      <div className="mt-1 text-sm text-muted">
        {t.daysOn} days on · {days.length} days in total
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {DAY_TYPE_ORDER.filter((k) => t.byType[k] > 0).map((k) => (
          <span key={k} className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${DAY_TYPES[k].colour}`}>
            {t.byType[k]} × {DAY_TYPES[k].short}
          </span>
        ))}
      </div>
    </div>
  );
}
