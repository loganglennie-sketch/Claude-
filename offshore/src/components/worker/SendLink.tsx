"use client";

import { useState } from "react";
import { settings } from "@/config/settings";
import { formatRange } from "@/lib/dates";
import { formatHours, tripTotals } from "@/lib/trip";
import type { Trip } from "@/lib/types";
import { Button } from "../ui";

export function approvalLink(trip: Trip) {
  return `${window.location.origin}/approve/${trip.token}`;
}

/** Sends the supervisor their link with the technician's own email app (free; works with no signal too: it waits in the outbox). */
export function SendLink({ trip }: { trip: Trip }) {
  const [copied, setCopied] = useState(false);
  if (!trip.submission || !trip.token) return null;
  const link = approvalLink(trip);
  const t = tripTotals(trip.days);
  const first = trip.submission.supervisorName.split(" ")[0] || "there";
  const subject = `Please approve: ${trip.workerName}, ${trip.installation}, ${formatRange(trip.startDate, trip.endDate)}`;
  const body = [
    `Hi ${first},`,
    "",
    `Please approve my timesheet for ${trip.installation} (${trip.client}), ${formatRange(trip.startDate, trip.endDate)}: ${t.daysOn} days on, ${formatHours(t.hours)} hours.`,
    trip.poNumber ? `PO ${trip.poNumber}${trip.workOrder ? `, work order ${trip.workOrder}` : ""}.` : "",
    "",
    "Open this link on any phone or computer (no account needed). You can approve it, or query a day if something's wrong:",
    link,
    "",
    "Thanks,",
    trip.workerName,
    settings.companyName,
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
  const mailto = `mailto:${encodeURIComponent(trip.submission.supervisorEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="space-y-2">
      <a href={mailto} className="flex min-h-14 w-full items-center justify-center rounded-xl bg-brand px-5 text-lg font-semibold text-white">
        Email the link to {first}
      </a>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            } catch {
              window.prompt("Copy this link:", link);
            }
          }}
        >
          {copied ? "Copied ✓" : "Copy link"}
        </Button>
        {canShare ? (
          <Button variant="secondary" onClick={() => navigator.share({ title: subject, text: body }).catch(() => undefined)}>
            Share…
          </Button>
        ) : (
          <a href={link} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-xl border-2 border-brand px-3 font-semibold text-brand">
            Open link
          </a>
        )}
      </div>
      <p className="text-xs text-muted">
        Opens your own email app with the message written for you. With no signal it waits in your outbox. Demo: the link only opens in this browser until stage 2.{" "}
        <a href={link} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">
          Open the supervisor&apos;s page
        </a>
      </p>
    </div>
  );
}
