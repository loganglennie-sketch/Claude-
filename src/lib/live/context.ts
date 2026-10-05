import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { supabasePublicConfig } from "@/lib/supabase/config";
import { createServerAdminClient, createUserClient } from "@/lib/supabase/server";

export type LiveCompany = {
  id: string;
  name: string;
  slug: string;
  entry_mode: "times" | "hours-or-times";
  show_overtime: boolean;
};
export type LiveUser = {
  id: string;
  fullName: string;
  role: "super_admin" | "company_admin" | "worker";
  companyId: string | null;
  /** Worker still on the starting PIN the office gave them: ask them to choose their own. */
  mustChangePin: boolean;
};

type CompanyRow = LiveCompany & { host_keywords: string[] };
// Companies change rarely, so the list is remembered for a minute rather than
// looked up on every page. If the database is slow or down, give up quickly.
let companyCache: { at: number; rows: CompanyRow[] } | null = null;
const CACHE_MS = 60_000;
const LOOKUP_TIMEOUT_MS = 2_500;

/** Call after adding or changing a company so its web address works straight away. */
export function forgetCompanies() {
  companyCache = null;
}

async function activeCompanies(): Promise<CompanyRow[]> {
  if (companyCache && Date.now() - companyCache.at < CACHE_MS) return companyCache.rows;
  try {
    const { data, error } = await createServerAdminClient()
      .from("companies")
      .select("id, name, slug, entry_mode, show_overtime, host_keywords")
      .eq("active", true)
      .abortSignal(AbortSignal.timeout(LOOKUP_TIMEOUT_MS));
    if (error || !data) throw error ?? new Error("no data");
    companyCache = { at: Date.now(), rows: data as CompanyRow[] };
  } catch {
    // Keep using the last good list if there is one (otherwise behave as the demo),
    // and don't try again for 10 seconds so pages stay quick.
    companyCache = { rows: companyCache?.rows ?? [], at: Date.now() - CACHE_MS + 10_000 };
  }
  return companyCache.rows;
}

/**
 * The company this web address belongs to, if it has been set up in the
 * database. No company (or no database settings) means the on-device demo.
 */
export const getLiveCompany = cache(async (): Promise<LiveCompany | null> => {
  if (!supabasePublicConfig() || !process.env.SUPABASE_SECRET_KEY) return null;
  const host = ((await headers()).get("host") ?? "").toLowerCase().split(":")[0];
  if (!host) return null;
  const match = (await activeCompanies()).find((c) => c.host_keywords.some((k) => k && host.includes(k.toLowerCase())));
  return match ? { id: match.id, name: match.name, slug: match.slug, entry_mode: match.entry_mode, show_overtime: match.show_overtime } : null;
});

/** Who is signed in (through the security rules), or null. */
export const getLiveUser = cache(async (): Promise<LiveUser | null> => {
  if (!supabasePublicConfig()) return null;
  try {
    const supabase = await createUserClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data } = await supabase.from("users").select("id, full_name, role, company_id").eq("auth_user_id", auth.user.id).eq("active", true).maybeSingle();
    if (!data) return null;
    let mustChangePin = false;
    if (data.role === "worker") {
      // Separate query: if the database update adding this hasn't been run yet, everything else still works.
      const { data: pin } = await supabase.from("users").select("pin_must_change").eq("id", data.id).maybeSingle();
      mustChangePin = !!pin?.pin_must_change;
    }
    return { id: data.id, fullName: data.full_name, role: data.role, companyId: data.company_id, mustChangePin };
  } catch {
    return null;
  }
});
