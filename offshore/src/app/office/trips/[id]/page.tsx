import { OfficeTrip } from "@/components/office/OfficeTrip";

export default async function Page({ params }: PageProps<"/office/trips/[id]">) {
  const { id } = await params;
  return <OfficeTrip id={id} />;
}
