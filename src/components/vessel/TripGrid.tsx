"use client";

import { useEffect, useRef, useState } from "react";
import { SHIFT_TYPES, shiftType, type ShiftCode } from "@/config/vessel";
import { saveTrip, useFleet } from "@/lib/vessel/store";
import { dayTotals, formatHours, isChanged, memberTotals, parseHours, tripTotals, withCells, type CellRef } from "@/lib/vessel/sheet";
import { cellFor, formatDate, isOnBoard, sortCrew, tripDates } from "@/lib/vessel/trips";
import type { Trip } from "@/lib/vessel/types";
import { formatShortDay, parseISODate, toISODate } from "@/lib/week";

/** How each shift looks in the grid. */
const SHIFT_STYLE: Record<ShiftCode, string> = {
  day: "bg-surface text-ink",
  night: "bg-slate-700 text-white",
  travel: "bg-amber-100 text-amber-900",
  standby: "bg-sky-100 text-sky-900",
  sick: "bg-red-100 text-red-800",
  off: "bg-gray-100 text-gray-500",
};

type Pos = { r: number; c: number };

/**
 * Crew × days. Every day someone is on board is pre-filled with the default
 * and can be changed: click a cell (or drag, or Shift+click, to pick several),
 * then type a letter or use the buttons above.
 */
export function TripGrid({ trip, editable }: { trip: Trip; editable: boolean }) {
  const { peopleById } = useFleet();
  const rows = sortCrew(trip.crew, peopleById);
  const dates = tripDates(trip);
  const today = toISODate(new Date());

  const [anchor, setAnchor] = useState<Pos | null>(null);
  const [focus, setFocus] = useState<Pos | null>(null);
  const [hoursText, setHoursText] = useState("");
  const [hoursError, setHoursError] = useState(false);
  const dragging = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stop = () => (dragging.current = false);
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  // Selection as a rectangle, kept inside the grid if crew or dates change.
  const clamp = (p: Pos): Pos => ({ r: Math.min(p.r, rows.length - 1), c: Math.min(p.c, dates.length - 1) });
  const a = anchor && rows.length ? clamp(anchor) : null;
  const f = focus && rows.length ? clamp(focus) : null;
  const rect = a && f ? { r0: Math.min(a.r, f.r), r1: Math.max(a.r, f.r), c0: Math.min(a.c, f.c), c1: Math.max(a.c, f.c) } : null;
  const inRect = (r: number, c: number) => !!rect && r >= rect.r0 && r <= rect.r1 && c >= rect.c0 && c <= rect.c1;
  const selected: CellRef[] = [];
  if (rect) {
    for (let r = rect.r0; r <= rect.r1; r++)
      for (let c = rect.c0; c <= rect.c1; c++) if (isOnBoard(rows[r], dates[c])) selected.push({ memberId: rows[r].id, date: dates[c] });
  }

  const select = (from: Pos, to: Pos = from) => {
    setAnchor(from);
    setFocus(to);
    setHoursError(false);
    setHoursText("");
    gridRef.current?.focus({ preventScroll: true });
  };

  const applyShift = (shift: ShiftCode) => {
    if (!editable || !selected.length) return;
    saveTrip(withCells(trip, selected, { shift, hours: shiftType(shift).defaultHours }));
  };
  const resetSelected = () => editable && selected.length && saveTrip(withCells(trip, selected, null));
  const applyHours = () => {
    const hours = parseHours(hoursText);
    if (hours === null) return setHoursError(true);
    let next = trip;
    for (const ref of selected) {
      const m = trip.crew.find((c) => c.id === ref.memberId)!;
      next = withCells(next, [ref], { shift: cellFor(trip, m, ref.date).shift, hours });
    }
    saveTrip(next);
    setHoursText("");
    setHoursError(false);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (!f) return;
    const moves: Record<string, Pos> = { ArrowUp: { r: -1, c: 0 }, ArrowDown: { r: 1, c: 0 }, ArrowLeft: { r: 0, c: -1 }, ArrowRight: { r: 0, c: 1 } };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      const next = { r: Math.max(0, Math.min(rows.length - 1, f.r + move.r)), c: Math.max(0, Math.min(dates.length - 1, f.c + move.c)) };
      if (e.shiftKey) setFocus(next);
      else select(next);
      return;
    }
    if (e.key === "Escape") {
      setAnchor(null);
      setFocus(null);
      return;
    }
    if (!editable) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      resetSelected();
      return;
    }
    const shift = SHIFT_TYPES.find((s) => s.short.toLowerCase() === e.key.toLowerCase());
    if (shift && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      applyShift(shift.code);
    }
  }

  if (rows.length === 0) return <p className="rounded-xl bg-page p-4 text-center text-muted">Add crew first – the daily sheet fills in as people are added.</p>;

  const totals = tripTotals(trip);
  const focusCell = f && isOnBoard(rows[f.r], dates[f.c]) ? cellFor(trip, rows[f.r], dates[f.c]) : null;

  return (
    <div className="space-y-3">
      {/* Toolbar: what the buttons do to the selected cells. */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-page p-2">
        {SHIFT_TYPES.map((s) => (
          <button
            key={s.code}
            type="button"
            disabled={!editable || !selected.length}
            onClick={() => applyShift(s.code)}
            title={editable ? `Set selected days to ${s.label} (key ${s.short})` : s.label}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-sm enabled:hover:border-brand disabled:cursor-default"
          >
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded font-bold ${SHIFT_STYLE[s.code]} ring-1 ring-line`}>{s.short}</span>
            {s.label}
            <span className="text-xs text-muted">{s.defaultHours}h</span>
          </button>
        ))}
        {editable && (
          <>
            <span className="mx-1 h-6 w-px bg-line" />
            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                applyHours();
              }}
            >
              <label htmlFor="grid-hours" className="text-sm">
                Hours
              </label>
              <input
                id="grid-hours"
                value={hoursText}
                onChange={(e) => {
                  setHoursText(e.target.value);
                  setHoursError(false);
                }}
                disabled={!selected.length}
                placeholder={focusCell ? formatHours(focusCell.hours) : "–"}
                className={`h-8 w-16 rounded-lg border-2 bg-surface px-2 text-sm focus:outline-none ${hoursError ? "border-danger" : "border-line focus:border-brand"}`}
              />
              <button
                type="submit"
                disabled={!selected.length || !hoursText.trim()}
                className="rounded-lg bg-brand px-2 py-1 text-sm font-semibold text-white disabled:opacity-40"
              >
                Set
              </button>
            </form>
            <button
              type="button"
              disabled={!selected.length}
              onClick={resetSelected}
              className="rounded-lg px-2 py-1 text-sm font-semibold text-brand disabled:opacity-40"
            >
              Reset to default
            </button>
          </>
        )}
        <span className="ml-auto text-sm text-muted">
          {selected.length ? `${selected.length} ${selected.length === 1 ? "day" : "days"} selected` : editable ? "Click a cell to change it" : ""}
        </span>
      </div>
      {hoursError && <p className="text-sm text-danger">Hours must be between 0 and 24, e.g. 12, 11.5 or 11:30.</p>}

      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="overflow-x-auto rounded-xl border border-line focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        aria-label="Daily trip sheet. Use arrow keys to move, Shift to select several, and letters to set the shift."
      >
        <table className="border-collapse select-none text-sm">
          <thead>
            <tr className="bg-page text-xs">
              <th className="sticky left-0 z-10 min-w-48 border-b border-r border-line bg-page px-3 py-1 text-left font-semibold">Crew</th>
              {dates.map((d, c) => {
                const weekend = [0, 6].includes(parseISODate(d).getDay());
                return (
                  <th
                    key={d}
                    title={`${formatDate(d)} – click to select everyone on board`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      select({ r: 0, c }, { r: rows.length - 1, c });
                    }}
                    className={`w-10 min-w-10 cursor-pointer border-b border-line px-0 py-1 text-center font-normal ${d === today ? "bg-brand text-white" : weekend ? "bg-line/60" : ""}`}
                  >
                    <div className="text-[10px] uppercase">{formatShortDay(d).slice(0, 2)}</div>
                    <div className="font-semibold">{Number(d.slice(8))}</div>
                    {(c === 0 || d.endsWith("-01")) && <div className="text-[10px]">{parseISODate(d).toLocaleString("en-GB", { month: "short" })}</div>}
                  </th>
                );
              })}
              <th className="border-b border-l-2 border-line px-2 py-1 text-right font-semibold">Days</th>
              {SHIFT_TYPES.map((s) => (
                <th key={s.code} title={s.label} className="border-b border-line px-2 py-1 text-right font-semibold">
                  {s.short}
                </th>
              ))}
              <th className="border-b border-line px-3 py-1 text-right font-semibold">Hours</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, r) => {
              const person = peopleById[m.personId];
              const t = memberTotals(trip, m);
              return (
                <tr key={m.id}>
                  <th
                    scope="row"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      select({ r, c: 0 }, { r, c: dates.length - 1 });
                    }}
                    title="Click to select all their days"
                    className="sticky left-0 z-10 cursor-pointer whitespace-nowrap border-b border-r border-line bg-surface px-3 py-1 text-left font-normal"
                  >
                    <div className="font-semibold">{person?.name ?? "Unknown"}</div>
                    <div className="text-xs text-muted">
                      {m.role}
                      {person?.employment === "agency" ? " · Agency" : ""}
                    </div>
                  </th>
                  {dates.map((d, c) => {
                    const sel = inRect(r, c);
                    if (!isOnBoard(m, d)) {
                      return (
                        <td
                          key={d}
                          onMouseDown={() => {
                            dragging.current = true;
                            select({ r, c });
                          }}
                          onMouseEnter={() => dragging.current && setFocus({ r, c })}
                          className={`h-11 border-b border-line bg-page ${sel ? "outline outline-2 -outline-offset-2 outline-brand/40" : ""}`}
                        />
                      );
                    }
                    const cell = cellFor(trip, m, d);
                    const type = shiftType(cell.shift);
                    const custom = cell.hours !== type.defaultHours;
                    return (
                      <td
                        key={d}
                        title={`${person?.name}, ${formatDate(d)}: ${type.label}, ${formatHours(cell.hours)}h${isChanged(trip, m.id, d) ? " (changed)" : ""}`}
                        onMouseDown={(e) => {
                          dragging.current = true;
                          if (e.shiftKey && anchor) setFocus({ r, c });
                          else select({ r, c });
                        }}
                        onMouseEnter={() => dragging.current && setFocus({ r, c })}
                        className={`relative h-11 cursor-cell border-b border-l border-line/70 text-center leading-tight ${SHIFT_STYLE[cell.shift]} ${sel ? "outline outline-2 -outline-offset-2 outline-brand" : ""}`}
                      >
                        <div className="font-bold">{type.short}</div>
                        <div className={`text-[10px] ${custom ? "font-bold underline" : "opacity-70"}`}>{formatHours(cell.hours)}</div>
                        {isChanged(trip, m.id, d) && <span aria-hidden className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-accent" />}
                      </td>
                    );
                  })}
                  <td className="border-b border-l-2 border-line px-2 text-right font-semibold tabular-nums">{t.days}</td>
                  {SHIFT_TYPES.map((s) => (
                    <td key={s.code} className="border-b border-line px-2 text-right tabular-nums text-muted">
                      {t.byShift[s.code] || ""}
                    </td>
                  ))}
                  <td className="border-b border-line px-3 text-right font-semibold tabular-nums">{formatHours(t.hours)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-brand-soft text-xs">
            <tr>
              <th className="sticky left-0 z-10 border-r border-line bg-brand-soft px-3 py-1 text-left">
                <div>On board</div>
                <div className="font-normal">Hours</div>
              </th>
              {dates.map((d) => {
                const t = dayTotals(trip, d);
                return (
                  <td key={d} className="py-1 text-center tabular-nums">
                    <div className="font-semibold">{t.onBoard}</div>
                    <div>{formatHours(t.hours)}</div>
                  </td>
                );
              })}
              <td className="border-l-2 border-line px-2 text-right font-semibold tabular-nums">{totals.days}</td>
              {SHIFT_TYPES.map((s) => (
                <td key={s.code} className="px-2 text-right tabular-nums">
                  {totals.byShift[s.code] || ""}
                </td>
              ))}
              <td className="px-3 text-right text-sm font-bold tabular-nums">{formatHours(totals.hours)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted">
        {editable &&
          `Click a cell, drag across cells, or click a name or date to select a row or column. Then type a letter (${SHIFT_TYPES.map((s) => s.short).join(", ")}) or use the buttons above. Delete resets to the default. `}
        Grey = not on board. <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" /> = changed from the default. Underlined hours =
        not the usual hours for that shift.
      </p>
    </div>
  );
}
