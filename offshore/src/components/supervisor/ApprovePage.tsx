"use client";

import { useState } from "react";
import { settings } from "@/config/settings";
import { formatDayMonth, formatDayName, formatStamp } from "@/lib/dates";
import { serverStore, supervisorApprove, supervisorQuery } from "@/lib/demo-server";
import { useHydrated } from "@/lib/local-store";
import { openQueries } from "@/lib/trip";
import type { Trip } from "@/lib/types";
import { SignaturePad, SignatureImage } from "../SignaturePad";
import { DayList, TotalsSummary } from "../trip/DayList";
import { PdfButton } from "../trip/PdfButton";
import { Signatures } from "../trip/Signatures";
import { TripHeader } from "../trip/TripHeader";
import { Alert, Button, Card, Field, inputClass } from "../ui";

/** What the client's supervisor sees when they open their link. No account, any device. */
export function ApprovePage({ token }: { token: string }) {
  const hydrated = useHydrated();
  const trip = serverStore.useValue((d) => (token.length >= 20 ? (Object.values(d.trips).find((t) => t.token === token) ?? null) : null));

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- small icon file */}
          <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg ring-1 ring-white/40" />
          <div className="leading-tight">
            <div className="font-semibold">{settings.companyName}</div>
            <div className="text-sm opacity-80">Timesheet for client approval</div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-5">
        {!hydrated ? null : !trip ? (
          <Card>
            <h1 className="text-lg font-bold">This link doesn&apos;t work</h1>
            <p className="mt-1 text-muted">
              Check you used the whole link from the email. If it still doesn&apos;t open, ask the technician to send it again.
            </p>
            <p className="mt-2 text-xs text-muted">Demo: approval links only open in the same browser as the technician&apos;s app until stage 2 (the database).</p>
          </Card>
        ) : (
          <TripForApproval trip={trip} token={token} />
        )}
        <p className="pb-6 text-center text-xs text-muted">
          This is a private link for the person it was sent to. Please don&apos;t forward it. Your name, email and the time are recorded with your answer.
        </p>
      </main>
    </div>
  );
}

function TripForApproval({ trip, token }: { trip: Trip; token: string }) {
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [name, setName] = useState(trip.submission?.supervisorName ?? "");
  const [email, setEmail] = useState(trip.submission?.supervisorEmail ?? "");
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (trip.status === "draft") {
    return (
      <>
        <TripHeader trip={trip} />
        <Alert tone="warning">
          {trip.workerName} took this trip back to correct it. You&apos;ll get a new email when it&apos;s ready for approval again.
        </Alert>
      </>
    );
  }

  if (trip.status === "queried") {
    const open = openQueries(trip);
    return (
      <>
        <TripHeader trip={trip} />
        <Alert tone="warning">
          <strong>Queried.</strong> {open[0]?.byName} queried {open.length === 1 ? "1 day" : `${open.length} days`} on {open[0] && formatStamp(open[0].at)}. {trip.workerName} will
          correct it and send it back to you.
        </Alert>
        <DayList days={trip.days} queries={trip.queries} />
        <TotalsSummary days={trip.days} />
      </>
    );
  }

  if (trip.status !== "submitted") {
    return (
      <>
        <TripHeader trip={trip} />
        {trip.approval && (
          <Alert tone="success">
            <strong>Approved</strong> by {trip.approval.name} ({trip.approval.email}) on {formatStamp(trip.approval.at)}. This timesheet is now locked. Thank you.
          </Alert>
        )}
        <DayList days={trip.days} queries={trip.queries} />
        <TotalsSummary days={trip.days} />
        <Signatures trip={trip} />
        <PdfButton trip={trip} />
      </>
    );
  }

  const queried = Object.entries(queries).filter(([, c]) => c !== undefined);
  const queryCount = queried.length;
  const queriesComplete = queried.every(([, c]) => c.trim().length > 0);
  const who = name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  async function act(kind: "approve" | "query") {
    setBusy(true);
    setError(null);
    try {
      const by = { name: name.trim(), email: email.trim().toLowerCase() };
      if (kind === "approve") await supervisorApprove(token, { ...by, signature: signature! });
      else await supervisorQuery(token, by, queried.map(([date, comment]) => ({ date, comment })));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div>
        <h1 className="text-xl font-bold">Please check {trip.workerName}&apos;s trip</h1>
        <p className="text-muted">Approve it if the days are right, or query a day if something&apos;s wrong. It only takes a minute.</p>
      </div>
      <TripHeader trip={trip} />
      <DayList
        days={trip.days}
        queries={trip.queries}
        renderExtra={(day) =>
          queries[day.date] === undefined ? (
            <div className="px-3 pb-2 text-right">
              <button type="button" className="min-h-9 text-sm font-semibold text-danger underline underline-offset-2" onClick={() => setQueries({ ...queries, [day.date]: "" })}>
                Query this day
              </button>
            </div>
          ) : (
            <div className="space-y-2 bg-rose-50 px-3 pb-3">
              <label className="block text-sm font-semibold text-rose-900" htmlFor={`q-${day.date}`}>
                What&apos;s wrong with {formatDayName(day.date)} {formatDayMonth(day.date)}?
              </label>
              <textarea
                id={`q-${day.date}`}
                autoFocus
                className={`${inputClass} min-h-20 py-2`}
                value={queries[day.date]}
                onChange={(e) => setQueries({ ...queries, [day.date]: e.target.value })}
                placeholder="e.g. No flights this day, should be a weather day"
                maxLength={500}
              />
              <button
                type="button"
                className="min-h-9 text-sm font-semibold text-muted underline"
                onClick={() => {
                  const next = { ...queries };
                  delete next[day.date];
                  setQueries(next);
                }}
              >
                Remove query
              </button>
            </div>
          )
        }
      />
      <TotalsSummary days={trip.days} />
      {trip.submission && (
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Signed by the technician</div>
          <SignatureImage signature={trip.submission.signature} className="my-1" />
          <div className="text-sm">
            {trip.workerName}, {formatStamp(trip.submission.at)}
          </div>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Your details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your name">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label="Your email">
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
        </div>

        {queryCount > 0 ? (
          <>
            <Alert tone="warning">
              You&apos;re querying {queryCount === 1 ? "1 day" : `${queryCount} days`}. The trip goes back to {trip.workerName} to correct, then comes back to you.
            </Alert>
            {!queriesComplete && <p className="text-sm text-danger">Write a comment for each day you&apos;re querying.</p>}
            <Button variant="danger" className="w-full min-h-14" disabled={busy || !who || !queriesComplete} onClick={() => act("query")}>
              {busy ? "Sending…" : `Send query (${queryCount === 1 ? "1 day" : `${queryCount} days`})`}
            </Button>
          </>
        ) : (
          <>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>{settings.clientDeclaration}.</span>
            </label>
            <SignaturePad onChange={setSignature} hasSignature={!!signature} />
            <Button className="w-full min-h-14 text-lg" disabled={busy || !who || !agreed || !signature} onClick={() => act("approve")}>
              {busy ? "Approving…" : "Approve trip"}
            </Button>
            <p className="text-center text-xs text-muted">Once approved, the timesheet is locked and can&apos;t be changed.</p>
          </>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </Card>
    </>
  );
}
