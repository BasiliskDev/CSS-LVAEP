import {
  DAYS_IN_GRID,
  FISCAL_MONTHS,
  calendarYearForFiscalMonth,
  fiscalCellKey,
  fiscalYearLabel,
  type AttendanceSummary,
} from "@/lib/fiscal-year";
import { cx } from "@/components/ui";

/**
 * The paper form's grid: 31 day-rows by 12 month-columns, Jul through Jun, with a
 * total per column. Read-only by construction — it renders an AttendanceSummary
 * derived from the logged events, so its totals cannot disagree with the log.
 *
 * `variant="print"` drops the colour and screen affordances so it photocopies like
 * the original: plain black rules on white, tight rows, nothing but ink.
 */
export function AttendanceGrid({
  summary,
  fiscalYearStart,
  variant = "screen",
}: {
  summary: AttendanceSummary;
  fiscalYearStart: number;
  variant?: "screen" | "print";
}) {
  const days = Array.from({ length: DAYS_IN_GRID }, (_, i) => i + 1);
  const print = variant === "print";

  const cellBorder = print ? "border border-black" : "border border-line";
  const headBg = print ? "" : "bg-surface-2";

  return (
    <table
      className={cx(
        "w-full border-collapse text-center tabular-nums",
        print ? "text-[7pt] leading-none" : "min-w-[640px] text-xs",
      )}
    >
      <caption className="sr-only">
        Hours tutored by day and month, {fiscalYearLabel(fiscalYearStart)}
      </caption>
      <thead>
        <tr>
          <th scope="col" className={cx(cellBorder, headBg, print ? "w-5 p-0.5" : "w-10 p-1.5")}>
            <span className="sr-only">Day of month</span>
          </th>
          {FISCAL_MONTHS.map((month, index) => (
            <th
              key={month.label}
              scope="col"
              className={cx(cellBorder, headBg, "font-bold", print ? "p-0.5" : "p-1.5 text-ink")}
              title={`${month.label} ${calendarYearForFiscalMonth(fiscalYearStart, index)}`}
            >
              {month.label}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {days.map((day) => (
          <tr key={day}>
            <th
              scope="row"
              className={cx(
                cellBorder,
                headBg,
                "font-medium",
                print ? "p-0.5" : "p-1.5 text-muted",
              )}
            >
              {day}
            </th>
            {FISCAL_MONTHS.map((month, monthIndex) => {
              const key = fiscalCellKey(fiscalYearStart, monthIndex, day);
              const cell = key ? summary.byDate.get(key) : undefined;
              const value = cell?.hours ? cell.hours : (cell?.code ?? "");

              return (
                <td
                  key={month.label}
                  className={cx(
                    cellBorder,
                    print ? "p-0.5" : "p-1.5",
                    // Days the month doesn't have are struck out, not left blank.
                    !key && (print ? "bg-neutral-200" : "bg-surface-2/60"),
                    Boolean(!print && cell?.hours) && "bg-brand-soft font-semibold text-brand",
                    Boolean(!print && cell?.code) && "font-medium text-accent",
                  )}
                  title={
                    cell
                      ? `${month.label} ${day}: ${cell.hours ? `${cell.hours} h` : cell.code}${
                          cell.lessonCount > 1 ? ` (${cell.lessonCount} events)` : ""
                        }`
                      : undefined
                  }
                >
                  {value}
                </td>
              );
            })}
          </tr>
        ))}

        <tr>
          <th
            scope="row"
            className={cx(
              cellBorder,
              headBg,
              "font-bold",
              print ? "p-0.5 text-[6pt]" : "p-1.5 text-[10px] uppercase text-muted",
            )}
          >
            Total
          </th>
          {summary.monthTotals.map((total, index) => (
            <td
              key={FISCAL_MONTHS[index].label}
              className={cx(
                cellBorder,
                headBg,
                "font-bold",
                print ? "p-0.5" : "p-1.5 text-ink",
              )}
            >
              {total || ""}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
