import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { STATUS } from "@/lib/trip";
import type { TripStatus } from "@/lib/types";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40";
const variants = {
  primary: "bg-brand text-white active:bg-brand-dark shadow-sm",
  secondary: "bg-surface text-brand border-2 border-brand",
  danger: "bg-danger text-white",
  ghost: "text-brand",
};
type Variant = keyof typeof variants;

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return <section className={`rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`} {...props} />;
}

export function StatusBadge({ status }: { status: TripStatus }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[status].badge}`}>{STATUS[status].label}</span>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3 text-base placeholder:text-muted/60 focus:border-brand focus:outline-none disabled:bg-page disabled:text-muted";

export function Alert({ tone = "info", children, className = "" }: { tone?: "info" | "warning" | "danger" | "success"; children: ReactNode; className?: string }) {
  const tones = {
    info: "bg-brand-soft text-brand-dark",
    warning: "bg-amber-50 text-amber-900 border border-amber-200",
    danger: "bg-danger/10 text-danger",
    success: "bg-emerald-50 text-emerald-900 border border-emerald-200",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${tones[tone]} ${className}`}>
      {children}
    </div>
  );
}
