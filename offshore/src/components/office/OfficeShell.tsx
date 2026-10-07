"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { settings } from "@/config/settings";
import { resetDemo } from "@/lib/demo-server";
import { signOut, useMe } from "@/lib/session";

export function OfficeShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (me === null) router.replace("/");
    else if (me?.role === "technician") router.replace("/trips");
  }, [me, router]);

  if (!me || me.role !== "office") return null;

  const tab = (href: string, label: string) => {
    const active = href === "/office" ? path === "/office" || path.startsWith("/office/trips") : path.startsWith(href);
    return (
      <Link href={href} className={`min-h-10 rounded-lg px-3 py-2 text-sm font-semibold ${active ? "bg-white text-brand" : "text-white/90 hover:bg-white/10"}`}>
        {label}
      </Link>
    );
  };

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="no-print bg-brand text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex flex-1 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- small icon file */}
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg ring-1 ring-white/40" />
            <div className="leading-tight">
              <div className="font-semibold">{settings.companyName}</div>
              <div className="text-sm opacity-80">Office</div>
            </div>
          </div>
          <nav className="flex gap-1">
            {tab("/office", "Trips")}
            {tab("/office/export", "Exports")}
          </nav>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              className="min-h-10 rounded-lg px-3 ring-1 ring-white/40"
              onClick={() => {
                if (window.confirm("Put the demo back to how it started? Everything you've changed in the demo is undone.")) resetDemo();
              }}
            >
              Reset demo
            </button>
            <button
              type="button"
              className="min-h-10 rounded-lg px-3 font-semibold ring-1 ring-white/40"
              onClick={() => {
                signOut();
                router.replace("/");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
