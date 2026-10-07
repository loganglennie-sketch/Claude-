import { settings } from "@/config/settings";
import { formatStamp } from "@/lib/dates";
import type { Trip } from "@/lib/types";
import { SignatureImage } from "../SignaturePad";

/** The technician's signature and the client's approval, as they appear on the PDF. */
export function Signatures({ trip }: { trip: Trip }) {
  if (!trip.submission) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Technician</div>
        <SignatureImage signature={trip.submission.signature} className="my-1" />
        <div className="font-semibold">{trip.workerName}</div>
        <div className="text-sm text-muted">Signed {formatStamp(trip.submission.at)}</div>
        <div className="mt-1 text-xs text-muted">“{settings.workerDeclaration}”</div>
      </div>
      <div className={`rounded-2xl border p-4 ${trip.approval ? "border-emerald-300 bg-emerald-50" : "border-dashed border-line bg-surface"}`}>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Client approval</div>
        {trip.approval ? (
          <>
            <SignatureImage signature={trip.approval.signature} className="my-1" />
            <div className="font-semibold">{trip.approval.name}</div>
            <div className="text-sm break-all">{trip.approval.email}</div>
            <div className="text-sm text-muted">Approved {formatStamp(trip.approval.at)}</div>
            <div className="mt-1 text-xs text-muted">“{settings.clientDeclaration}”</div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Not approved yet. Sent to {trip.submission.supervisorName} ({trip.submission.supervisorEmail}).
          </p>
        )}
      </div>
    </div>
  );
}
