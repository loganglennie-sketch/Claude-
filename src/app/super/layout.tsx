import { SuperSignOut } from "@/components/super/SuperDashboard";

export default function SuperAdminLayout({ children }: LayoutProps<"/super">) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b-4 border-accent bg-brand text-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="leading-tight">
            <div className="text-base font-semibold">Timesheets</div>
            <div className="text-xs text-white/75">Super admin</div>
          </div>
          <div className="ml-auto">
            <SuperSignOut />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
