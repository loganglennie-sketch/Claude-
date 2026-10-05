"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useWorker } from "@/lib/demo-auth";
import { useHydrated } from "@/lib/demo-store";
import { useAppMode } from "@/lib/app-mode";

/** Sends anyone who isn't signed in to the sign-in screen. */
export function RequireWorker({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const worker = useWorker();
  const router = useRouter();
  const { live, me } = useAppMode();
  // Live: office staff don't have timesheets here; send them to their own pages.
  const pathname = usePathname();
  const elsewhere =
    live && me && me.role !== "worker"
      ? me.role === "super_admin"
        ? "/super"
        : "/payroll"
      : // Still on the starting PIN the office gave out: choose their own first.
        live && me?.mustChangePin && pathname !== "/timesheet/pin"
        ? "/timesheet/pin"
        : null;

  useEffect(() => {
    if (hydrated && !worker) router.replace("/login");
    else if (elsewhere) router.replace(elsewhere);
  }, [hydrated, worker, router, elsewhere]);

  if (!hydrated || !worker || elsewhere) return <div className="p-8 text-center text-muted">Loading…</div>;
  return <>{children}</>;
}

export function WorkerName() {
  const worker = useWorker();
  return <>{worker ? worker.name : "Timesheets"}</>;
}
