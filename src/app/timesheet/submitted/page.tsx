import { SubmittedScreen } from "@/components/SubmittedScreen";

export default async function SubmittedPage(props: PageProps<"/timesheet/submitted">) {
  const { week } = await props.searchParams;
  return <SubmittedScreen weekParam={typeof week === "string" ? week : undefined} />;
}
