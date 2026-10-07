"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { settings } from "@/config/settings";
import { deviceStore, dismissNotice } from "@/lib/device";
import { signOut, useMe } from "@/lib/session";
import { SyncAgent } from "@/lib/sync";
import { SyncStatusBar } from "./SyncStatusBar";

/** Frame for every technician screen: top bar, sync status, messages, and the background sync. */
export function WorkerShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const notices = deviceStore.useValue((d) => d.notices);

  useEffect(() => {
    if (me === null) router.replace("/");
    else if (me?.role === "office") router.replace("/office");
  }, [me, router]);

  if (!me || me.role !== "technician") return null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SyncAgent workerId={me.id} />
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <Link href="/trips" className="flex flex-1 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- small icon file */}
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg ring-1 ring-white/40" />
            <span className="leading-tight">
              <span className="block text-sm opacity-80">{settings.companyName}</span>
              <span className="block font-semibold">{me.name}</span>
            </span>
          </Link>
          <button
            type="button"
            className="min-h-11 rounded-lg px-3 text-sm font-semibold ring-1 ring-white/40"
            onClick={() => {
              signOut();
              router.replace("/");
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <SyncStatusBar workerId={me.id} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4">
        {notices?.map((n) => (
          <div key={n.id} className="mb-3 flex items-start gap-2 rounded-xl border border-brand/20 bg-brand-soft p-3 text-sm text-brand-dark" role="status">
            <span className="flex-1">{n.text}</span>
            <button type="button" className="min-h-8 px-2 font-semibold" onClick={() => dismissNotice(n.id)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        ))}
        {children}
      </main>
    </div>
  );
}
