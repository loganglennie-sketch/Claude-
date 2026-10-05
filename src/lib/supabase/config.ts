/**
 * Supabase connection settings, read from environment variables (never written in code).
 * When they aren't set, the app runs as the on-device demo.
 */
export function supabasePublicConfig(): { url: string; publishableKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}
