import { ReviewScreen } from "@/components/ReviewScreen";

export default async function ReviewPage(props: PageProps<"/timesheet/review">) {
  const { week } = await props.searchParams;
  return <ReviewScreen weekParam={typeof week === "string" ? week : undefined} />;
}
