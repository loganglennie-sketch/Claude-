"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { signOutLive } from "@/app/actions/auth";
import { addCompanyAdmin, createCompany, loadSampleData, setCompanyActive, type ActionResult } from "@/app/actions/super";
import { Button, Card } from "../ui";

export type CompanySummary = {
  company_id: string;
  name: string;
  slug: string;
  is_test: boolean;
  active: boolean;
  active_workers: number;
  inactive_workers: number;
  admins: number;
  last_submission: string | null;
  created_at: string;
  hostKeywords: string[];
  entryMode: string;
};

const input =
  "min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3 text-base placeholder:text-muted/60 focus:border-brand focus:outline-none";
const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function SuperDashboard({ rows, loadError }: { rows: CompanySummary[]; loadError: boolean }) {
  const billable = rows.filter((r) => r.active && !r.is_test);
  const billableWorkers = billable.reduce((n, r) => n + Number(r.active_workers), 0);
  const [adding, setAdding] = useState(rows.length === 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-12 pt-5">
      <div>
        <h1 className="text-2xl font-bold">Companies</h1>
        <p className="text-muted">
          {billable.length} paying {billable.length === 1 ? "company" : "companies"} · <strong className="text-ink">{billableWorkers}</strong> active workers to bill
          {rows.some((r) => r.is_test) && " (test companies not counted)"}
        </p>
      </div>
      {loadError && <Problem text="Couldn't load the companies. Refresh the page to try again." />}

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((r) => (
          <CompanyCard key={r.company_id} row={r} />
        ))}
      </div>

      {adding ? (
        <NewCompanyForm onCancel={rows.length ? () => setAdding(false) : undefined} />
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          + Add a company
        </Button>
      )}
    </div>
  );
}

function CompanyCard({ row }: { row: CompanySummary }) {
  const [panel, setPanel] = useState<"none" | "admin" | "off">("none");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setResult(null);
      try {
        setResult(await fn());
      } catch {
        setResult({ ok: false, error: "Couldn't reach the server. Please try again." });
      }
      setPanel("none");
    });

  return (
    <Card className={row.active ? "" : "opacity-70"}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{row.name}</h2>
          <p className="text-sm text-muted">
            Web addresses containing: {row.hostKeywords.map((k) => <code key={k} className="rounded bg-brand-soft px-1">{k}</code>)} · {row.entryMode === "times" ? "start & finish times" : "hours or times"}
          </p>
        </div>
        {row.is_test && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Test</span>}
        {!row.active && <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">Switched off</span>}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Active workers" value={row.active_workers} strong />
        <Stat label="Left" value={row.inactive_workers} />
        <Stat label="Office admins" value={row.admins} />
      </dl>
      <p className="mt-2 text-sm text-muted">
        Last timesheet: {row.last_submission ? dateTime.format(new Date(row.last_submission)) : "none yet"}
      </p>

      {result && (result.ok ? <Done result={result} /> : <Problem text={result.error} />)}

      {panel === "admin" && <AddAdminForm companyId={row.company_id} onDone={() => setPanel("none")} />}
      {panel === "off" && (
        <div className="mt-3 space-y-2 rounded-xl bg-danger/5 p-3">
          <p className="text-sm">
            Nobody at {row.name} will be able to sign in, and its web address will go back to being the demo. Nothing is deleted; you can switch it back on.
          </p>
          <div className="flex gap-2">
            <SmallButton danger disabled={pending} onClick={() => run(() => setCompanyActive(row.company_id, false))}>
              Switch off
            </SmallButton>
            <SmallButton onClick={() => setPanel("none")}>Cancel</SmallButton>
          </div>
        </div>
      )}

      {panel === "none" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {row.active && <SmallButton onClick={() => setPanel("admin")}>+ Office admin</SmallButton>}
          {row.is_test && row.active && Number(row.active_workers) + Number(row.inactive_workers) === 0 && (
            <SmallButton disabled={pending} onClick={() => run(() => loadSampleData(row.company_id))}>
              {pending ? "Loading…" : "Load sample team & timesheets"}
            </SmallButton>
          )}
          {row.active ? (
            <SmallButton onClick={() => setPanel("off")}>Switch off</SmallButton>
          ) : (
            <SmallButton disabled={pending} onClick={() => run(() => setCompanyActive(row.company_id, true))}>
              Switch back on
            </SmallButton>
          )}
        </div>
      )}
    </Card>
  );
}

function AddAdminForm({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(addCompanyAdmin, null);
  if (state?.ok) return <Done result={state} />;
  return (
    <form action={action} className="mt-3 space-y-2 rounded-xl bg-brand-soft/60 p-3">
      <input type="hidden" name="company_id" value={companyId} />
      <AdminFields />
      {state && !state.ok && <Problem text={state.error} />}
      <div className="flex gap-2">
        <SmallButton type="submit" primary disabled={pending}>
          {pending ? "Adding…" : "Add admin"}
        </SmallButton>
        <SmallButton onClick={onDone}>Cancel</SmallButton>
      </div>
    </form>
  );
}

function NewCompanyForm({ onCancel }: { onCancel?: () => void }) {
  const [state, action, pending] = useActionState(createCompany, null);
  if (state?.ok) return <Done result={state} />;
  return (
    <Card>
      <h2 className="text-lg font-semibold">Add a company</h2>
      <form action={action} className="mt-3 space-y-3">
        <Field label="Company name">
          <input name="name" required placeholder="e.g. ElevateX Marketing" className={input} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Short name" hint="Lower case, no spaces. Picks the logo and colours if they're set up (e.g. elevatex).">
            <input name="slug" required pattern="[a-z0-9\-]{2,40}" placeholder="elevatex" className={input} />
          </Field>
          <Field label="Web address word" hint="Any address containing this opens as the company (e.g. elevatex).">
            <input name="keywords" required placeholder="elevatex" className={input} />
          </Field>
        </div>
        <Field label="How workers record each job">
          <select name="entry_mode" defaultValue="times" className={input}>
            <option value="times">Start and finish time for every job</option>
            <option value="hours-or-times">Hours, or start and finish times</option>
          </select>
        </Field>
        <Field label="Payroll email (optional)" hint="For emailed timesheets later on.">
          <input name="payroll_email" type="email" className={input} />
        </Field>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="show_overtime" className="h-6 w-6 accent-[var(--brand-primary)]" />
          Show overtime figures
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="is_test" className="h-6 w-6 accent-[var(--brand-primary)]" />
          Test company (not billed; can load sample data)
        </label>
        <h3 className="pt-2 font-semibold">First office admin</h3>
        <AdminFields />
        {state && !state.ok && <Problem text={state.error} />}
        <div className="flex gap-2">
          <SmallButton type="submit" primary disabled={pending}>
            {pending ? "Adding…" : "Add company"}
          </SmallButton>
          {onCancel && <SmallButton onClick={onCancel}>Cancel</SmallButton>}
        </div>
      </form>
    </Card>
  );
}

function AdminFields() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Admin's name">
        <input name="admin_name" required autoComplete="off" className={input} />
      </Field>
      <Field label="Admin's email">
        <input name="admin_email" type="email" required autoComplete="off" className={input} />
      </Field>
      <Field label="Temporary password" hint="10+ characters. They can change it after signing in.">
        <input name="admin_password" type="text" required minLength={10} autoComplete="new-password" className={input} />
      </Field>
    </div>
  );
}

function Done({ result }: { result: Extract<ActionResult, { ok: true }> }) {
  if (!result.message) return null;
  return (
    <div role="status" className="mt-3 space-y-2 rounded-xl bg-brand-soft p-3 text-sm text-brand-dark">
      <p className="font-medium">{result.message}</p>
      {result.pins && (
        <>
          <p>Starting PINs (shown only once; write them down). Each worker chooses their own PIN the first time they sign in:</p>
          <ul className="grid grid-cols-2 gap-1 font-mono">
            {result.pins.map((p) => (
              <li key={p.name}>
                {p.name}: <strong>{p.pin}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-3 rounded-xl bg-danger/10 p-3 text-sm font-medium text-danger">
      {text}
    </p>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-page p-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-2xl font-bold text-brand" : "text-xl font-semibold"}`}>{value}</dd>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function SmallButton({ primary, danger, className = "", type = "button", ...props }: React.ComponentProps<"button"> & { primary?: boolean; danger?: boolean }) {
  const look = danger ? "bg-danger text-white" : primary ? "bg-brand text-white" : "border-2 border-brand bg-surface text-brand";
  return <button type={type} className={`min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-40 ${look} ${className}`} {...props} />;
}

export function SuperSignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOutLive();
        router.replace("/office");
        router.refresh();
      }}
      className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold"
    >
      Sign out
    </button>
  );
}
