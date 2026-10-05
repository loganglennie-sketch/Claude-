import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SuperDashboard, type CompanySummary } from "@/components/super/SuperDashboard";
import { getLiveUser } from "@/lib/live/context";
import { createUserClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Super admin" };

/** The owner's page: every customer company and how many active workers each is paying for. */
export default async function SuperAdminPage() {
  const me = await getLiveUser();
  if (me?.role !== "super_admin") redirect("/office");

  const supabase = await createUserClient();
  const [{ data: summary, error }, { data: companies }] = await Promise.all([
    supabase.rpc("super_admin_companies"),
    supabase.from("companies").select("id, host_keywords, entry_mode, payroll_email"),
  ]);
  const extra = new Map((companies ?? []).map((c) => [c.id as string, c]));
  const rows: CompanySummary[] = ((summary ?? []) as Omit<CompanySummary, "hostKeywords" | "entryMode">[]).map((r) => ({
    ...r,
    hostKeywords: extra.get(r.company_id)?.host_keywords ?? [],
    entryMode: extra.get(r.company_id)?.entry_mode ?? "times",
  }));

  return <SuperDashboard rows={rows} loadError={!!error} />;
}
