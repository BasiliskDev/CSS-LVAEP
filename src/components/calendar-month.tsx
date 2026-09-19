import Link from "next/link";
import type { ReactNode } from "react";

import {
  WEEKDAY_LABELS,
  buildCalendarWeeks,
  formatDateDisplay,
  formatDateInput,
  monthLabel,
  shiftMonth,
  todayUTC,
} from "@/lib/fiscal-year";
import { Card, cx } from "@/components/ui";

/**
 * The month scaffold shared by the per-student calendar and the global one:
 * header with month navigation, the weekday row, and the day cells.
 *
 * It renders no event markup of its own — callers pass the chips for each day and
 * an optional per-day action — because the two calendars differ in exactly that:
 * the student view opens an inline editor, the global view links out to a student.
 */
export function CalendarMonth({
  year,
  month,
  monthHref,
  summary,
  chipsByDate,
  dayAction,
  mutedDates,
  legend,
  footer,
}: {
  year: number;
  month: number;
  /** Builds the href for another month, so each caller keeps its own query shape. */
  monthHref: (year: number, month: number) => string;
  /** Right-hand side of the header, e.g. "11.5 hours this month". */
  summary?: ReactNode;
  chipsByDate: Map<string, ReactNode>;
  dayAction?: (dateKey: string, date: Date) => ReactNode;
  /** Dates to mark as outside the relevant fiscal year. */
  mutedDates?: Set<string>;
  legend?: ReactNode;
  footer?: ReactNode;
}) {
  const weeks = buildCalendarWeeks(year, month);
  const today = formatDateInput(todayUTC());
  const now = todayUTC();

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-1">
          <MonthLink href={monthHref(prev.year, prev.month)} label="Previous month">
            ‹
          </MonthLink>
          <h2 className="min-w-44 text-center text-base font-semibold text-ink">
            {monthLabel(year, month)}
          </h2>
          <MonthLink href={monthHref(next.year, next.month)} label="Next month">
            ›
          </MonthLink>
        </div>

        <div className="flex items-center gap-3">
          {summary}
          <Link
            href={monthHref(now.getUTCFullYear(), now.getUTCMonth())}
            className="rounded-md border border-line-strong px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface-2"
          >
            Today
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-xs font-medium text-muted">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="px-1 py-2">
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {weeks.flat().map((cell) => (
          <div
            key={cell.key}
            className={cx(
              "min-h-24 border-b border-r border-line p-1.5 last:border-r-0",
              !cell.inMonth && "bg-surface-2/50",
              cell.key === today && "bg-brand-soft/60",
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-1">
              <span
                className={cx(
                  "text-xs tabular-nums",
                  cell.inMonth ? "text-ink" : "text-faint",
                  cell.key === today && "font-bold text-brand",
                )}
                title={formatDateDisplay(cell.date)}
              >
                {cell.day}
              </span>
              {cell.inMonth ? dayAction?.(cell.key, cell.date) : null}
            </div>

            {chipsByDate.get(cell.key) ?? null}

            {mutedDates?.has(cell.key) ? (
              <p className="mt-1 text-[10px] text-accent">outside FY</p>
            ) : null}
          </div>
        ))}
      </div>

      {legend ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-3 text-xs text-muted">
          {legend}
        </div>
      ) : null}

      {footer}
    </Card>
  );
}

function MonthLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-line-strong text-lg leading-none text-ink hover:bg-surface-2"
    >
      {children}
    </Link>
  );
}

/** The TA/SA/H key, shared by both calendars. */
export function AbsenceLegend() {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent-soft ring-1 ring-accent/30" />
      <span className="font-medium text-ink">TA</span> tutor absent ·{" "}
      <span className="font-medium text-ink">SA</span> student absent ·{" "}
      <span className="font-medium text-ink">H</span> holiday
    </span>
  );
}
