"use client";

import Link from "next/link";
import { useState } from "react";
import { useWorker } from "@/lib/demo-auth";
import { approveTrip, queryTrip, useFleet } from "@/lib/vessel/store";
import { formatHours, tripTotals } from "@/lib/vessel/sheet";
import { datesBetween, formatDate, formatShortDate, formatSpan, daysInclusive } from "@/lib/vessel/trips";
import type { CrewMember, Trip } from "@/lib/vessel/types";
import { Button, Card } from "../ui";
import { TripBadge } from "../vessel/TripBadge";
import { TripGrid } from "../vessel/TripGrid";
import { TripSignature } from "../vessel/TripSignature";

const stamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

type Draft = { crewId: string; date: string; comment: string };

/**
 * The office's view of one trip sheet: check it, then approve it (locks it),
 * or query particular lines with a comment that goes back to the vessel.
 */
export function OfficeTripReview({ tripId }: { tripId: string }) {
  const { trips } = useFleet();
  const trip = trips.find((t) => t.id === tripId);
  if (!trip) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-3 px-6 pt-6">
        <p>That trip couldn&apos;t be found.</p>
        <Link href="/fleet" className="font-semibold text-brand">
          ← Back to the fleet
        </Link>
      </div>
    );
  }
  return <Review key={trip.id} trip={trip} />;
}

function Review({ trip }: { trip: Trip }) {
  const { vesselsById, peopleById } = useFleet();
  const worker = useWorker();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [open, setOpen] = useState<string | null>(null); // crew line with the query box open
  const [done, setDone] = useState<string | null>(null);
  const vessel = vesselsById[trip.vesselId];
  const totals = tripTotals(trip);
  const waiting = trip.status === "submitted";
  const name = (m: CrewMember | undefined) => (m ? (peopleById[m.personId]?.name ?? "Unknown") : "Unknown");
  const memberById = Object.fromEntries(trip.crew.map((m) => [m.id, m]));

  // Lines with a query being written, or one still open with the vessel, are shown in red.
  const flagged: Record<string, string> = {};
  for (const q of trip.queries ?? []) if (!q.answeredAt) flagged[q.crewId] = q.comment;
  for (const d of drafts) flagged[d.crewId] = d.comment || "(writing…)";

  function approve() {
    if (!window.confirm(`Approve ${trip.reference}? It will be locked and can't be changed afterwards.`)) return;
    approveTrip(trip.id, worker?.name ?? "Office");
    setDone("approved");
  }

  function sendQueries() {
    const items = drafts.filter((d) => d.comment.trim());
    queryTrip(
      trip.id,
      items.map((d) => ({ crewId: d.crewId, comment: d.comment, ...(d.date ? { date: d.date } : {}) })),
      worker?.name ?? "Office",
    );
    setDrafts([]);
    setOpen(null);
    setDone("queried");
  }

  const draftFor = (crewId: string) => drafts.find((d) => d.crewId === crewId);
  const setDraft = (crewId: string, patch: Partial<Draft>) =>
    setDrafts((list) =>
      list.some((d) => d.crewId === crewId)
        ? list.map((d) => (d.crewId === crewId ? { ...d, ...patch } : d))
        : [...list, { crewId, date: "", comment: "", ...patch }],
    );
  const removeDraft = (crewId: string) => {
    setDrafts((list) => list.filter((d) => d.crewId !== crewId));
    if (open === crewId) setOpen(null);
  };
  const readyToSend = drafts.filter((d) => d.comment.trim()).length;

  return (
    <div className="mx-auto w-full max-w-screen-2xl flex-1 space-y-4 px-6 pb-10 pt-6">
      <Link href="/fleet" className="text-sm font-semibold text-brand">
        ← Fleet
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {trip.reference} <span className="font-normal text-muted">· {vessel?.name}</span>
          </h1>
          <p className="text-muted">
            {formatSpan(trip.mobDate, trip.demobDate)} · {daysInclusive(trip.mobDate, trip.demobDate)} days · {trip.client} · Job {trip.jobNumber}
          </p>
        </div>
        <TripBadge status={trip.status} />
      </div>

      {done === "approved" && <Card className="border-brand bg-brand-soft font-semibold text-brand-dark">✓ Approved and locked.</Card>}
      {done === "queried" && <Card className="border-brand bg-brand-soft font-semibold text-brand-dark">✓ Sent back to {vessel?.name} with your queries.</Card>}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Summary */}
        <Card className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="People" value={String(new Set(trip.crew.map((m) => m.personId)).size)} />
          <Stat label="Person-days on board" value={String(totals.days)} />
          <Stat label="Paid days" value={String(totals.paidDays)} />
          <Stat label="Total hours" value={formatHours(totals.hours)} />
        </Card>
        {/* Signature */}
        <Card className="row-span-2 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Master&apos;s signature</div>
          <div className="rounded-xl border border-line bg-white p-1">
            <TripSignature trip={trip} />
          </div>
          {trip.signedBy && <div className="font-semibold">{trip.signedBy}</div>}
          {trip.submittedAt && <div className="text-sm text-muted">Submitted {stamp.format(new Date(trip.submittedAt))}</div>}
          {trip.approvedAt && (
            <div className="text-sm font-semibold text-brand">
              Approved by {trip.approvedBy ?? "the office"}, {stamp.format(new Date(trip.approvedAt))}
            </div>
          )}
        </Card>
        {/* Actions */}
        <Card className="space-y-3">
          {waiting ? (
            <>
              <p className="text-sm">
                Check the sheet below. If it&apos;s right, <strong>approve</strong> it (it&apos;s then locked). If a line needs changing, click{" "}
                <strong>Query</strong> under that person&apos;s name, write what&apos;s wrong, then <strong>send back to the vessel</strong>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={approve} disabled={drafts.length > 0} className="sm:w-auto">
                  ✓ Approve trip sheet
                </Button>
                <Button variant="secondary" onClick={sendQueries} disabled={!readyToSend} className="sm:w-auto">
                  Send {readyToSend || ""} {readyToSend === 1 ? "query" : "queries"} back to vessel
                </Button>
              </div>
              {drafts.length > 0 && (
                <p className="text-xs text-muted">Approving is turned off while you have queries written. Send them, or remove them to approve.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">
              {trip.status === "approved"
                ? "This trip sheet is approved and locked."
                : trip.status === "queried"
                  ? `Sent back to ${vessel?.name ?? "the vessel"} with queries. It comes back here when the master signs and resubmits it.`
                  : `${vessel?.name ?? "The vessel"} is still filling this trip in. It can be approved once the master has signed and submitted it.`}
            </p>
          )}
        </Card>
      </div>

      {/* Queries being written */}
      {drafts.length > 0 && (
        <Card className="space-y-3 border-danger/40">
          <h2 className="font-semibold">Queries to send ({drafts.length})</h2>
          {drafts.map((d) => {
            const m = memberById[d.crewId];
            return (
              <div key={d.crewId} className="grid gap-2 rounded-xl bg-page p-3 sm:grid-cols-[14rem_10rem_1fr_auto] sm:items-start">
                <div>
                  <div className="font-semibold">{name(m)}</div>
                  <div className="text-xs text-muted">{m?.role}</div>
                </div>
                <select
                  value={d.date}
                  onChange={(e) => setDraft(d.crewId, { date: e.target.value })}
                  className="h-10 rounded-lg border-2 border-line bg-surface px-2 text-sm"
                >
                  <option value="">Whole line</option>
                  {m &&
                    datesBetween(m.joined, m.left).map((date) => (
                      <option key={date} value={date}>
                        {formatShortDate(date)}
                      </option>
                    ))}
                </select>
                <textarea
                  autoFocus={open === d.crewId}
                  value={d.comment}
                  onChange={(e) => setDraft(d.crewId, { comment: e.target.value })}
                  placeholder="What needs checking? e.g. “Signed off on the 14th, not the 15th”"
                  rows={2}
                  className="min-h-10 rounded-lg border-2 border-line bg-surface px-2 py-1 text-sm focus:border-brand focus:outline-none"
                />
                <button type="button" onClick={() => removeDraft(d.crewId)} className="h-10 px-2 text-sm font-semibold text-danger">
                  Remove
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {/* Earlier queries */}
      {(trip.queries?.length ?? 0) > 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold">Queries sent to the vessel</h2>
          <ul className="divide-y divide-line text-sm">
            {trip.queries!.map((q) => (
              <li key={q.id} className="flex flex-wrap gap-x-3 py-2">
                <span className="font-semibold">{name(memberById[q.crewId])}</span>
                <span className="text-muted">{q.date ? formatDate(q.date) : "Whole line"}</span>
                <span className="flex-1">“{q.comment}”</span>
                <span className={q.answeredAt ? "text-brand" : "font-semibold text-danger"}>{q.answeredAt ? "Answered" : "Waiting for vessel"}</span>
                <span className="w-full text-xs text-muted">
                  {q.by}, {stamp.format(new Date(q.at))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <TripGrid
          trip={trip}
          editable={false}
          flagged={flagged}
          rowAction={
            waiting
              ? (m) =>
                  draftFor(m.id) ? (
                    <span className="text-xs font-semibold text-danger">Query added ↑</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(m.id, {});
                        setOpen(m.id);
                      }}
                      className="mt-0.5 rounded-md border border-danger/50 px-2 py-0.5 text-xs font-semibold text-danger hover:bg-red-50"
                    >
                      Query this line
                    </button>
                  )
              : undefined
          }
        />
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
