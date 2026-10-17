/**
 * Weekly recurrence for scheduled sessions.
 *
 * A series is a *rule* — "Tuesdays, Sep 1 through Jan 19" — and its occurrences are
 * computed from that rule rather than stored as rows. Materialising them would turn
 * every edit to the series into a reconciliation problem, and an occurrence's identity
 * is already derivable from (series id, date), which is all anything here needs.
 *
 * Every date is UTC midnight. Stepping by whole days in UTC is daylight-saving-proof:
 * UTC has no transitions, so adding 7 * 86400000 ms to a UTC midnight always lands on
 * another UTC midnight.
 */

export type WeeklyRule = {
  /** 0 = Sunday … 6 = Saturday, matching Date#getUTCDay() and WEEKDAY_LABELS. */
  weekday: number;
  /** UTC midnight, inclusive. */
  startsOn: Date;
  /** UTC midnight, inclusive. */
  endsOn: Date;
};

const MS_PER_DAY = 86_400_000;

/**
 * A guard rail, not a limit anyone should hit: ten years of weekly sessions. Without it
 * a mistyped year in the end date would try to build a date for every week until 4026.
 */
export const MAX_OCCURRENCES = 520;

/** Shift a UTC-midnight date by whole days. */
export function addDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Midnight-align a date in UTC, so callers can pass anything Date-shaped. */
function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** The first date on or after `from` that falls on `weekday`. */
function alignToWeekday(from: Date, weekday: number): Date {
  const start = startOfDayUTC(from);
  const shift = (weekday - start.getUTCDay() + 7) % 7;
  return shift === 0 ? start : addDaysUTC(start, shift);
}

/** Every date the rule falls on, ascending. Empty when the range is inverted. */
export function weeklyOccurrences(rule: WeeklyRule): Date[] {
  const { weekday } = rule;
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return [];

  const endsOn = startOfDayUTC(rule.endsOn);
  let cursor = alignToWeekday(rule.startsOn, weekday);

  const dates: Date[] = [];
  while (cursor.getTime() <= endsOn.getTime() && dates.length < MAX_OCCURRENCES) {
    dates.push(cursor);
    cursor = addDaysUTC(cursor, 7);
  }
  return dates;
}

/** The rule's occurrences inside the half-open window [start, end). */
export function occurrencesBetween(rule: WeeklyRule, start: Date, end: Date): Date[] {
  const from = startOfDayUTC(start).getTime();
  const to = startOfDayUTC(end).getTime();
  return weeklyOccurrences(rule).filter((date) => {
    const time = date.getTime();
    return time >= from && time < to;
  });
}

/**
 * Is this exact date an occurrence of the rule? The server-side authority for a date
 * that arrived in a URL path segment — never trust one of those on its own.
 */
export function isOccurrence(rule: WeeklyRule, date: Date): boolean {
  const day = startOfDayUTC(date);
  if (day.getUTCDay() !== rule.weekday) return false;
  return (
    day.getTime() >= startOfDayUTC(rule.startsOn).getTime() &&
    day.getTime() <= startOfDayUTC(rule.endsOn).getTime()
  );
}

export function countOccurrences(rule: WeeklyRule): number {
  return weeklyOccurrences(rule).length;
}
