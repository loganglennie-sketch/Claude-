import Link from "next/link";
import { AppHeader, DemoBanner } from "@/components/AppHeader";
import { RequirePayroll, SignOutButton } from "@/components/payroll/RequirePayroll";

export default function FleetLayout({ children }: LayoutProps<"/fleet">) {
  return (
    <>
      <AppHeader
        wide
        subtitle="Office"
        right={
          <>
            <Link href="/fleet" className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">
              Fleet
            </Link>
            <Link href="/fleet/personnel" className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">
              Personnel
            </Link>
            <SignOutButton />
          </>
        }
      />
      <DemoBanner />
      <main className="flex flex-1 flex-col">
        <RequirePayroll>{children}</RequirePayroll>
      </main>
    </>
  );
}
