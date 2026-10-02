import { AppHeader, DemoBanner } from "@/components/AppHeader";
import { SignOutButton } from "@/components/payroll/RequirePayroll";
import { RequireVessel, VesselName } from "@/components/vessel/RequireVessel";

export default function VesselLayout({ children }: LayoutProps<"/vessel">) {
  return (
    <>
      <AppHeader wide subtitle={<VesselName />} right={<SignOutButton />} />
      <DemoBanner />
      <main className="flex flex-1 flex-col">
        <RequireVessel>{children}</RequireVessel>
      </main>
    </>
  );
}
