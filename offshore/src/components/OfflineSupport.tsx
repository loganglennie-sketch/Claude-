"use client";

import { useEffect } from "react";

/** Lets the app open with no signal once it has been opened before (see public/sw.js). */
export function OfflineSupport() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return; // keeps development simple
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not supported here: the app still works, just not opened from cold with no signal.
    });
  }, []);
  return null;
}
