import Link from "next/link";
import type { ComponentProps } from "react";

const base =
  "inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 text-lg font-semibold transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40";
const variants = {
  primary: "bg-brand text-white active:bg-brand-dark shadow-sm",
  secondary: "bg-surface text-brand border-2 border-brand",
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

export function StatusBadge({ status }: { status: "draft" | "submitted" | "approved" }) {
  const styles = {
    draft: "bg-amber-100 text-amber-900",
    submitted: "bg-brand-soft text-brand-dark",
    approved: "bg-brand text-white",
  };
  const label = { draft: "Not submitted", submitted: "Submitted", approved: "Approved" };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{label[status]}</span>;
}
