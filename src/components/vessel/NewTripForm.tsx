"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { vesselSettings } from "@/config/vessel";
import { startTrip, useFleet } from "@/lib/vessel/store";
import { formatDate, formatSpan, openTrip, uniqueCrew, vesselTrips } from "@/lib/vessel/trips";
import { addDays, isISODate, toISODate } from "@/lib/week";
import { Button, ButtonLink, Card } from "../ui";
import { Field, inputClass } from "./fields";
import { useMyVesselId } from "./RequireVessel";

/** Step 1 of a trip: dates, client and job number, and where the crew list starts from. */
export function NewTripForm() {
  const vesselId = useMyVesselId();
  const { trips, vesselsById, peopleById } = useFleet();
  const router = useRouter();
  const last = vesselTrips(trips, vesselId)[0] ?? null;

  const today = toISODate(new Date());
  const tripLength = vesselSettings.defaultTripDays - 1;
  const [mobDate, setMobDate] = useState(today);
  const [demobDate, setDemobDate] = useState(addDays(today, tripLength));
  const [demobTouched, setDemobTouched] = useState(false);
  // Charters often run for several trips, so start from the last trip's client and job.
  const [client, setClient] = useState(last?.client ?? "");
  const [jobNumber, setJobNumber] = useState(last?.jobNumber ?? "");
  const [copyCrew, setCopyCrew] = useState(!!last);

  const vessel = vesselsById[vesselId];
  if (!vessel) return <div className="p-8 text-center text-muted">Loading…</div>;
  const alreadyOpen = openTrip(trips, vesselId);
  if (alreadyOpen) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4 px-4 pt-6">
        <Card className="space-y-3">
          <p>
            Trip <strong>{alreadyOpen.reference}</strong> is still open. Submit it (or ask the office) before starting another.
          </p>
          <ButtonLink href={`/vessel/trip?id=${alreadyOpen.id}`}>Open {alreadyOpen.reference}</ButtonLink>
        </Card>
      </div>
    );
  }

  const lastCrew = last ? uniqueCrew(last) : [];
  const datesOk = isISODate(mobDate) && isISODate(demobDate) && demobDate >= mobDate;
  const overlapsLast = !!last && datesOk && mobDate <= last.demobDate;
  const canStart = datesOk && !overlapsLast && client.trim() !== "" && jobNumber.trim() !== "";

  function changeMob(value: string) {
    setMobDate(value);
    // Keep the planned length unless they've set the demob date themselves.
    if (!demobTouched && isISODate(value)) setDemobDate(addDays(value, tripLength));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canStart) return;
    const trip = startTrip({ vesselId, mobDate, demobDate, client, jobNumber, copyCrewFrom: copyCrew && last ? last.id : null });
    router.replace(`/vessel/trip?id=${trip.id}`);
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-6 pb-10 pt-6">
      <div>
        <h1 className="text-2xl font-bold">Start a new trip</h1>
        <p className="text-muted">{vessel.name}</p>
      </div>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">1. Dates</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mob date" hint="First day of the trip">
            <input type="date" required value={mobDate} onChange={(e) => changeMob(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Demob date" hint="Planned – you can change it later">
            <input
              type="date"
              required
              value={demobDate}
              min={mobDate}
              onChange={(e) => {
                setDemobDate(e.target.value);
                setDemobTouched(true);
              }}
              className={inputClass}
            />
          </Field>
        </div>
        {isISODate(mobDate) && isISODate(demobDate) && demobDate < mobDate && <p className="text-sm text-danger">Demob must be on or after mob.</p>}
        {overlapsLast && (
          <p className="text-sm font-medium text-danger">
            The last trip ({last!.reference}) ran until {formatDate(last!.demobDate)}. Pick a mob date after that.
          </p>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">2. Client and job</h2>
        <Field label="Client / charterer">
          <input value={client} onChange={(e) => setClient(e.target.value)} required placeholder="e.g. Harbour Energy" className={inputClass} />
        </Field>
        <Field label="Job / charter number" hint="Used to group the invoicing export">
          <input value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} required placeholder="e.g. HE-4471" className={inputClass} />
        </Field>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">3. Crew</h2>
        {last ? (
          <>
            <Choice checked={copyCrew} onChange={() => setCopyCrew(true)} title={`Copy the crew from the last trip (${last.reference})`}>
              {lastCrew.length} people from {formatSpan(last.mobDate, last.demobDate)}. You can remove or add people on the next screen.
              <span className="mt-1 block text-ink">{lastCrew.map((c) => peopleById[c.personId]?.name).join(", ")}</span>
            </Choice>
            <Choice checked={!copyCrew} onChange={() => setCopyCrew(false)} title="Start with an empty crew list">
              Pick everyone from the personnel list.
            </Choice>
          </>
        ) : (
          <p className="text-muted">You&apos;ll pick the crew from the personnel list on the next screen.</p>
        )}
      </Card>

      <Button type="submit" disabled={!canStart}>
        Start trip
      </Button>
      <ButtonLink href="/vessel" variant="ghost">
        Cancel
      </ButtonLink>
    </form>
  );
}

function Choice({ checked, onChange, title, children }: { checked: boolean; onChange: () => void; title: string; children: React.ReactNode }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${checked ? "border-brand bg-brand-soft/50" : "border-line"}`}>
      <input type="radio" checked={checked} onChange={onChange} className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand-primary)]" />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{children}</span>
      </span>
    </label>
  );
}
