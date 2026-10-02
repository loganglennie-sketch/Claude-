"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homePath, useWorker } from "@/lib/demo-auth";
import { useDemoCompany } from "@/lib/demo-company";
import { useHydrated } from "@/lib/demo-store";

/** Sends anyone who isn't signed in to the sign-in screen. */
export function RequireWorker({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const worker = useWorker();
  const router = useRouter();
  const { mode } = useDemoCompany();
  // Vessel logins, and everyone at a vessel-mode company, have their own screens.
  const elsewhere = !!worker && (!!worker.vesselId || mode === "vessel");

  useEffect(() => {
    if (hydrated && !worker) router.replace("/login");
    else if (worker && elsewhere) router.replace(homePath(worker, mode));
  }, [hydrated, worker, router, elsewhere, mode]);

  if (!hydrated || !worker || elsewhere) return <div className="p-8 text-center text-muted">Loading…</div>;
  return <>{children}</>;
}

export function WorkerName() {
  const worker = useWorker();
  return <>{worker ? worker.name : "Timesheets"}</>;
}
