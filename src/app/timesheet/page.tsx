import { TimesheetScreen } from "@/components/TimesheetEditor";

export default async function TimesheetPage(props: PageProps<"/timesheet">) {
  const { week } = await props.searchParams;
  return <TimesheetScreen weekParam={typeof week === "string" ? week : undefined} />;
}
