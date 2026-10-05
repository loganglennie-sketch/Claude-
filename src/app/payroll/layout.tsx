import { AppHeader, DemoBanner } from "@/components/AppHeader";
import { PayrollNav, RequirePayroll, SignOutButton } from "@/components/payroll/RequirePayroll";

export default function PayrollLayout({ children }: LayoutProps<"/payroll">) {
  return (
    <>
      <AppHeader wide subtitle="Payroll" right={
          <>
            <PayrollNav />
            <SignOutButton />
          </>
        } />
      <DemoBanner />
      <main className="flex flex-1 flex-col">
        <RequirePayroll>{children}</RequirePayroll>
      </main>
    </>
  );
}
