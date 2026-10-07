"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { settings } from "@/config/settings";
import { serverStore, signIn } from "@/lib/demo-server";
import { DEMO_OFFICE, DEMO_TECH_PIN } from "@/lib/demo-data";
import { sessionStore, useMe } from "@/lib/session";
import { useHydrated } from "@/lib/local-store";
import { Button, inputClass } from "./ui";

const PIN_LENGTH = 4;

export function LoginScreen() {
  const router = useRouter();
  const me = useMe();
  const hydrated = useHydrated();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me) router.replace(me.role === "office" ? "/office" : "/trips");
  }, [me, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const person = await signIn(name, pin);
      if (!person) {
        // Same message whether the name or the PIN was wrong, so nobody can find out who works here by guessing.
        setError("That name and PIN don't match. Check them and try again.");
        setPin("");
        return;
      }
      sessionStore.set(person);
    } finally {
      setBusy(false);
    }
  }

  const technicians = hydrated ? serverStore.get().people.filter((p) => p.role === "technician") : [];

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- small icon file */}
        <img src="/icon.svg" alt="" width={72} height={72} className="mx-auto h-18 w-18" />
        <h1 className="mt-4 text-2xl font-bold">{settings.companyName}</h1>
        <p className="text-muted">Offshore trip timesheets</p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block font-medium">Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            autoCapitalize="words"
            placeholder="First and last name"
            required
            className={`${inputClass} min-h-14 text-lg`}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-medium">PIN</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="current-password"
            maxLength={PIN_LENGTH}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
            placeholder={"•".repeat(PIN_LENGTH)}
            required
            className={`${inputClass} min-h-16 text-center text-3xl tracking-[0.6em]`}
          />
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full min-h-14 text-lg" disabled={busy || !name.trim() || pin.length !== PIN_LENGTH}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">Sign in once with signal. After that the app works offshore with no signal.</p>

      <div className="mt-6 rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
        <div className="mb-1 font-semibold">Try the demo: tap a name</div>
        <p className="mb-2 text-xs">Technicians use PIN {DEMO_TECH_PIN}. The office uses PIN {DEMO_OFFICE.pin}.</p>
        <div className="flex flex-wrap gap-1.5">
          {[...technicians.map((t) => ({ name: t.name, pin: DEMO_TECH_PIN })), { name: DEMO_OFFICE.name, pin: DEMO_OFFICE.pin }].map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => {
                setName(p.name);
                setPin(p.pin);
              }}
              className="min-h-9 rounded-full border border-brand/30 bg-white px-3 text-xs font-semibold"
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs">Aisha Bello has a queried trip. Priya Shah is offshore now.</p>
      </div>
    </main>
  );
}
