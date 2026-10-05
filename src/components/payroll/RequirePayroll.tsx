"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { signOut, useWorker } from "@/lib/demo-auth";
import { useAppMode } from "@/lib/app-mode";
import { useHydrated } from "@/lib/demo-store";

/** Only payroll users get in; everyone else goes to sign-in or their own timesheet. */
export function RequirePayroll({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const worker = useWorker();
  const router = useRouter();
  const allowed = !!worker?.payroll;

  useEffect(() => {
    if (!hydrated) return;
    if (!worker) router.replace("/login");
    else if (!worker.payroll) router.replace("/timesheet");
  }, [hydrated, worker, router]);

  if (!hydrated || !allowed) return <div className="p-8 text-center text-muted">Loading…</div>;
  return <>{children}</>;
}

export function SignOutButton() {
  const { live } = useAppMode();
  const router = useRouter();
  return (
    <button type="button" onClick={async () => {
          await signOut(live);
          if (live) {
            router.replace("/login");
            router.refresh();
          }
        }} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">
      Sign out
    </button>
  );
}
