"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { changeOwnPin } from "@/app/actions/auth";
import { Button, ButtonLink } from "./ui";

const PIN_LENGTH = 4;
const pinInput =
  "min-h-16 w-full rounded-xl border-2 border-line bg-surface px-4 text-center text-3xl tracking-[0.6em] placeholder:text-muted/40 focus:border-brand focus:outline-none";

/** Same rule as the database: no 1111-style or 1234-style PINs. */
const tooEasy = (pin: string) => /^(\d)\1{3}$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin);

function PinBox({ label, value, onChange, autoFocus }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-medium">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="new-password"
        maxLength={PIN_LENGTH}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
        placeholder={"•".repeat(PIN_LENGTH)}
        required
        className={pinInput}
      />
    </label>
  );
}

/**
 * The worker picks their own 4-digit PIN. Straight after signing in the PIN
 * they just typed is passed in; otherwise they confirm their current one.
 */
export function ChoosePinForm({ currentPin: knownPin, forced, onDone }: { currentPin?: string; forced: boolean; onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin.length !== PIN_LENGTH) return setError("Your PIN must be exactly 4 numbers.");
    if (pin !== again) {
      setAgain("");
      return setError("The two PINs don't match. Type your new PIN again.");
    }
    if (tooEasy(pin)) return setError("That PIN is too easy to guess (like 1234 or 1111). Choose another.");
    setBusy(true);
    try {
      const result = await changeOwnPin(knownPin ?? current, pin);
      if (result.ok) return onDone();
      setError(result.error);
    } catch {
      setError("Couldn't reach the server. Check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="text-center">
        <h1 className="text-2xl font-bold">{forced ? "Choose your own PIN" : "Change your PIN"}</h1>
        <p className="mt-1 text-muted">
          {forced
            ? "Pick 4 numbers you'll remember. You'll use this PIN from now on instead of the one you were given."
            : "Pick 4 numbers you'll remember."}
        </p>
      </div>
      {!knownPin && <PinBox label="Your current PIN" value={current} onChange={setCurrent} autoFocus />}
      <PinBox label="New PIN" value={pin} onChange={setPin} autoFocus={!!knownPin} />
      <PinBox label="Type it again" value={again} onChange={setAgain} />
      <p className="text-sm text-muted">Don&apos;t use easy ones like 1234 or 1111, and don&apos;t share it with anyone.</p>
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || pin.length !== PIN_LENGTH || again.length !== PIN_LENGTH || (!knownPin && current.length !== PIN_LENGTH)}>
        {busy ? "Saving…" : "Save my PIN"}
      </Button>
      {!forced && (
        <ButtonLink href="/timesheet/history" variant="ghost">
          Cancel
        </ButtonLink>
      )}
    </form>
  );
}

/** /timesheet/pin: asked to choose a PIN (still on the starting one), or changing it from Past weeks. */
export function ChoosePinScreen({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  if (saved) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-5 px-6 py-10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand text-4xl text-white" aria-hidden>
          ✓
        </div>
        <h1 className="text-2xl font-bold">PIN saved</h1>
        <p className="text-muted">Use your new PIN next time you sign in.</p>
        <ButtonLink href="/timesheet">Go to my timesheet</ButtonLink>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-sm px-6 py-8">
      <ChoosePinForm
        forced={forced}
        onDone={() => {
          setSaved(true);
          router.refresh(); // so the app knows the PIN has been chosen
        }}
      />
    </div>
  );
}
