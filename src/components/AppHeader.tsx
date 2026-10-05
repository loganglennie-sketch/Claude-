"use client";

import { useAppMode } from "@/lib/app-mode";
import { CompanyIcon, CompanyName } from "@/lib/demo-company";

export function AppHeader({ right, subtitle = "Timesheets", wide = false }: { right?: React.ReactNode; subtitle?: React.ReactNode; wide?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b-4 border-accent bg-brand text-white shadow-sm">
      <div className={`mx-auto flex items-center gap-3 px-4 py-3 ${wide ? "max-w-6xl" : "max-w-xl"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <CompanyIcon className="h-10 w-10 rounded-xl bg-white object-contain p-1" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-base font-semibold">
              <CompanyName />
            </div>
            <div className="truncate text-xs text-white/75">{subtitle}</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

export function DemoBanner() {
  // Live company addresses use real data, so no banner there.
  if (useAppMode().live) return null;
  return (
    <div className="bg-brand-soft text-center text-xs text-brand-dark px-4 py-2">
      Demo mode — made-up data, saved on this device only. No emails are sent.
    </div>
  );
}
