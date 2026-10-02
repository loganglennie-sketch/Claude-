"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homePath, useWorker } from "@/lib/demo-auth";
import { useDemoCompany } from "@/lib/demo-company";
import { useHydrated } from "@/lib/demo-store";
import { useFleet } from "@/lib/vessel/store";

/** Only vessel logins get in; everyone else goes to sign-in or their own screens. */
export function RequireVessel({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const worker = useWorker();
  const router = useRouter();
  const { mode } = useDemoCompany();

  useEffect(() => {
    if (!hydrated) return;
    if (!worker) router.replace("/login");
    else if (!worker.vesselId) router.replace(homePath(worker, mode));
  }, [hydrated, worker, router, mode]);

  if (!hydrated || !worker?.vesselId) return <div className="p-8 text-center text-muted">Loading…</div>;
  return <>{children}</>;
}

/** The signed-in vessel's name, for the top bar. */
export function VesselName() {
  const worker = useWorker();
  const { vesselsById } = useFleet();
  return <>{(worker?.vesselId && vesselsById[worker.vesselId]?.name) || "Vessel"}</>;
}

/** The vessel this login belongs to. */
export function useMyVesselId(): string {
  return useWorker()?.vesselId ?? "";
}
