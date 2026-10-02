import type { TripStatus } from "@/lib/vessel/types";

const STYLES: Record<TripStatus, string> = {
  in_progress: "bg-amber-100 text-amber-900",
  submitted: "bg-brand-soft text-brand-dark",
  queried: "bg-danger/10 text-danger",
  approved: "bg-brand text-white",
};
export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  in_progress: "In progress",
  submitted: "Waiting for approval",
  queried: "Queried by office",
  approved: "Approved",
};

export function TripBadge({ status }: { status: TripStatus }) {
  return <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${STYLES[status]}`}>{TRIP_STATUS_LABEL[status]}</span>;
}
