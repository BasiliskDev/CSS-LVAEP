/**
 * Weekly recurrence for scheduled sessions.
 *
 * A series is a *rule* — "Tuesdays and Thursdays, Sep 1 through Jan 19" — and its
 * occurrences are computed from that rule rather than stored as rows. Materialising them
 * would turn every edit to the series into a reconciliation problem, and an occurrence's
 * identity is already derivable from (series id, date), which is all anything here needs.
 *
 * A rule always ends on a date. The office may *express* the end as a number of meetings
 * instead ("after 12"), but that is turned into a date by `nthOccurrence` before it is
 * stored, so every query, index and range check downstream keeps working on two plain
 * columns. `endMode` only records which control the office used, so editing a series
 * reopens the form the way they filled it in.
 *
 * Every date is UTC midnight. Stepping by whole days in UTC is daylight-saving-proof:
 * UTC has no transitions, so adding 7 * 86400000 ms to a UTC midnight always lands on
 * another UTC midnight.
 */

export type WeeklyRule = {
  /**
   * Which days the session repeats on: 0 = Sunday … 6 = Saturday, matching
   * Date#getUTCDay() and WEEKDAY_LABELS. Duplicates and out-of-range values are
   * ignored, so an empty or junk list simply yields no occurrences.
   */
  weekdays: number[];
  /** UTC midnight, inclusive. */
  startsOn: Date;
  /** UTC midnight, inclusive. */
  endsOn: Date;
};

const MS_PER_DAY = 86_400_000;

/**
 * A guard rail, not a limit anyone should hit: ten years of a once-weekly session, or
 * about two years of one that meets every weekday. Without it a mistyped year in the end
 * date would try to build a date for every week until 4026.
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

/**
 * Valid weekdays, de-duplicated and ascending. Everything here goes through this, so a
 * form that posts "3" twice, or a stale row with a junk value, degrades to no
 * occurrences rather than to a wrong schedule or an endless loop.
 */
export function normalizeWeekdays(weekdays: readonly number[]): number[] {
  const seen = new Set<number>();
  for (const weekday of weekdays) {
    if (Number.isInteger(weekday) && weekday >= 0 && weekday <= 6) seen.add(weekday);
  }
  return [...seen].sort((a, b) => a - b);
}

/** The first date on or after `from` that falls on `weekday`. */
function alignToWeekday(from: Date, weekday: number): Date {
  const start = startOfDayUTC(from);
  const shift = (weekday - start.getUTCDay() + 7) % 7;
  return shift === 0 ? start : addDaysUTC(start, shift);
}

/** Every date the rule falls on, ascending. Empty when the range is inverted. */
export function weeklyOccurrences(rule: WeeklyRule): Date[] {
  const weekdays = normalizeWeekdays(rule.weekdays);
  if (weekdays.length === 0) return [];

  const endsOn = startOfDayUTC(rule.endsOn).getTime();

  // One pass per weekday stepping by whole weeks, rather than one pass per day over the
  // range: the work is proportional to the number of occurrences, so the cap below is a
  // real bound even when the end date is centuries out.
  const times: number[] = [];
  for (const weekday of weekdays) {
    let cursor = alignToWeekday(rule.startsOn, weekday).getTime();
    let taken = 0;
    while (cursor <= endsOn && taken < MAX_OCCURRENCES) {
      times.push(cursor);
      cursor += 7 * MS_PER_DAY;
      taken += 1;
    }
  }

  // Sort before capping, so an over-long range yields the *earliest* dates rather than
  // everything from whichever weekday happened to be processed first.
  times.sort((a, b) => a - b);
  return times.slice(0, MAX_OCCURRENCES).map((time) => new Date(time));
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
 *
 * Deliberately answered without building the occurrence list: this runs on every write
 * to an occurrence, and it only needs the weekday and the range.
 */
export function isOccurrence(rule: WeeklyRule, date: Date): boolean {
  const day = startOfDayUTC(date);
  if (!normalizeWeekdays(rule.weekdays).includes(day.getUTCDay())) return false;
  return (
    day.getTime() >= startOfDayUTC(rule.startsOn).getTime() &&
    day.getTime() <= startOfDayUTC(rule.endsOn).getTime()
  );
}

export function countOccurrences(rule: WeeklyRule): number {
  return weeklyOccurrences(rule).length;
}

/**
 * The date of the `count`-th meeting of an open-ended rule — what "after 12 meetings"
 * means as a date. Null when the rule has no valid weekday or the count is out of range.
 *
 * The pattern repeats every seven days, so the first week's occurrences in ascending
 * order *are* the cycle: meeting `i` (zero-based) is the `i % cycle.length`-th entry,
 * pushed forward by `floor(i / cycle.length)` whole weeks. No iteration per meeting, so
 * a four-digit count costs the same as a single-digit one.
 */
export function nthOccurrence(
  startsOn: Date,
  weekdays: readonly number[],
  count: number,
): Date | null {
  const days = normalizeWeekdays(weekdays);
  if (days.length === 0) return null;
  if (!Number.isInteger(count) || count < 1 || count > MAX_OCCURRENCES) return null;

  const cycle = days
    .map((weekday) => alignToWeekday(startsOn, weekday).getTime())
    .sort((a, b) => a - b);

  const index = count - 1;
  const weeks = Math.floor(index / cycle.length);
  return new Date(cycle[index % cycle.length] + weeks * 7 * MS_PER_DAY);
}
