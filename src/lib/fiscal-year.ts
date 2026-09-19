import { LESSON_STATUS_META, type LessonStatus } from "./constants";

/**
 * Date and hours arithmetic, as pure functions.
 *
 * The paper form runs a July-to-June fiscal year ("FY 2026-2027" = Jul 2026 through
 * Jun 2027) and totals hours per month. Tutors log each tutoring event individually;
 * these helpers roll those events up per day (for the list and calendar views) and per
 * fiscal month (for the totals the office reports on).
 *
 * Dates are handled entirely in UTC. A lesson logged as "2026-09-18" is stored as UTC
 * midnight and read back with UTC getters, so a day never drifts into its neighbour
 * (and therefore the neighbouring month, or fiscal year) because of the server's
 * local timezone.
 */

/** Column order on the form, with each label's 0-indexed calendar month. */
export const FISCAL_MONTHS = [
  { label: "Jul", month: 6 },
  { label: "Aug", month: 7 },
  { label: "Sep", month: 8 },
  { label: "Oct", month: 9 },
  { label: "Nov", month: 10 },
  { label: "Dec", month: 11 },
  { label: "Jan", month: 0 },
  { label: "Feb", month: 1 },
  { label: "Mar", month: 2 },
  { label: "Apr", month: 3 },
  { label: "May", month: 4 },
  { label: "Jun", month: 5 },
] as const;

/** The fiscal year opens in July, calendar month index 6. */
const FISCAL_START_MONTH = 6;

/** Calendar year of the July that opens the fiscal year containing `date`. */
export function fiscalYearStartFor(date: Date): number {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() >= FISCAL_START_MONTH ? year : year - 1;
}

/** `2026` -> `"FY 2026-2027"`, matching the form's own header. */
export function fiscalYearLabel(fiscalYearStart: number): string {
  return `FY ${fiscalYearStart}-${fiscalYearStart + 1}`;
}

/** Half-open range [start, end) covering the whole fiscal year. */
export function fiscalYearRange(fiscalYearStart: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(fiscalYearStart, FISCAL_START_MONTH, 1)),
    end: new Date(Date.UTC(fiscalYearStart + 1, FISCAL_START_MONTH, 1)),
  };
}

/** Column index (0 = Jul ... 11 = Jun) for a date. */
export function fiscalMonthIndexFor(date: Date): number {
  return (date.getUTCMonth() - FISCAL_START_MONTH + 12) % 12;
}

/** Calendar year a fiscal month falls in (Jul-Dec = start year, Jan-Jun = start + 1). */
export function calendarYearForFiscalMonth(
  fiscalYearStart: number,
  monthIndex: number,
): number {
  return monthIndex < 6 ? fiscalYearStart : fiscalYearStart + 1;
}

/** Real length of a calendar month, leap years included. Day 0 of the next month is the last of this one. */
export function daysInMonthUTC(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function isDateInFiscalYear(date: Date, fiscalYearStart: number): boolean {
  const { start, end } = fiscalYearRange(fiscalYearStart);
  return date >= start && date < end;
}

// --- Date <-> `<input type="date">` value ---------------------------------------

/** `"2026-09-18"` -> UTC midnight Date. Returns null for malformed input. */
export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Rejects impossible dates that would otherwise roll over (e.g. 2026-02-30).
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

/** UTC Date -> `"2026-09-18"`, for prefilling `<input type="date">`. */
export function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Human form, e.g. "Sep 18, 2026". Explicitly UTC so it matches the stored day. */
export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Today at UTC midnight — the default for a new lesson. */
export function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// --- Attendance summary ---------------------------------------------------------

export type AttendanceLesson = {
  id: string;
  date: Date;
  hours: number;
  status: LessonStatus;
};

export type DaySummary = {
  /** Summed hours of the HELD lessons that day. */
  hours: number;
  /** Absence code (TA/SA/H) shown when the day has no held hours. */
  code: string | null;
  lessonCount: number;
};

export type AttendanceSummary = {
  fiscalYearStart: number;
  /** Keyed by `"YYYY-MM-DD"`, so both the calendar and the list can look a day up directly. */
  byDate: Map<string, DaySummary>;
  /** Jul-to-Jun totals, in FISCAL_MONTHS order. */
  monthTotals: number[];
  grandTotal: number;
  /** Lessons outside the student's fiscal year, so the UI can flag rather than hide them. */
  outOfRange: AttendanceLesson[];
};

/** Floats accumulate error (0.1 + 0.2); hours come in quarters, so 2dp is plenty. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Fold a student's lessons into a per-day summary plus the fiscal-year totals the
 * office cares about.
 *
 * Per day, mirroring the paper form's own convention:
 *   1. any HELD lesson  -> the summed hours (several sessions in one day add up)
 *   2. otherwise        -> the absence code TA / SA / H
 *   3. nothing          -> no entry
 *
 * Only HELD hours reach the totals, so an absence never inflates the count.
 */
export function summarizeAttendance(
  lessons: AttendanceLesson[],
  fiscalYearStart: number,
): AttendanceSummary {
  const byDate = new Map<string, DaySummary>();
  const monthTotals = new Array<number>(12).fill(0);
  const outOfRange: AttendanceLesson[] = [];

  for (const lesson of lessons) {
    const key = formatDateInput(lesson.date);
    const day = byDate.get(key) ?? { hours: 0, code: null, lessonCount: 0 };
    day.lessonCount += 1;

    const counts = LESSON_STATUS_META[lesson.status].countsAsHours;

    if (counts) {
      day.hours = round2(day.hours + lesson.hours);
      // Held hours win the day outright.
      day.code = null;
    } else if (day.hours === 0) {
      // Keep the first absence code seen; a later held lesson still overrides it.
      day.code ??= LESSON_STATUS_META[lesson.status].code;
    }

    byDate.set(key, day);

    // Totals are fiscal-year scoped even though the day map is not, so the calendar
    // can still page into a neighbouring year without losing those lessons.
    if (!isDateInFiscalYear(lesson.date, fiscalYearStart)) {
      outOfRange.push(lesson);
    } else if (counts) {
      const monthIndex = fiscalMonthIndexFor(lesson.date);
      monthTotals[monthIndex] = round2(monthTotals[monthIndex] + lesson.hours);
    }
  }

  return {
    fiscalYearStart,
    byDate,
    monthTotals,
    grandTotal: round2(monthTotals.reduce((a, b) => a + b, 0)),
    outOfRange,
  };
}

/** Total held hours, ignoring fiscal year — used for dashboard tiles. */
export function totalHeldHours(lessons: AttendanceLesson[]): number {
  return round2(
    lessons
      .filter((l) => LESSON_STATUS_META[l.status].countsAsHours)
      .reduce((sum, l) => sum + l.hours, 0),
  );
}

// --- Calendar layout ------------------------------------------------------------

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type CalendarDay = {
  date: Date;
  key: string;
  day: number;
  /** False for the padding days that belong to the neighbouring month. */
  inMonth: boolean;
};

/**
 * Weeks (Sunday-first) covering a calendar month, padded out to whole weeks with the
 * neighbouring months' days so every row has seven cells.
 */
export function buildCalendarWeeks(year: number, monthIndex: number): CalendarDay[][] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const leading = first.getUTCDay();
  const total = daysInMonthUTC(year, monthIndex);
  const weekCount = Math.ceil((leading + total) / 7);

  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      // Date normalises out-of-range day numbers, which gives us the padding for free.
      const date = new Date(Date.UTC(year, monthIndex, w * 7 + d - leading + 1));
      week.push({
        date,
        key: formatDateInput(date),
        day: date.getUTCDate(),
        inMonth: date.getUTCMonth() === monthIndex,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

/** e.g. "September 2026". */
export function monthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

/** Step a year/month pair by whole months, rolling the year over as needed. */
export function shiftMonth(
  year: number,
  monthIndex: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

/** `"2026-09"` -> `{ year, month }`; null when malformed. */
export function parseMonthParam(value: string | undefined): {
  year: number;
  month: number;
} | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year, month };
}

/** `{ year, month }` -> `"2026-09"`, for the `?month=` query. */
export function formatMonthParam(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}
