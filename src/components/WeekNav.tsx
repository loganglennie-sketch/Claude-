import Link from "next/link";
import { addDays, currentWeekStart, formatWeekRange } from "@/lib/week";

export function WeekNav({ weekStart, basePath }: { weekStart: string; basePath: string }) {
  const thisWeek = currentWeekStart();
  const isCurrent = weekStart === thisWeek;
  const prev = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  const canGoNext = next <= thisWeek;
  const arrow = "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-line bg-surface text-2xl text-brand";

  return (
    <nav aria-label="Choose week" className="flex items-center gap-3">
      <Link href={`${basePath}?week=${prev}`} className={arrow} aria-label="Previous week">
        ‹
      </Link>
      <div className="flex-1 text-center leading-tight">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{isCurrent ? "This week" : "Week of"}</div>
        <div className="text-lg font-semibold">{formatWeekRange(weekStart)}</div>
      </div>
      {canGoNext ? (
        <Link href={`${basePath}?week=${next}`} className={arrow} aria-label="Next week">
          ›
        </Link>
      ) : (
        <span className={`${arrow} opacity-30`} aria-hidden>
          ›
        </span>
      )}
    </nav>
  );
}
