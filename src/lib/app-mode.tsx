"use client";

/**
 * Tells the screens whether this web address is LIVE (company set up in the
 * database) or the on-device DEMO, and who is signed in when live.
 */
import { createContext, useContext } from "react";
import type { LiveCompany, LiveUser } from "@/lib/live/context";

export type AppMode = {
  live: boolean;
  company: LiveCompany | null;
  me: LiveUser | null;
  supabase: { url: string; publishableKey: string } | null;
};

const DEMO: AppMode = { live: false, company: null, me: null, supabase: null };
const AppModeContext = createContext<AppMode>(DEMO);

export function AppModeProvider({ value, children }: { value: AppMode; children: React.ReactNode }) {
  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export const useAppMode = () => useContext(AppModeContext);
