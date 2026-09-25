import Link from "next/link";
import { brand } from "@/config/brand";

export function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-brand text-white shadow-sm">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
        <Link href="/timesheet" className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logoPath} alt="" width={36} height={36} className="h-9 w-9 rounded-lg bg-white/10" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-base font-semibold">{brand.companyName}</div>
            <div className="text-xs text-white/75">Timesheets</div>
          </div>
        </Link>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}

export function DemoBanner() {
  return (
    <div className="bg-brand-soft text-center text-xs text-brand-dark px-4 py-2">
      Demo mode — saved on this device only. Sign-in and payroll emails come in the next stages.
    </div>
  );
}
