"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { settings } from "@/config/settings";
import { formatStamp } from "@/lib/dates";
import { deviceStore, saveOnPhone, type LocalTrip } from "@/lib/device";
import { installations } from "@/lib/demo-server";
import { useMe, type Me } from "@/lib/session";
import { canWorkerEdit, daysFor, isLocked, newToken, openQueries, tripTotals } from "@/lib/trip";
import type { Trip } from "@/lib/types";
import { SignaturePad } from "../SignaturePad";
import { DayList, TotalsSummary } from "../trip/DayList";
import { Signatures } from "../trip/Signatures";
import { TripHeader } from "../trip/TripHeader";
import { PdfButton } from "../trip/PdfButton";
import { Alert, Button, Field, inputClass } from "../ui";
import { SendLink } from "./SendLink";
import { TripDetailsForm } from "./TripDetailsForm";

type View = "days" | "details" | "sign";

export function TripScreen() {
  const id = useSearchParams().get("id") ?? "";
  const me = useMe();
  const trip = deviceStore.useValue((d) => d.trips[id]);
  const [view, setView] = useState<View>("days");

  if (!me) return null;
  if (!trip) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-muted">This trip isn&apos;t on this phone. If you just signed in, wait for it to arrive from the office.</p>
        <Link href="/trips" className="font-semibold text-brand underline">
          Back to my trips
        </Link>
      </div>
    );
  }

  const back = (
    <Link href="/trips" className="mb-3 inline-flex min-h-10 items-center text-sm font-semibold text-brand">
      ← My trips
    </Link>
  );

  if (!canWorkerEdit(trip)) return <SentTrip trip={trip} me={me} back={back} />;

  if (view === "details") {
    return (
      <div>
        {back}
        <h1 className="mb-3 text-xl font-bold">Trip details</h1>
        <TripDetailsForm
          initial={trip}
          submitLabel="Save"
          onCancel={() => setView("days")}
          onSubmit={(details) => {
            // New dates keep what's entered; any added days follow the trip's usual shift.
            const t = tripTotals(trip.days);
            const shift = t.byType.night > t.byType.day ? "night" : "day";
            saveOnPhone({ ...trip, ...details, days: daysFor(details.startDate, details.endDate, { shift, travelFirst: false, travelLast: false }, trip.days) });
            setView("days");
          }}
        />
      </div>
    );
  }

  if (view === "sign") return <SignAndSend trip={trip} me={me} onBack={() => setView("days")} />;

  const queries = openQueries(trip);
  return (
    <div className="space-y-4">
      {back}
      <TripHeader
        trip={trip}
        action={
          <button type="button" onClick={() => setView("details")} className="min-h-10 text-sm font-semibold text-brand underline underline-offset-2">
            Change installation, PO, work order or dates
          </button>
        }
      />
      {trip.status === "queried" && queries.length > 0 && (
        <Alert tone="danger">
          <strong>{queries[0].byName}</strong> queried {queries.length === 1 ? "1 day" : `${queries.length} days`} (highlighted below). Change what needs changing, then sign and
          send again.
        </Alert>
      )}
      <p className="text-sm text-muted">Tap a day to change it. Only change the days that were different.</p>
      <DayList days={trip.days} queries={trip.queries} onChange={(days) => saveOnPhone({ ...trip, days })} />
      <TotalsSummary days={trip.days} />
      <Button className="w-full min-h-14 text-lg" onClick={() => setView("sign")}>
        Review, sign and send
      </Button>
      <p className="text-center text-xs text-muted">Everything is saved on this phone as you go.</p>
    </div>
  );
}

function SignAndSend({ trip, me, onBack }: { trip: LocalTrip; me: Me; onBack: () => void }) {
  const queries = openQueries(trip);
  // Who to send it to: last time's supervisor for this trip, else this installation's usual one.
  const site = installations().find((i) => i.name === trip.installation);
  const previous = Object.values(deviceStore.get().trips)
    .filter((t) => t.workerId === me.id && t.installation === trip.installation && t.submission)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const [supName, setSupName] = useState(trip.submission?.supervisorName ?? previous?.submission?.supervisorName ?? site?.supervisorName ?? "");
  const [supEmail, setSupEmail] = useState(trip.submission?.supervisorEmail ?? previous?.submission?.supervisorEmail ?? site?.supervisorEmail ?? "");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supEmail.trim());
  const ready = agreed && signature && supName.trim() && emailOk;

  function send() {
    if (!ready) return;
    const at = new Date().toISOString();
    const resent = trip.queries.length > 0;
    const next: Trip = {
      ...trip,
      status: "submitted",
      token: trip.token ?? newToken(),
      submission: { at, signature: signature!, supervisorName: supName.trim(), supervisorEmail: supEmail.trim().toLowerCase() },
      queries: trip.queries.map((q) => (q.resolvedAt ? q : { ...q, resolvedAt: at, reply: replies[q.id]?.trim() || undefined })),
    };
    saveOnPhone(next, { who: me.name, what: `${resent ? "Corrected, signed and re-sent" : "Signed and sent"} to ${next.submission!.supervisorEmail} for approval` });
    onBack();
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center text-sm font-semibold text-brand">
        ← Back to the days
      </button>
      <h1 className="text-xl font-bold">Sign and send</h1>
      <TripHeader trip={trip} />
      <TotalsSummary days={trip.days} />

      {queries.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Answer the query (optional)</h2>
          {queries.map((q) => (
            <Field key={q.id} label={`“${q.comment}”`}>
              <textarea
                className={`${inputClass} min-h-20 py-2`}
                value={replies[q.id] ?? ""}
                onChange={(e) => setReplies({ ...replies, [q.id]: e.target.value })}
                placeholder="e.g. Changed to a weather day"
                maxLength={300}
              />
            </Field>
          ))}
        </section>
      )}

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-semibold">Client supervisor who approves this trip</h2>
        <Field label="Their name">
          <input className={inputClass} value={supName} onChange={(e) => setSupName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Their email" hint="They get a secure link to approve on any phone or computer. No account needed.">
          <input className={inputClass} type="email" inputMode="email" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} autoComplete="off" />
        </Field>
        {supEmail && !emailOk && <p className="text-sm text-danger">Check the email address.</p>}
      </section>

      <section className="space-y-3">
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>{settings.workerDeclaration}.</span>
        </label>
        <SignaturePad onChange={setSignature} hasSignature={!!signature} />
      </section>

      <Button className="w-full min-h-14 text-lg" disabled={!ready} onClick={send}>
        Sign and send for approval
      </Button>
      <p className="text-center text-xs text-muted">No signal? That&apos;s fine. It&apos;s saved on this phone and sent automatically later.</p>
    </div>
  );
}

function SentTrip({ trip, me, back }: { trip: LocalTrip; me: Me; back: React.ReactNode }) {
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  return (
    <div className="space-y-4">
      {back}
      <TripHeader trip={trip} />

      {trip.status === "submitted" && trip.submission && (
        <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div>
            <h2 className="font-semibold text-amber-950">Waiting for {trip.submission.supervisorName} to approve</h2>
            <p className="text-sm text-amber-900">
              Signed {formatStamp(trip.submission.at)}.{" "}
              {trip.dirty ? "Saved on this phone. It reaches the office (and the link starts working) as soon as you have signal." : "The office has it."}
            </p>
          </div>
          <SendLink trip={trip} />
        </section>
      )}

      {isLocked(trip) && trip.approval && (
        <Alert tone="success">
          <strong>Approved</strong> by {trip.approval.name} on {formatStamp(trip.approval.at)}. This trip is now locked.
        </Alert>
      )}

      <DayList days={trip.days} queries={trip.queries} />
      <TotalsSummary days={trip.days} />
      <Signatures trip={trip} />
      <PdfButton trip={trip} />

      {trip.status === "submitted" &&
        (confirmWithdraw ? (
          <div className="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <p className="text-sm">Take it back to make changes? You&apos;ll need to sign and send it again, and the supervisor&apos;s link will say it&apos;s being corrected.</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmWithdraw(false)}>
                Keep it sent
              </Button>
              <Button className="flex-1" onClick={() => saveOnPhone({ ...trip, status: "draft" }, { who: me.name, what: "Took the trip back to make changes" })}>
                Take it back
              </Button>
            </div>
          </div>
        ) : (
          <button type="button" className="min-h-11 w-full text-sm font-semibold text-brand" onClick={() => setConfirmWithdraw(true)}>
            Need to change something before it&apos;s approved?
          </button>
        ))}
    </div>
  );
}
