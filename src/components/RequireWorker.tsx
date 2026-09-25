"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useWorker } from "@/lib/demo-auth";
import { useHydrated } from "@/lib/demo-store";

/** Sends anyone who isn't signed in to the sign-in screen. */
export function RequireWorker({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const worker = useWorker();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !worker) router.replace("/login");
  }, [hydrated, worker, router]);

  if (!hydrated || !worker) return <div className="p-8 text-center text-muted">Loading…</div>;
  return <>{children}</>;
}

export function WorkerName() {
  const worker = useWorker();
  return <>{worker ? worker.name : "Timesheets"}</>;
}
