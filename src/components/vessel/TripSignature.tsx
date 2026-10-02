import type { Trip } from "@/lib/vessel/types";

/** The master's signature on a trip sheet, whether drawn on screen or from demo data. */
export function TripSignature({ trip }: { trip: Trip }) {
  const label = `Signature of ${trip.signedBy ?? "the master"}`;
  if (trip.signature) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={trip.signature} alt={label} className="h-24 w-full object-contain" />;
  }
  if (trip.signaturePath) {
    return (
      <svg viewBox="0 0 300 90" role="img" aria-label={label} className="h-24 w-full">
        <path d={trip.signaturePath} fill="none" stroke="#111" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return <p className="text-muted">Not signed yet</p>;
}
