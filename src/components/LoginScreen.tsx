"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { DEMO_LOGINS, signIn, useWorker } from "@/lib/demo-auth";
import { useCompanyName } from "@/lib/demo-company";
import { Button } from "./ui";

export const PIN_LENGTH = 4;

export function LoginScreen() {
  const router = useRouter();
  const worker = useWorker();
  const companyName = useCompanyName();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (worker) router.replace(worker.payroll ? "/payroll" : "/timesheet");
  }, [worker, router]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = signIn(name, pin);
    if (!result.ok) {
      setError(result.error);
      setPin("");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.logoPath} alt="" width={72} height={72} className="mx-auto h-18 w-18 rounded-2xl" />
        <h1 className="mt-4 text-2xl font-bold">{companyName}</h1>
        <p className="text-muted">Sign in to fill in your timesheet</p>
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
            className="min-h-14 w-full rounded-xl border-2 border-line bg-surface px-4 text-lg placeholder:text-muted/60 focus:border-brand focus:outline-none"
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
            className="min-h-16 w-full rounded-xl border-2 border-line bg-surface px-4 text-center text-3xl tracking-[0.6em] placeholder:text-muted/40 focus:border-brand focus:outline-none"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <Button type="submit" disabled={!name.trim() || pin.length !== PIN_LENGTH}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">Forgotten your PIN? Ask the office to reset it.</p>
      <div className="mt-6 space-y-1 rounded-xl bg-brand-soft p-3 text-center text-sm text-brand-dark">
        <div className="font-semibold">Try the demo</div>
        {DEMO_LOGINS.map((l) => (
          <div key={l.name}>
            {l.payroll ? "Office / payroll" : "Worker"}: <strong>{l.name}</strong>, PIN <strong>{l.pin}</strong>
          </div>
        ))}
      </div>
    </main>
  );
}
