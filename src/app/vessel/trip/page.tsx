import { TripScreen } from "@/components/vessel/TripScreen";

export default async function TripPage(props: PageProps<"/vessel/trip">) {
  const { id } = await props.searchParams;
  return <TripScreen tripId={typeof id === "string" ? id : ""} />;
}
