/** Shared form styling for the vessel screens. */
export const inputClass =
  "min-h-12 w-full rounded-xl border-2 border-line bg-surface px-3 text-base placeholder:text-muted/60 focus:border-brand focus:outline-none disabled:bg-page disabled:text-muted";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
