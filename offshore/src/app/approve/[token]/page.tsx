import type { Metadata } from "next";
import { ApprovePage } from "@/components/supervisor/ApprovePage";

export const metadata: Metadata = {
  title: "Approve timesheet",
  // A private link: keep it out of search engines and don't pass it on to other sites.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ params }: PageProps<"/approve/[token]">) {
  const { token } = await params;
  return <ApprovePage token={token} />;
}
