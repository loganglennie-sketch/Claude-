import { Suspense } from "react";
import { TripScreen } from "@/components/worker/TripScreen";

// The trip is chosen with ?id=…, so this one page (saved on the phone) can open any trip with no signal.
export default function TripPage() {
  return (
    <Suspense>
      <TripScreen />
    </Suspense>
  );
}
