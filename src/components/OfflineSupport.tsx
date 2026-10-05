"use client";

import { useEffect } from "react";
import { useAppMode } from "@/lib/app-mode";

/** Live company addresses: lets the app open with no signal (see public/sw.js). The demo doesn't use it. */
export function OfflineSupport() {
  const { live } = useAppMode();
  useEffect(() => {
    if (!live || !("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not supported here: the app still works, just not without signal.
    });
  }, [live]);
  return null;
}

/** Signing out: remove saved copies of pages (they show who was signed in). */
export async function forgetSavedPages() {
  try {
    if ("caches" in window) for (const key of await caches.keys()) if (key.startsWith("pages-")) await caches.delete(key);
  } catch {
    // nothing saved
  }
}
