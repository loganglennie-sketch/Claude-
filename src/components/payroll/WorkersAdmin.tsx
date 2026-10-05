"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppMode } from "@/lib/app-mode";
import { browserClient } from "@/lib/supabase/browser";
import { Card } from "../ui";

type WorkerRow = {
  id: string;
  full_name: string;
  employee_number: string | null;
  active: boolean;
  locked_until: string | null;
  last_sign_in_at: string | null;
  deactivated_at: string | null;
  /** Still on the starting PIN from the office (they choose their own at first sign-in). */
  pin_must_change?: boolean;
};
type Panel = { id: string; kind: "pin" | "rename" | "leave" } | null;

const input =
  "min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3 text-base placeholder:text-muted/60 focus:border-brand focus:outline-none";
const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

/** A random 4-digit PIN, avoiding the easy-to-guess ones. */
function suggestPin(): string {
  const weak = /^(\d)\1{3}$|^(0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)$/;
  let pin = "";
  do pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10_000).padStart(4, "0");
  while (weak.test(pin));
  return pin;
}

const cleanError = (message: string) => message || "Something went wrong. Please try again.";

export function WorkersAdmin() {
  const mode = useAppMode();
  const db = mode.supabase ? browserClient(mode.supabase.url, mode.supabase.publishableKey) : null;
  const [workers, setWorkers] = useState<WorkerRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [showLeavers, setShowLeavers] = useState(false);

  const load = useCallback(async () => {
    if (!db) return;
    const columns = "id, full_name, employee_number, active, locked_until, last_sign_in_at, deactivated_at";
    let { data, error } = await db.from("users").select(`${columns}, pin_must_change`).eq("role", "worker").order("full_name");
    // Before the "workers choose their own PIN" database update, that column isn't there yet.
    if (error) ({ data, error } = await db.from("users").select(columns).eq("role", "worker").order("full_name"));
    setLoadError(!!error);
    if (!error) setWorkers(data as WorkerRow[]);
  }, [db]);

  useEffect(() => {
    // Loading from the database (not setting state from props), so this is fine here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function call(fn: string, args: Record<string, unknown>, success: string): Promise<boolean> {
    if (!db) return false;
    setNotice(null);
    const { error } = await db.rpc(fn, args);
    if (error) {
      setNotice({ ok: false, text: cleanError(error.message) });
      return false;
    }
    setNotice({ ok: true, text: success });
    setPanel(null);
    await load();
    return true;
  }

  if (!mode.live) {
    return (
      <Page>
        <Card>
          <p>In the live app, office admins add workers, set and reset their PINs, unlock accounts and mark leavers here. The demo uses a made-up team, so there&apos;s nothing to manage.</p>
        </Card>
      </Page>
    );
  }
  if (loadError) return <Page><p className="text-danger">Couldn&apos;t load your workers. Check your signal and refresh the page.</p></Page>;
  if (!workers) return <Page><p className="text-muted">Loading…</p></Page>;

  const active = workers.filter((w) => w.active);
  const leavers = workers.filter((w) => !w.active);

  return (
    <Page>
      <p className="text-muted">
        {active.length} active {active.length === 1 ? "worker" : "workers"}
        {leavers.length > 0 && ` · ${leavers.length} left`}
      </p>
      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={`rounded-xl p-3 text-sm font-medium ${notice.ok ? "bg-brand-soft text-brand-dark" : "bg-danger/10 text-danger"}`}>
          {notice.text}
        </p>
      )}

      <AddWorker onAdd={(name, pin, emp) => call("admin_add_worker", { p_full_name: name, p_pin: pin, p_employee_number: emp || null }, `${name.trim()} added. Their starting PIN is ${pin}: give it to them in person. They'll choose their own PIN the first time they sign in.`)} />

      <ul className="space-y-3">
        {active.map((w) => (
          <WorkerCard key={w.id} worker={w} panel={panel?.id === w.id ? panel.kind : null} setPanel={(kind) => setPanel(kind ? { id: w.id, kind } : null)} call={call} />
        ))}
      </ul>

      {leavers.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowLeavers(!showLeavers)} className="min-h-11 font-semibold text-brand">
            {showLeavers ? "Hide" : "Show"} people who have left ({leavers.length})
          </button>
          {showLeavers && (
            <ul className="mt-2 space-y-3">
              {leavers.map((w) => (
                <WorkerCard key={w.id} worker={w} panel={null} setPanel={() => {}} call={call} />
              ))}
            </ul>
          )}
        </div>
      )}

      <ChangePassword />
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-12 pt-5">
      <h1 className="text-2xl font-bold">Workers</h1>
      {children}
    </div>
  );
}

function AddWorker({ onAdd }: { onAdd: (name: string, pin: string, emp: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emp, setEmp] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => { setPin(suggestPin()); setOpen(true); }} className="min-h-14 w-full rounded-2xl bg-brand px-5 text-lg font-semibold text-white">
        + Add a worker
      </button>
    );
  }
  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await onAdd(name, pin, emp);
          setBusy(false);
          if (ok) {
            setName("");
            setEmp("");
            setOpen(false);
          }
        }}
      >
        <h2 className="text-lg font-semibold">Add a worker</h2>
        <label className="block">
          <span className="mb-1 block font-medium">Full name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoCapitalize="words" autoComplete="off" className={input} />
          <span className="mt-1 block text-xs text-muted">What they&apos;ll type to sign in. Two people with the same name? Add a middle name or a number, e.g. &quot;John Smith 2&quot;.</span>
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Employee number (optional)</span>
          <input value={emp} onChange={(e) => setEmp(e.target.value)} autoComplete="off" className={input} />
        </label>
        <PinField pin={pin} setPin={setPin} />
        <div className="flex gap-2">
          <SmallButton type="submit" primary disabled={busy || name.trim().length < 2 || pin.length !== 4}>
            {busy ? "Adding…" : "Add worker"}
          </SmallButton>
          <SmallButton onClick={() => setOpen(false)}>Cancel</SmallButton>
        </div>
      </form>
    </Card>
  );
}

function PinField({ pin, setPin }: { pin: string; setPin: (p: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium">PIN</span>
      <div className="flex gap-2">
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          autoComplete="off"
          className={`${input} max-w-36 text-center font-mono text-xl tracking-[0.4em]`}
        />
        <SmallButton onClick={() => setPin(suggestPin())}>New random PIN</SmallButton>
      </div>
      <span className="mt-1 block text-xs text-muted">A starting PIN: give it to them in person. They choose their own when they first sign in, and it can&apos;t be looked up, only reset.</span>
    </label>
  );
}

function WorkerCard({
  worker: w,
  panel,
  setPanel,
  call,
}: {
  worker: WorkerRow;
  panel: "pin" | "rename" | "leave" | null;
  setPanel: (kind: "pin" | "rename" | "leave" | null) => void;
  call: (fn: string, args: Record<string, unknown>, success: string) => Promise<boolean>;
}) {
  const [pin, setPin] = useState("");
  const [name, setName] = useState(w.full_name);
  const [busy, setBusy] = useState(false);
  const locked = !!w.locked_until && new Date(w.locked_until) > new Date();
  const run = async (fn: string, args: Record<string, unknown>, success: string) => {
    setBusy(true);
    await call(fn, args, success);
    setBusy(false);
  };

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold">{w.full_name}</div>
            <div className="text-sm text-muted">
              {w.employee_number ? `No. ${w.employee_number} · ` : ""}
              {!w.active
                ? `Left ${w.deactivated_at ? shortDate.format(new Date(w.deactivated_at)) : ""}`
                : w.last_sign_in_at
                  ? `Last signed in ${shortDate.format(new Date(w.last_sign_in_at))}`
                  : "Not signed in yet"}
            </div>
          </div>
          {w.active && w.pin_must_change && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Starting PIN</span>
          )}
          {locked && <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">Locked until {clock.format(new Date(w.locked_until!))}</span>}
        </div>

        {panel === "pin" && (
          <div className="mt-3 space-y-2 rounded-xl bg-brand-soft/60 p-3">
            <PinField pin={pin} setPin={setPin} />
            <div className="flex gap-2">
              <SmallButton primary disabled={busy || pin.length !== 4} onClick={() => run("admin_reset_pin", { p_user_id: w.id, p_new_pin: pin }, `${w.full_name}'s starting PIN is ${pin}, and their account is unlocked. They'll choose their own PIN when they next sign in.`)}>
                Save new PIN
              </SmallButton>
              <SmallButton onClick={() => setPanel(null)}>Cancel</SmallButton>
            </div>
          </div>
        )}
        {panel === "rename" && (
          <div className="mt-3 space-y-2 rounded-xl bg-brand-soft/60 p-3">
            <label className="block">
              <span className="mb-1 block font-medium">Name they sign in with</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
            </label>
            <div className="flex gap-2">
              <SmallButton primary disabled={busy || name.trim().length < 2} onClick={() => run("admin_rename_worker", { p_user_id: w.id, p_full_name: name }, `Renamed to ${name.trim()}.`)}>
                Save name
              </SmallButton>
              <SmallButton onClick={() => setPanel(null)}>Cancel</SmallButton>
            </div>
          </div>
        )}
        {panel === "leave" && (
          <div className="mt-3 space-y-2 rounded-xl bg-danger/5 p-3">
            <p className="text-sm">{w.full_name} won&apos;t be able to sign in any more. Their past timesheets are kept, and you can bring them back later.</p>
            <div className="flex gap-2">
              <SmallButton danger disabled={busy} onClick={() => run("admin_set_worker_active", { p_user_id: w.id, p_active: false }, `${w.full_name} marked as left.`)}>
                Mark as left
              </SmallButton>
              <SmallButton onClick={() => setPanel(null)}>Cancel</SmallButton>
            </div>
          </div>
        )}

        {!panel && (
          <div className="mt-3 flex flex-wrap gap-2">
            {w.active ? (
              <>
                {locked && (
                  <SmallButton primary disabled={busy} onClick={() => run("admin_unlock", { p_user_id: w.id }, `${w.full_name} can sign in again.`)}>
                    Unlock
                  </SmallButton>
                )}
                <SmallButton onClick={() => { setPin(suggestPin()); setPanel("pin"); }}>Reset PIN</SmallButton>
                <SmallButton onClick={() => { setName(w.full_name); setPanel("rename"); }}>Rename</SmallButton>
                <SmallButton onClick={() => setPanel("leave")}>Mark as left</SmallButton>
              </>
            ) : (
              <SmallButton disabled={busy} onClick={() => run("admin_set_worker_active", { p_user_id: w.id, p_active: true }, `${w.full_name} is active again with their old PIN.`)}>
                Bring back
              </SmallButton>
            )}
          </div>
        )}
      </Card>
    </li>
  );
}

function ChangePassword() {
  const mode = useAppMode();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!mode.supabase) return null;
  const db = browserClient(mode.supabase.url, mode.supabase.publishableKey);

  return (
    <Card>
      <h2 className="text-lg font-semibold">Your password</h2>
      {result && <p className={`mt-2 text-sm font-medium ${result.ok ? "text-brand-dark" : "text-danger"}`}>{result.text}</p>}
      {open ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const { error } = await db.auth.updateUser({ password });
            setBusy(false);
            setResult(error ? { ok: false, text: cleanError(error.message) } : { ok: true, text: "Password changed." });
            if (!error) {
              setPassword("");
              setOpen(false);
            }
          }}
        >
          <input type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (10+ characters)" className={input} />
          <div className="flex gap-2">
            <SmallButton type="submit" primary disabled={busy || password.length < 10}>
              Save password
            </SmallButton>
            <SmallButton onClick={() => setOpen(false)}>Cancel</SmallButton>
          </div>
        </form>
      ) : (
        <div className="mt-2">
          <SmallButton onClick={() => { setResult(null); setOpen(true); }}>Change my password</SmallButton>
        </div>
      )}
    </Card>
  );
}

function SmallButton({ primary, danger, type = "button", ...props }: React.ComponentProps<"button"> & { primary?: boolean; danger?: boolean }) {
  const look = danger ? "bg-danger text-white" : primary ? "bg-brand text-white" : "border-2 border-brand bg-surface text-brand";
  return <button type={type} className={`min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-40 ${look}`} {...props} />;
}
