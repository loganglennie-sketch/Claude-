"use client";

import { useMemo, useState } from "react";
import { addDays, todayISO } from "@/lib/dates";
import { serverStore } from "@/lib/demo-server";
import { downloadFile } from "@/lib/download";
import { STATUS } from "@/lib/trip";
import type { Trip, TripStatus } from "@/lib/types";
import { Button, Card, Field, inputClass } from "../ui";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const APPROVED: TripStatus[] = ["approved", "ready", "invoiced"];

export function Exports() {
  const data = serverStore.useValue();
  const [from, setFrom] = useState(() => addDays(todayISO(), -60));
  const [to, setTo] = useState(() => todayISO());
  const [statuses, setStatuses] = useState<TripStatus[]>(APPROVED);
  const [busy, setBusy] = useState<string | null>(null);

  // Trips that ended in the chosen dates.
  const inRange = useMemo(() => Object.values(data?.trips ?? {}).filter((t) => t.endDate >= from && t.endDate <= to), [data, from, to]);
  const chosen = inRange.filter((t) => statuses.includes(t.status));
  const left = inRange.length - chosen.length;
  const forInvoice = chosen.filter((t) => t.status === "ready");

  async function make(kind: string, build: () => Promise<{ data: BlobPart; name: string; type: string }>) {
    setBusy(kind);
    try {
      const file = await build();
      downloadFile(file.data, file.name, file.type);
    } finally {
      setBusy(null);
    }
  }
  const range = `${from}-to-${to}`;
  const signedOnly = (trips: Trip[]) => trips.filter((t) => t.approval);

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-bold">Exports</h1>
      <Card className="space-y-3">
        <h2 className="font-semibold">Which trips</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Trips ending from">
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="to">
            <input type="date" className={inputClass} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
          <legend className="mb-1 text-sm font-semibold">Include</legend>
          {(["submitted", "queried", "approved", "ready", "invoiced"] as TripStatus[]).map((s) => (
            <label key={s} className="flex min-h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={statuses.includes(s)}
                onChange={(e) => setStatuses(e.target.checked ? [...statuses, s] : statuses.filter((x) => x !== s))}
              />
              {STATUS[s].label}
            </label>
          ))}
        </fieldset>
        <p className="text-sm text-muted">
          {chosen.length} {chosen.length === 1 ? "trip" : "trips"} chosen.
          {left > 0 && ` ${left} other ${left === 1 ? "trip" : "trips"} in these dates ${left === 1 ? "isn't" : "aren't"} included (not approved yet, or not ticked above).`}
        </p>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">Payroll</h2>
        <p className="text-sm text-muted">Days and hours per person per trip, a total per person, and every day listed (for payroll imports).</p>
        <Button
          disabled={!!busy || chosen.length === 0}
          onClick={() =>
            make("payroll", async () => {
              const { buildPayrollWorkbook } = await import("@/lib/excel");
              return { data: await buildPayrollWorkbook(chosen), name: `payroll-${range}.xlsx`, type: XLSX };
            })
          }
        >
          {busy === "payroll" ? "Making…" : "Download payroll Excel"}
        </Button>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">Invoicing</h2>
        <p className="text-sm text-muted">Grouped by client, PO number and work order / cost code, with subtotals: one line per invoice item.</p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!!busy || chosen.length === 0}
            onClick={() =>
              make("invoice", async () => {
                const { buildInvoicingWorkbook } = await import("@/lib/excel");
                return { data: await buildInvoicingWorkbook(chosen), name: `invoicing-${range}.xlsx`, type: XLSX };
              })
            }
          >
            {busy === "invoice" ? "Making…" : "Download invoicing Excel"}
          </Button>
          <Button
            variant="secondary"
            disabled={!!busy || forInvoice.length === 0}
            onClick={() =>
              make("ready", async () => {
                const { buildInvoicingWorkbook } = await import("@/lib/excel");
                return { data: await buildInvoicingWorkbook(forInvoice), name: `ready-to-invoice-${range}.xlsx`, type: XLSX };
              })
            }
          >
            Only &quot;ready to invoice&quot; ({forInvoice.length})
          </Button>
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">Signed PDFs</h2>
        <p className="text-sm text-muted">Every client-approved trip above in one PDF, each showing the technician&apos;s signature and the client&apos;s approval. Handy to attach to an invoice.</p>
        <Button
          variant="secondary"
          disabled={!!busy || signedOnly(chosen).length === 0}
          onClick={() =>
            make("pdf", async () => {
              const { buildCombinedPdf } = await import("@/lib/excel");
              return { data: (await buildCombinedPdf(signedOnly(chosen))) as BlobPart, name: `signed-trips-${range}.pdf`, type: "application/pdf" };
            })
          }
        >
          {busy === "pdf" ? "Making…" : `Download ${signedOnly(chosen).length} signed PDFs`}
        </Button>
      </Card>
    </div>
  );
}
