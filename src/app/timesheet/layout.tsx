import Link from "next/link";
import { AppHeader, DemoBanner } from "@/components/AppHeader";

export default function WorkerLayout({ children }: LayoutProps<"/timesheet">) {
  return (
    <>
      <AppHeader
        right={
          <Link href="/timesheet/history" className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">
            Past weeks
          </Link>
        }
      />
      <DemoBanner />
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
