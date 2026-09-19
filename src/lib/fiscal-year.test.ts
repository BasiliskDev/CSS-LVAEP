import { describe, expect, it } from "vitest";
import {
  buildCalendarWeeks,
  calendarYearForFiscalMonth,
  daysInMonthUTC,
  fiscalMonthIndexFor,
  fiscalYearLabel,
  fiscalYearRange,
  fiscalYearStartFor,
  formatDateInput,
  formatMonthParam,
  isDateInFiscalYear,
  monthLabel,
  parseDateInput,
  parseMonthParam,
  shiftMonth,
  summarizeAttendance,
  totalHeldHours,
  type AttendanceLesson,
} from "./fiscal-year";

const d = (iso: string) => parseDateInput(iso)!;

let seq = 0;
function lesson(
  date: string,
  hours: number,
  status: AttendanceLesson["status"] = "HELD",
): AttendanceLesson {
  return { id: `l${seq++}`, date: d(date), hours, status };
}

describe("fiscal year boundaries", () => {
  it("opens in July and closes at the end of June", () => {
    expect(fiscalYearStartFor(d("2026-07-01"))).toBe(2026);
    expect(fiscalYearStartFor(d("2026-12-31"))).toBe(2026);
    expect(fiscalYearStartFor(d("2027-06-30"))).toBe(2026);
    // One day either side falls into the neighbouring year.
    expect(fiscalYearStartFor(d("2026-06-30"))).toBe(2025);
    expect(fiscalYearStartFor(d("2027-07-01"))).toBe(2027);
  });

  it("labels the year the way the form prints it", () => {
    expect(fiscalYearLabel(2026)).toBe("FY 2026-2027");
  });

  it("exposes a half-open range", () => {
    const { start, end } = fiscalYearRange(2026);
    expect(formatDateInput(start)).toBe("2026-07-01");
    expect(formatDateInput(end)).toBe("2027-07-01");
    expect(isDateInFiscalYear(d("2027-06-30"), 2026)).toBe(true);
    expect(isDateInFiscalYear(d("2027-07-01"), 2026)).toBe(false);
  });

  it("orders fiscal months Jul -> Jun", () => {
    expect(fiscalMonthIndexFor(d("2026-07-15"))).toBe(0);
    expect(fiscalMonthIndexFor(d("2026-12-15"))).toBe(5);
    expect(fiscalMonthIndexFor(d("2027-01-15"))).toBe(6);
    expect(fiscalMonthIndexFor(d("2027-06-15"))).toBe(11);
  });

  it("maps fiscal months back to the right calendar year", () => {
    expect(calendarYearForFiscalMonth(2026, 0)).toBe(2026); // Jul
    expect(calendarYearForFiscalMonth(2026, 5)).toBe(2026); // Dec
    expect(calendarYearForFiscalMonth(2026, 6)).toBe(2027); // Jan
  });
});

describe("month lengths", () => {
  it("knows February, including leap years", () => {
    expect(daysInMonthUTC(2027, 1)).toBe(28);
    expect(daysInMonthUTC(2028, 1)).toBe(29);
  });

  it("knows 30- and 31-day months", () => {
    expect(daysInMonthUTC(2026, 6)).toBe(31); // Jul
    expect(daysInMonthUTC(2026, 8)).toBe(30); // Sep
    expect(daysInMonthUTC(2026, 11)).toBe(31); // Dec
  });
});

describe("date parsing", () => {
  it("round-trips an input value through UTC midnight", () => {
    expect(formatDateInput(d("2026-09-18"))).toBe("2026-09-18");
    expect(d("2026-09-18").getUTCDate()).toBe(18);
  });

  it("rejects malformed and impossible dates instead of rolling them over", () => {
    expect(parseDateInput("not-a-date")).toBeNull();
    expect(parseDateInput("2026-13-01")).toBeNull();
    expect(parseDateInput("2027-02-30")).toBeNull();
    expect(parseDateInput("2026-2-3")).toBeNull();
  });

  it("accepts Feb 29 only in a leap year", () => {
    expect(parseDateInput("2028-02-29")).not.toBeNull();
    expect(parseDateInput("2027-02-29")).toBeNull();
  });
});

describe("summarizeAttendance", () => {
  // The scenario the app is verified against end to end.
  const lessons: AttendanceLesson[] = [
    lesson("2026-07-02", 1.5),
    lesson("2026-09-18", 2),
    lesson("2026-09-18", 1),
    lesson("2027-02-10", 0, "STUDENT_ABSENT"),
    lesson("2026-12-25", 0, "HOLIDAY"),
  ];
  const summary = summarizeAttendance(lessons, 2026);

  it("sums multiple events on the same day into one entry", () => {
    expect(summary.byDate.get("2026-09-18")).toMatchObject({
      hours: 3,
      code: null,
      lessonCount: 2,
    });
  });

  it("totals each month and reconciles to the grand total", () => {
    expect(summary.monthTotals[0]).toBe(1.5); // Jul
    expect(summary.monthTotals[2]).toBe(3); // Sep
    expect(summary.monthTotals[5]).toBe(0); // Dec, holiday only
    expect(summary.monthTotals[7]).toBe(0); // Feb, absence only
    expect(summary.grandTotal).toBe(4.5);
    expect(summary.monthTotals.reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(
      summary.grandTotal,
      10,
    );
  });

  it("keeps absences as the form's internal codes, worth no hours", () => {
    expect(summary.byDate.get("2027-02-10")).toMatchObject({ code: "SA", hours: 0 });
    expect(summary.byDate.get("2026-12-25")).toMatchObject({ code: "H", hours: 0 });
  });

  it("has no entry for a day with no events", () => {
    expect(summary.byDate.get("2026-08-04")).toBeUndefined();
  });

  it("lets held hours override an absence logged the same day", () => {
    const mixed = summarizeAttendance(
      [lesson("2026-08-05", 0, "TUTOR_ABSENT"), lesson("2026-08-05", 2)],
      2026,
    );
    expect(mixed.byDate.get("2026-08-05")).toMatchObject({ hours: 2, code: null });
    expect(mixed.monthTotals[1]).toBe(2);
  });

  it("flags events outside the fiscal year and leaves them out of the totals", () => {
    const summary = summarizeAttendance(
      [lesson("2026-06-30", 2), lesson("2026-07-01", 1)],
      2026,
    );
    expect(summary.outOfRange).toHaveLength(1);
    expect(summary.grandTotal).toBe(1);
    // Still visible on the calendar, which can page outside the fiscal year.
    expect(summary.byDate.get("2026-06-30")).toMatchObject({ hours: 2 });
  });

  it("does not accumulate floating point error across quarter hours", () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      lesson(`2026-07-${String(i + 1).padStart(2, "0")}`, 0.1),
    );
    expect(summarizeAttendance(many, 2026).grandTotal).toBe(1);
  });
});

describe("totalHeldHours", () => {
  it("counts only held lessons", () => {
    expect(
      totalHeldHours([
        lesson("2026-07-02", 1.5),
        lesson("2026-07-09", 2),
        lesson("2026-07-16", 0, "TUTOR_ABSENT"),
      ]),
    ).toBe(3.5);
  });
});

describe("calendar layout", () => {
  it("lays a month out in whole Sunday-first weeks", () => {
    // Sep 2026 starts on a Tuesday and has 30 days.
    const weeks = buildCalendarWeeks(2026, 8);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0].date.getUTCDay()).toBe(0);
    expect(weeks[0][2]).toMatchObject({ day: 1, inMonth: true });
    // Leading cells are padding from August.
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks[0][1].inMonth).toBe(false);
  });

  it("covers every day of the month exactly once", () => {
    for (const [year, month] of [
      [2026, 8],
      [2027, 1],
      [2028, 1], // leap February
      [2026, 10],
    ] as const) {
      const days = buildCalendarWeeks(year, month)
        .flat()
        .filter((c) => c.inMonth)
        .map((c) => c.day);
      expect(days).toEqual(
        Array.from({ length: daysInMonthUTC(year, month) }, (_, i) => i + 1),
      );
    }
  });

  it("handles a month that starts on a Sunday without a blank leading week", () => {
    // Nov 2026 starts on a Sunday.
    const weeks = buildCalendarWeeks(2026, 10);
    expect(weeks[0][0]).toMatchObject({ day: 1, inMonth: true });
  });

  it("labels months in UTC", () => {
    expect(monthLabel(2026, 8)).toBe("September 2026");
  });
});

describe("month navigation", () => {
  it("steps forward and back across year boundaries", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 8, 1)).toEqual({ year: 2026, month: 9 });
  });

  it("round-trips the ?month= query parameter", () => {
    expect(formatMonthParam(2026, 8)).toBe("2026-09");
    expect(parseMonthParam("2026-09")).toEqual({ year: 2026, month: 8 });
  });

  it("rejects a malformed month parameter rather than guessing", () => {
    expect(parseMonthParam(undefined)).toBeNull();
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam("nonsense")).toBeNull();
    expect(parseMonthParam("2026-9")).toBeNull();
  });
});
