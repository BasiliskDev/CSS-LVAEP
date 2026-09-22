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
 * The paper form's 31 x 12 grid, Jul through Jun, with a total per column.
 *
 * This is the printed layout only — on screen the calendar shows the same hours
 * against real weekdays, which is easier to read. Styled as plain black rules on
 * white so it photocopies like the original.
 */
export function AttendanceGrid({
  summary,
  fiscalYearStart,
}: {
  summary: AttendanceSummary;
  fiscalYearStart: number;
}) {
  const days = Array.from({ length: DAYS_IN_GRID }, (_, i) => i + 1);
  const cell = "border border-black p-0.5";

  return (
    <table className="w-full border-collapse text-center text-[7pt] leading-none tabular-nums">
      <caption className="sr-only">
        Hours tutored by day and month, {fiscalYearLabel(fiscalYearStart)}
      </caption>
      <thead>
        <tr>
          <th scope="col" className={cx(cell, "w-5")}>
            <span className="sr-only">Day of month</span>
          </th>
          {FISCAL_MONTHS.map((month, index) => (
            <th
              key={month.label}
              scope="col"
              className={cx(cell, "font-bold")}
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
            <th scope="row" className={cx(cell, "font-medium")}>
              {day}
            </th>
            {FISCAL_MONTHS.map((month, monthIndex) => {
              const key = fiscalCellKey(fiscalYearStart, monthIndex, day);
              const value = key ? summary.byDate.get(key) : undefined;

              return (
                <td
                  key={month.label}
                  // Days the month doesn't have are shaded, not left ambiguously blank.
                  className={cx(cell, !key && "bg-neutral-200")}
                >
                  {value?.hours ? value.hours : (value?.code ?? "")}
                </td>
              );
            })}
          </tr>
        ))}

        <tr>
          <th scope="row" className={cx(cell, "text-[6pt] font-bold")}>
            Total
          </th>
          {summary.monthTotals.map((total, index) => (
            <td key={FISCAL_MONTHS[index].label} className={cx(cell, "font-bold")}>
              {total || ""}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
