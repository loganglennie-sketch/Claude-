import { formatRange } from "@/lib/dates";
import type { Trip } from "@/lib/types";
import { StatusBadge } from "../ui";

/** Who, where and which PO / work order. */
export function TripHeader({ trip, action }: { trip: Trip; action?: React.ReactNode }) {
  const item = (label: string, value: string) => (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold break-words">{value || "–"}</dd>
    </div>
  );
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{trip.installation}</h1>
          <div className="text-sm text-muted">
            {trip.workerName} · {formatRange(trip.startDate, trip.endDate)}
          </div>
        </div>
        <StatusBadge status={trip.status} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {item("Client", trip.client)}
        {item("PO number", trip.poNumber)}
        {item("Work order / cost code", trip.workOrder)}
        {item("Days", `${trip.days.length}`)}
      </dl>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
