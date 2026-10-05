import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "./config";

/** Acts as the signed-in person: every query goes through the database's security rules. */
export async function createUserClient() {
  const config = supabasePublicConfig();
  if (!config) throw new Error("Supabase is not configured");
  const cookieStore = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a page render (cookies are read-only there); the proxy refreshes them instead.
        }
      },
    },
  });
}

/**
 * Uses the SECRET key. Server only, and only for things the security rules
 * deliberately leave to the server: checking PINs and creating sign-in accounts.
 */
export function createServerAdminClient() {
  const config = supabasePublicConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secret) throw new Error("Supabase secret key is not configured");
  return createSupabaseClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
