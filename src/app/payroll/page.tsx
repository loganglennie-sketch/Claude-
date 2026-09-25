import { PayrollDashboard } from "@/components/payroll/PayrollDashboard";

export default async function PayrollPage(props: PageProps<"/payroll">) {
  const { week } = await props.searchParams;
  return <PayrollDashboard weekParam={typeof week === "string" ? week : undefined} />;
}
