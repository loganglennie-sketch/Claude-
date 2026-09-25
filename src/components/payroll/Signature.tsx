import type { Timesheet } from "@/lib/types";

/** Shows a worker's signature, whether drawn on a phone or from demo data. */
export function Signature({ sheet, name }: { sheet: Timesheet; name: string }) {
  if (sheet.signature) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={sheet.signature} alt={`Signature of ${name}`} className="h-28 w-full object-contain" />;
  }
  if (sheet.signaturePath) {
    return (
      <svg viewBox="0 0 300 90" role="img" aria-label={`Signature of ${name}`} className="h-28 w-full">
        <path d={sheet.signaturePath} fill="none" stroke="#111" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return <p className="text-muted">No signature</p>;
}
