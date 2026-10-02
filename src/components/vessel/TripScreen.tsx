"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteTrip, saveTrip, useFleet } from "@/lib/vessel/store";
import { crewOnDate, crewProblems, daysInclusive, formatDate, formatShortDate, formatSpan, isEditable, sortCrew, withTripDates } from "@/lib/vessel/trips";
import type { CrewMember, Trip } from "@/lib/vessel/types";
import { isISODate, toISODate } from "@/lib/week";
import { Card } from "../ui";
import { AddCrewPanel, CrewChangePanel } from "./CrewPanels";
import { Field, inputClass } from "./fields";
import { useMyVesselId } from "./RequireVessel";
import { TripBadge } from "./TripBadge";
import { SubmitPanel } from "./SubmitPanel";
import { TripGrid } from "./TripGrid";

/** One trip: its details and who was on board when. */
export function TripScreen({ tripId }: { tripId: string }) {
  const vesselId = useMyVesselId();
  const fleet = useFleet();
  const trip = fleet.trips.find((t) => t.id === tripId && t.vesselId === vesselId);

  if (!trip) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-3 px-4 pt-6">
        <p>That trip couldn&apos;t be found on this device.</p>
        <Link href="/vessel" className="font-semibold text-brand">
          ← Back to trips
        </Link>
      </div>
    );
  }
  return <TripEditor key={trip.id} trip={trip} />;
}

type Panel = "add" | "change" | null;
type Tab = "sheet" | "crew" | "submit";

function TripEditor({ trip }: { trip: Trip }) {
  const { trips, peopleById, vesselsById } = useFleet();
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  // A new trip starts on the crew list; once there's crew, on the daily sheet.
  const [tab, setTab] = useState<Tab>(trip.crew.length ? "sheet" : "crew");
  const editable = isEditable(trip);
  const today = toISODate(new Date());
  const problems = crewProblems(trip, trips, peopleById, vesselsById);
  const crew = sortCrew(trip.crew, peopleById);
  const peopleCount = new Set(trip.crew.map((m) => m.personId)).size;
  const openQueries = (trip.queries ?? []).filter((q) => !q.answeredAt);
  const flagged = Object.fromEntries(openQueries.map((q) => [q.crewId, q.comment]));

  const update = (next: Trip) => saveTrip(next);
  const updateMember = (id: string, patch: Partial<CrewMember>) => update({ ...trip, crew: trip.crew.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const removeMember = (m: CrewMember) => {
    if (!window.confirm(`Take ${peopleById[m.personId]?.name ?? "this person"} off this trip? Their days on this trip will be removed.`)) return;
    const cells = { ...trip.cells };
    delete cells[m.id];
    update({ ...trip, crew: trip.crew.filter((c) => c.id !== m.id), cells });
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl flex-1 space-y-4 px-6 pb-10 pt-6">
      <Link href="/vessel" className="text-sm font-semibold text-brand">
        ← All trips
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{trip.reference}</h1>
          <p className="text-muted">
            {formatSpan(trip.mobDate, trip.demobDate)} · {daysInclusive(trip.mobDate, trip.demobDate)} days
          </p>
        </div>
        <TripBadge status={trip.status} />
      </div>

      {!editable && (
        <Card className="bg-brand-soft/60 text-sm">
          {trip.status === "approved"
            ? `Approved by the office${trip.approvedAt ? ` on ${formatDate(trip.approvedAt.slice(0, 10))}` : ""}. This trip is locked.`
            : `Signed by ${trip.signedBy ?? "the master"} and sent to the office. It can't be changed unless the office sends it back.`}
        </Card>
      )}

      {openQueries.length > 0 && (
        <Card className="space-y-2 border-2 border-danger/50">
          <h2 className="font-semibold text-danger">
            The office has {openQueries.length === 1 ? "a query" : `${openQueries.length} queries`} about this trip sheet
          </h2>
          <ul className="space-y-1 text-sm">
            {openQueries.map((q) => {
              const m = trip.crew.find((c) => c.id === q.crewId);
              return (
                <li key={q.id}>
                  <strong>{m ? peopleById[m.personId]?.name : "A crew line"}</strong>
                  {q.date && ` (${formatDate(q.date)})`}: “{q.comment}” <span className="text-muted">– {q.by}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-muted">Fix the lines marked in red on the daily sheet or crew list, then sign and send it back to the office.</p>
        </Card>
      )}

      <TripDetails trip={trip} editable={editable} onSave={update} />

      <div role="tablist" className="flex gap-1 border-b-2 border-line">
        {([["sheet", "Daily sheet"], ["crew", `Crew (${peopleCount})`], ...(editable ? ([["submit", "✍ Sign & submit"]] as const) : [])] as const).map(
          ([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-0.5 border-b-2 px-4 py-2 font-semibold ${tab === id ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ),
        )}
        {problems.length > 0 && (
          <button type="button" onClick={() => setTab("crew")} className="ml-auto self-center text-sm font-semibold text-danger">
            ⚠ {problems.length} crew {problems.length === 1 ? "problem" : "problems"} to fix
          </button>
        )}
      </div>

      {tab === "submit" &&
        (editable ? (
          <SubmitPanel trip={trip} onShowCrew={() => setTab("crew")} />
        ) : (
          <Card className="space-y-1 border-2 border-brand bg-brand-soft">
            <p className="text-lg font-semibold text-brand-dark">✓ Signed and sent to the office</p>
            <p className="text-sm">{trip.reference} is now waiting for approval. It&apos;s locked unless the office sends it back with a query.</p>
          </Card>
        ))}

      {tab === "sheet" && (
        <Card>
          <TripGrid trip={trip} editable={editable} flagged={flagged} />
        </Card>
      )}

      {tab === "crew" && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Crew</h2>
              <p className="text-sm text-muted">
                {peopleCount} {peopleCount === 1 ? "person" : "people"} on this trip
                {today >= trip.mobDate && today <= trip.demobDate && ` · ${crewOnDate(trip, today).length} on board today`}
              </p>
            </div>
            {editable && (
              <div className="flex gap-2">
                <PanelButton active={panel === "add"} onClick={() => setPanel(panel === "add" ? null : "add")}>
                  + Add crew
                </PanelButton>
                <PanelButton active={panel === "change"} onClick={() => setPanel(panel === "change" ? null : "change")} disabled={trip.crew.length === 0}>
                  ⇄ Crew change
                </PanelButton>
              </div>
            )}
          </div>

          {panel === "add" && <AddCrewPanel trip={trip} onDone={() => setPanel(null)} />}
          {panel === "change" && <CrewChangePanel trip={trip} onDone={() => setPanel(null)} />}

          {crew.length === 0 ? (
            <p className="rounded-xl bg-page p-4 text-center text-muted">No crew yet. Click “Add crew” to pick people from the personnel list.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3">Name</th>
                  <th className="px-3 py-2">Rank</th>
                  <th className="px-3 py-2">Staff / agency</th>
                  <th className="px-3 py-2">Joined</th>
                  <th className="px-3 py-2">Left</th>
                  <th className="px-3 py-2 text-right">Days</th>
                  <th className="w-1/5 px-3 py-2">On board</th>
                  {editable && <th className="py-2 pl-3" />}
                </tr>
              </thead>
              <tbody>
                {crew.map((m) => (
                  <CrewRow
                    key={m.id}
                    trip={trip}
                    member={m}
                    editable={editable}
                    problems={problems.filter((p) => p.crewId === m.id).map((p) => p.message)}
                    onChange={(patch) => updateMember(m.id, patch)}
                    onRemove={() => removeMember(m)}
                  />
                ))}
              </tbody>
            </table>
          )}
          {editable && (
            <p className="text-xs text-muted">
              Each person has their own join and leave date. For a crew change, use “Crew change”: the person leaving and the person joining are both counted on
              the change day.
            </p>
          )}
        </Card>
      )}

      {trip.status === "in_progress" && (
        <button
          type="button"
          className="text-sm font-semibold text-danger"
          onClick={() => {
            if (!window.confirm(`Delete trip ${trip.reference}? Only do this if it was started by mistake.`)) return;
            deleteTrip(trip.id);
            router.replace("/vessel");
          }}
        >
          Delete this trip
        </button>
      )}
    </div>
  );
}

function TripDetails({ trip, editable, onSave }: { trip: Trip; editable: boolean; onSave: (t: Trip) => void }) {
  const [client, setClient] = useState(trip.client);
  const [jobNumber, setJobNumber] = useState(trip.jobNumber);

  const setDates = (mob: string, demob: string) => {
    if (!isISODate(mob) || !isISODate(demob) || demob < mob) return;
    onSave(withTripDates(trip, mob, demob));
  };

  return (
    <Card className="grid grid-cols-4 gap-4">
      <Field label="Mob date">
        <input
          type="date"
          value={trip.mobDate}
          max={trip.demobDate}
          disabled={!editable}
          onChange={(e) => setDates(e.target.value, trip.demobDate)}
          className={inputClass}
        />
      </Field>
      <Field label="Demob date" hint={editable ? "Crew leaving on the demob date move with it" : undefined}>
        <input
          type="date"
          value={trip.demobDate}
          min={trip.mobDate}
          disabled={!editable}
          onChange={(e) => setDates(trip.mobDate, e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Client / charterer">
        <input
          value={client}
          disabled={!editable}
          onChange={(e) => setClient(e.target.value)}
          onBlur={() => client.trim() && client !== trip.client && onSave({ ...trip, client: client.trim() })}
          className={inputClass}
        />
      </Field>
      <Field label="Job / charter number">
        <input
          value={jobNumber}
          disabled={!editable}
          onChange={(e) => setJobNumber(e.target.value)}
          onBlur={() => jobNumber.trim() && jobNumber !== trip.jobNumber && onSave({ ...trip, jobNumber: jobNumber.trim() })}
          className={inputClass}
        />
      </Field>
    </Card>
  );
}

function CrewRow({
  trip,
  member,
  editable,
  problems,
  onChange,
  onRemove,
}: {
  trip: Trip;
  member: CrewMember;
  editable: boolean;
  problems: string[];
  onChange: (patch: Partial<CrewMember>) => void;
  onRemove: () => void;
}) {
  const { peopleById } = useFleet();
  const person = peopleById[member.personId];
  const total = daysInclusive(trip.mobDate, trip.demobDate);
  const startPct = ((daysInclusive(trip.mobDate, member.joined) - 1) / total) * 100;
  const widthPct = (Math.max(0, daysInclusive(member.joined, member.left)) / total) * 100;
  const dateInput = `${inputClass} min-h-9 w-40 px-2 text-sm`;

  return (
    <>
      <tr className={problems.length ? "" : "border-b border-line"}>
        <td className="whitespace-nowrap py-2 pr-3 font-semibold">{person?.name ?? "Unknown person"}</td>
        <td className="px-3 py-2">{member.role}</td>
        <td className="px-3 py-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${person?.employment === "agency" ? "bg-amber-100 text-amber-900" : "bg-brand-soft text-brand-dark"}`}
          >
            {person?.employment === "agency" ? `Agency${person.agency ? ` · ${person.agency}` : ""}` : "Staff"}
          </span>
        </td>
        <td className="px-3 py-2 tabular-nums">
          {editable ? (
            <input
              type="date"
              aria-label="Joined"
              value={member.joined}
              min={trip.mobDate}
              max={member.left}
              onChange={(e) => isISODate(e.target.value) && onChange({ joined: e.target.value })}
              className={dateInput}
            />
          ) : (
            formatShortDate(member.joined)
          )}
        </td>
        <td className="px-3 py-2 tabular-nums">
          {editable ? (
            <input
              type="date"
              aria-label="Left"
              value={member.left}
              min={member.joined}
              max={trip.demobDate}
              onChange={(e) => isISODate(e.target.value) && onChange({ left: e.target.value })}
              className={dateInput}
            />
          ) : (
            formatShortDate(member.left)
          )}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{Math.max(0, daysInclusive(member.joined, member.left))}</td>
        <td className="px-3 py-2">
          {/* When they were on board, across the length of the trip. */}
          <div className="relative h-2 rounded-full bg-page" title={`${formatShortDate(member.joined)} – ${formatShortDate(member.left)}`}>
            <div className="absolute h-2 rounded-full bg-brand" style={{ left: `${startPct}%`, width: `${widthPct}%` }} />
          </div>
        </td>
        {editable && (
          <td className="py-2 pl-3 text-right">
            <button type="button" onClick={onRemove} className="text-sm font-semibold text-danger">
              Remove
            </button>
          </td>
        )}
      </tr>
      {problems.length > 0 && (
        <tr className="border-b border-line">
          <td colSpan={editable ? 8 : 7} className="pb-2 text-sm font-medium text-danger">
            {problems.join(" ")}
          </td>
        </tr>
      )}
    </>
  );
}

function PanelButton({ active, ...props }: React.ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      className={`min-h-11 rounded-xl border-2 px-3 text-sm font-semibold disabled:opacity-40 ${active ? "border-brand bg-brand text-white" : "border-brand text-brand"}`}
      {...props}
    />
  );
}
