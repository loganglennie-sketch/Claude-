"use client";

import { useRouter } from "next/navigation";
import { addDays, todayISO } from "@/lib/dates";
import { deviceStore, saveOnPhone } from "@/lib/device";
import { installations } from "@/lib/demo-server";
import { useMe } from "@/lib/session";
import { DEFAULT_PATTERN, daysFor, newId } from "@/lib/trip";
import type { Trip } from "@/lib/types";
import { TripDetailsForm, type TripDetails } from "./TripDetailsForm";

export function NewTrip() {
  const me = useMe();
  const router = useRouter();
  if (!me) return null;

  // Start from the last trip's installation, client, PO and work order: usually the same.
  const last = Object.values(deviceStore.get().trips)
    .filter((t) => t.workerId === me.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const site = installations()[0];
  const start = todayISO();
  const initial: TripDetails = {
    installation: last?.installation ?? site?.name ?? "",
    client: last?.client ?? site?.client ?? "",
    poNumber: last?.poNumber ?? site?.poNumber ?? "",
    workOrder: last?.workOrder ?? site?.workOrder ?? "",
    startDate: start,
    endDate: addDays(start, 13),
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">New trip</h1>
      <p className="mb-4 text-sm text-muted">One timesheet for the whole trip, from the day you travel out to the day you get home.</p>
      <TripDetailsForm
        initial={initial}
        pattern={DEFAULT_PATTERN}
        submitLabel="Create trip"
        onCancel={() => router.push("/trips")}
        onSubmit={(details, pattern) => {
          const now = new Date().toISOString();
          const trip: Trip = {
            id: newId("trip-"),
            workerId: me.id,
            workerName: me.name,
            ...details,
            days: daysFor(details.startDate, details.endDate, pattern ?? DEFAULT_PATTERN),
            status: "draft",
            queries: [],
            events: [],
            version: 0,
            updatedAt: now,
          };
          saveOnPhone(trip, { who: me.name, what: "Started the trip" });
          router.replace(`/trips/trip?id=${trip.id}`);
        }}
      />
    </div>
  );
}
