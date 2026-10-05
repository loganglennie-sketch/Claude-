"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_LOGINS, signIn, useWorker } from "@/lib/demo-auth";
import { useCompanyName, useDemoCompany } from "@/lib/demo-company";
import { useAppMode } from "@/lib/app-mode";
import { signInWithPin } from "@/app/actions/auth";
import Link from "next/link";
import { Button } from "./ui";
import { ChoosePinForm } from "./ChoosePin";

export const PIN_LENGTH = 4;

export function LoginScreen() {
  const router = useRouter();
  const worker = useWorker();
  const companyName = useCompanyName();
  const company = useDemoCompany();
  // A logo with the name built in replaces the heading, unless a demo link has swapped the name.
  const showFullLogo = company.logoIncludesName && companyName === company.companyName;
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Signed in with the starting PIN from the office: choose their own before carrying on.
  const [choosePin, setChoosePin] = useState<{ pin: string; redirectTo: string } | null>(null);
  const { live } = useAppMode();

  useEffect(() => {
    if (worker && !choosePin) router.replace(worker.payroll ? "/payroll" : "/timesheet");
  }, [worker, router, choosePin]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!live) {
      const result = signIn(name, pin);
      if (!result.ok) {
        setError(result.error);
        setPin("");
      }
      return;
    }
    // Live: the PIN is checked on the server, never on the phone.
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithPin(name, pin);
      if (result.ok && result.mustChangePin) {
        setChoosePin({ pin, redirectTo: result.redirectTo });
        return;
      }
      if (result.ok) {
        router.replace(result.redirectTo);
        router.refresh(); // reload who's signed in from the server
        return;
      }
      setError(result.error);
      setPin("");
    } catch {
      setError("Couldn't reach the server. Check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (choosePin) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
        <ChoosePinForm
          currentPin={choosePin.pin}
          forced
          onDone={() => {
            router.replace(choosePin.redirectTo);
            router.refresh();
          }}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        {/* eslint-disable @next/next/no-img-element -- small logo files, no resizing needed */}
        {showFullLogo ? (
          <img src={company.logoPath} alt="" className="mx-auto max-h-36 w-full max-w-72 object-contain" />
        ) : (
          <img src={company.iconPath} alt="" width={72} height={72} className="mx-auto h-18 w-18 rounded-2xl object-contain" />
        )}
        {/* eslint-enable @next/next/no-img-element */}
        <h1 className={showFullLogo ? "sr-only" : "mt-4 text-2xl font-bold"}>{companyName}</h1>
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

        <Button type="submit" disabled={busy || !name.trim() || pin.length !== PIN_LENGTH}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">Forgotten your PIN? Ask the office to reset it.</p>
      {live ? (
        <Link href="/office" className="mt-4 min-h-11 text-center text-sm font-semibold text-brand underline-offset-4 hover:underline">
          Office staff sign in
        </Link>
      ) : (
        <div className="mt-6 space-y-1 rounded-xl bg-brand-soft p-3 text-center text-sm text-brand-dark">
          <div className="font-semibold">Try the demo</div>
          {DEMO_LOGINS.map((l) => (
            <div key={l.name}>
              {l.payroll ? "Office / payroll" : "Worker"}: <strong>{l.name}</strong>, PIN <strong>{l.pin}</strong>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
