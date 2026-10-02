"use client";

import { useState } from "react";
import { SHIFT_TYPES, vesselSettings } from "@/config/vessel";
import { submitTrip, useFleet } from "@/lib/vessel/store";
import { formatHours, memberTotals, tripTotals } from "@/lib/vessel/sheet";
import { crewProblems, formatDate, sortCrew } from "@/lib/vessel/trips";
import type { Trip } from "@/lib/vessel/types";
import { toISODate } from "@/lib/week";
import { SignaturePad } from "../SignaturePad";
import { Button, Card } from "../ui";

/** End of trip: the master checks the totals, signs on screen and sends the sheet to the office. */
export function SubmitPanel({ trip, onShowCrew }: { trip: Trip; onShowCrew: () => void }) {
  const { trips, peopleById, vesselsById } = useFleet();
  const crew = sortCrew(trip.crew, peopleById);
  // Suggest the master on board on the last day.
  const masters = crew.filter((m) => m.role === "Master");
  const lastMaster = masters.find((m) => m.left === trip.demobDate) ?? masters[0];
  const [signedBy, setSignedBy] = useState(lastMaster ? (peopleById[lastMaster.personId]?.name ?? "") : "");
  const [declared, setDeclared] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  const problems = crewProblems(trip, trips, peopleById, vesselsById);
  const totals = tripTotals(trip);
  const early = toISODate(new Date()) < trip.demobDate;
  const blocked = problems.length > 0 || crew.length === 0;
  const canSubmit = !blocked && declared && !!signature && signedBy.trim() !== "";

  return (
    <div className="space-y-4">
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <caption className="px-4 pt-3 text-left text-lg font-semibold">1. Check the totals</caption>
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2">Name</th>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">On board</th>
              <th className="px-3 py-2 text-right">Days</th>
              {SHIFT_TYPES.map((s) => (
                <th key={s.code} className="px-2 py-2 text-right" title={s.label}>
                  {s.short}
                </th>
              ))}
              <th className="px-3 py-2 text-right">Paid days</th>
              <th className="px-4 py-2 text-right">Hours</th>
            </tr>
          </thead>
          <tbody>
            {crew.map((m) => {
              const t = memberTotals(trip, m);
              return (
                <tr key={m.id} className="border-b border-line">
                  <td className="px-4 py-2 font-semibold">{peopleById[m.personId]?.name}</td>
                  <td className="px-3 py-2">{m.role}</td>
                  <td className="px-3 py-2 text-muted">
                    {formatDate(m.joined)} – {formatDate(m.left)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.days}</td>
                  {SHIFT_TYPES.map((s) => (
                    <td key={s.code} className="px-2 py-2 text-right tabular-nums text-muted">
                      {t.byShift[s.code] || ""}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums">{t.paidDays}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatHours(t.hours)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-brand-soft font-semibold">
            <tr>
              <td className="px-4 py-2" colSpan={3}>
                Total
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{totals.days}</td>
              {SHIFT_TYPES.map((s) => (
                <td key={s.code} className="px-2 py-2 text-right tabular-nums">
                  {totals.byShift[s.code] || ""}
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums">{totals.paidDays}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatHours(totals.hours)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {blocked ? (
        <Card className="space-y-2 border-danger/40">
          <p className="font-semibold text-danger">
            {crew.length === 0 ? "There's no crew on this trip yet." : "Some crew dates need fixing before this can be signed:"}
          </p>
          <ul className="list-disc pl-5 text-sm text-danger">
            {problems.map((p, i) => (
              <li key={i}>{p.message}</li>
            ))}
          </ul>
          <button type="button" onClick={onShowCrew} className="text-sm font-semibold text-brand">
            Go to the crew list →
          </button>
        </Card>
      ) : (
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold">2. Master signs</h2>
          {early && (
            <p className="rounded-lg bg-amber-100 p-2 text-sm text-amber-900">
              The trip runs until {formatDate(trip.demobDate)}. If it ended early, change the demob date at the top first.
            </p>
          )}
          <label className="block max-w-sm">
            <span className="mb-1 block text-sm font-medium">Signed by</span>
            <input
              list="masters"
              value={signedBy}
              onChange={(e) => setSignedBy(e.target.value)}
              className="min-h-11 w-full rounded-xl border-2 border-line bg-surface px-3 focus:border-brand focus:outline-none"
            />
            <datalist id="masters">
              {masters.map((m) => (
                <option key={m.id} value={peopleById[m.personId]?.name} />
              ))}
            </datalist>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={declared}
              onChange={(e) => setDeclared(e.target.checked)}
              className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--brand-primary)]"
            />
            <span>{vesselSettings.declaration}.</span>
          </label>
          <div className="max-w-lg">
            <SignaturePad onChange={setSignature} hasSignature={!!signature} prompt="Sign here with the mouse or touchpad" />
          </div>
          <Button onClick={() => canSubmit && submitTrip(trip.id, signedBy.trim(), signature!)} disabled={!canSubmit} className="sm:w-auto">
            {trip.status === "queried" ? "Sign and send back to the office" : "Sign and submit to the office"}
          </Button>
          {!canSubmit && <p className="text-sm text-muted">Enter the master&apos;s name, tick the box and sign to submit.</p>}
        </Card>
      )}
    </div>
  );
}
