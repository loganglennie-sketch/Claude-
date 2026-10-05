"use client";

import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser connection as the signed-in person (security rules always apply). */
export function browserClient(url: string, publishableKey: string) {
  client ??= createBrowserClient(url, publishableKey);
  return client;
}
