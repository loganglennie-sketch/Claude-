"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithEmail } from "@/app/actions/auth";
import { useCompanyName, useDemoCompany } from "@/lib/demo-company";
import { Button } from "./ui";

/** Email + password sign-in for office admins and the super admin. */
export function OfficeLoginScreen() {
  const router = useRouter();
  const companyName = useCompanyName();
  const company = useDemoCompany();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithEmail(email, password);
      if (result.ok) {
        router.replace(result.redirectTo);
        router.refresh(); // reload who's signed in from the server
        return;
      }
      setError(result.error);
      setPassword("");
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "min-h-14 w-full rounded-xl border-2 border-line bg-surface px-4 text-lg placeholder:text-muted/60 focus:border-brand focus:outline-none";
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- small logo file */}
        <img src={company.iconPath} alt="" width={72} height={72} className="mx-auto h-18 w-18 rounded-2xl object-contain" />
        <h1 className="mt-4 text-2xl font-bold">{companyName}</h1>
        <p className="text-muted">Office sign in</p>
      </div>
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block font-medium">Email</span>
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-medium">Password</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !email.trim() || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <Link href="/login" className="mt-4 min-h-11 text-center text-sm font-semibold text-brand underline-offset-4 hover:underline">
        Worker sign in (name and PIN)
      </Link>
    </main>
  );
}
