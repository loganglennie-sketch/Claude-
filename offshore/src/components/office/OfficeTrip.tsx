"use client";

import Link from "next/link";
import { useState } from "react";
import { settings } from "@/config/settings";
import { formatRange, formatStamp } from "@/lib/dates";
import { markInvoiced, markReady, serverStore } from "@/lib/demo-server";
import { useMe } from "@/lib/session";
import { openQueries } from "@/lib/trip";
import type { Trip } from "@/lib/types";
import { DayList, TotalsSummary } from "../trip/DayList";
import { PdfButton } from "../trip/PdfButton";
import { Signatures } from "../trip/Signatures";
import { TripHeader } from "../trip/TripHeader";
import { Alert, Button, Card, Field, inputClass } from "../ui";

export function OfficeTrip({ id }: { id: string }) {
  const trip = serverStore.useValue((d) => d.trips[id] ?? null);
  if (trip === undefined) return null;
  if (!trip) return <p className="text-muted">Trip not found.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <Link href="/office" className="inline-flex min-h-10 items-center text-sm font-semibold text-brand">
          ← All trips
        </Link>
        <TripHeader trip={trip} />
        <DayList days={trip.days} queries={trip.queries} />
        <Signatures trip={trip} />
      </div>
      <div className="space-y-4">
        <Actions trip={trip} />
        <TotalsSummary days={trip.days} />
        <PdfButton trip={trip} />
        <Card>
          <h2 className="mb-2 font-semibold">History</h2>
          <ol className="space-y-2 text-sm">
            {[...trip.events].reverse().map((e) => (
              <li key={e.id}>
                <div className="text-xs text-muted">{formatStamp(e.at)}</div>
                <div>
                  <span className="font-semibold">{e.who}</span>: {e.what}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function Actions({ trip }: { trip: Trip }) {
  const me = useMe();
  const by = me?.name ?? "Office";
  const [invoice, setInvoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };

  if (trip.status === "submitted" && trip.submission && trip.token) {
    const link = `${window.location.origin}/approve/${trip.token}`;
    const subject = `Reminder: please approve ${trip.workerName}'s timesheet, ${trip.installation}, ${formatRange(trip.startDate, trip.endDate)}`;
    const body = `Hi ${trip.submission.supervisorName.split(" ")[0]},\n\nA quick reminder to approve (or query) ${trip.workerName}'s timesheet for ${trip.installation}, ${formatRange(trip.startDate, trip.endDate)}. No account needed:\n${link}\n\nThanks,\n${by}\n${settings.companyName}`;
    return (
      <Card className="space-y-2">
        <h2 className="font-semibold">Waiting for {trip.submission.supervisorName}</h2>
        <p className="text-sm text-muted">
          Sent to {trip.submission.supervisorEmail} on {formatStamp(trip.submission.at)}.
        </p>
        <a
          className="flex min-h-12 items-center justify-center rounded-xl bg-brand px-4 font-semibold text-white"
          href={`mailto:${encodeURIComponent(trip.submission.supervisorEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
        >
          Email a reminder
        </a>
        <Button
          variant="secondary"
          className="w-full"
          onClick={async () => {
            await navigator.clipboard.writeText(link).catch(() => window.prompt("Copy this link:", link));
            setCopied(true);
          }}
        >
          {copied ? "Copied ✓" : "Copy approval link"}
        </Button>
      </Card>
    );
  }
  if (trip.status === "queried") {
    const q = openQueries(trip);
    return (
      <Alert tone="warning">
        <strong>Queried</strong> by {q[0]?.byName}. Waiting for {trip.workerName} to correct and resend.
      </Alert>
    );
  }
  if (trip.status === "approved") {
    return (
      <Card className="space-y-2">
        <h2 className="font-semibold">Approved by the client</h2>
        <p className="text-sm text-muted">Check the PO number and work order / cost code are right for invoicing.</p>
        <Button className="w-full" disabled={busy} onClick={() => run(() => markReady([trip.id], by))}>
          Checked: ready to invoice
        </Button>
      </Card>
    );
  }
  if (trip.status === "ready") {
    return (
      <Card className="space-y-2">
        <h2 className="font-semibold">Ready to invoice</h2>
        <Field label="Invoice number (optional)">
          <input className={inputClass} value={invoice} onChange={(e) => setInvoice(e.target.value)} />
        </Field>
        <Button className="w-full" disabled={busy} onClick={() => run(() => markInvoiced(trip.id, invoice, by))}>
          Mark invoiced
        </Button>
      </Card>
    );
  }
  if (trip.status === "invoiced") {
    return (
      <Alert tone="success">
        Invoiced{trip.invoiceNumber ? ` on invoice ${trip.invoiceNumber}` : ""}
        {trip.invoicedAt ? `, ${formatStamp(trip.invoicedAt)}` : ""}.
      </Alert>
    );
  }
  return <Alert>Not sent yet. {trip.workerName} is still filling it in.</Alert>;
}
