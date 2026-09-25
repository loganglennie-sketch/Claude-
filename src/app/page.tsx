import { redirect } from "next/navigation";

export default async function Home(props: PageProps<"/">) {
  // Keep anything after "?" (e.g. a demo ?company= link) when moving on.
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await props.searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const query = params.toString();
  redirect(query ? `/timesheet?${query}` : "/timesheet");
}
