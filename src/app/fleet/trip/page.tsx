import { OfficeTripReview } from "@/components/fleet/OfficeTripReview";

export default async function OfficeTripPage(props: PageProps<"/fleet/trip">) {
  const { id } = await props.searchParams;
  return <OfficeTripReview tripId={typeof id === "string" ? id : ""} />;
}
