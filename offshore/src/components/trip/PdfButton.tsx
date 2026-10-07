"use client";

import { useState } from "react";
import { downloadFile } from "@/lib/download";
import { tripFileName } from "@/lib/trip";
import type { Trip } from "@/lib/types";
import { Button } from "../ui";

export function PdfButton({ trip, className = "w-full", label }: { trip: Trip; className?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { buildTripPdf } = await import("@/lib/pdf");
          downloadFile((await buildTripPdf(trip)) as BlobPart, tripFileName(trip, "pdf"), "application/pdf");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Making PDF…" : (label ?? (trip.approval ? "Download signed PDF" : "Download PDF"))}
    </Button>
  );
}
