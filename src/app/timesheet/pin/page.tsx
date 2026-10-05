import { ChoosePinScreen } from "@/components/ChoosePin";
import { getLiveUser } from "@/lib/live/context";

export default async function ChoosePinPage() {
  const me = await getLiveUser();
  return <ChoosePinScreen forced={!!me?.mustChangePin} />;
}
