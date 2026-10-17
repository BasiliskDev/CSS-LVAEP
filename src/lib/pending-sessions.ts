import { hasSlotEnded } from "./club-time";
import { CLUB_TIME_ZONE } from "./constants";
import { occurrencesBetween, type WeeklyRule } from "./recurrence";

/**
 * Which finished sessions still owe hours.
 *
 * This is the whole decision behind the dashboard's "Sessions awaiting hours" banner,
 * deliberately kept free of Prisma: the caller loads the series, the already-logged
 * keys and the cancelled dates, and this folds them into a list. That makes the
 * reminder's logic testable without a database, which is the only reason it is safe to
 * have no test for the banner component itself.
 */

/** How far back to keep chasing. Older than this and the nagging is just noise. */
export const PENDING_LOOKBACK_DAYS = 21;

/**
 * Slack after a slot ends before we start asking. A tutor packing up at 6:30 should not
 * find a reminder waiting at 6:31.
 */
export const PENDING_GRACE_MINUTES = 60;

export type SeriesForPending = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  startsOn: Date;
  endsOn: Date;
  /** Only students still worth chasing: active, and still this tutor's. */
  studentIds: string[];
};

export type PendingOccurrence = {
  seriesId: string;
  date: Date;
  dateKey: string;
  /** Students in this session with no lesson logged for the date. */
  missingStudentIds: string[];
};

/** `"<seriesId>|<YYYY-MM-DD>"`, optionally narrowed to one student. */
export function pendingKey(seriesId: string, dateKey: string, studentId?: string): string {
  return studentId ? `${seriesId}|${dateKey}|${studentId}` : `${seriesId}|${dateKey}`;
}

function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function missingOccurrences(args: {
  series: SeriesForPending[];
  /** `pendingKey(seriesId, dateKey, studentId)` for every lesson already logged. */
  loggedKeys: Set<string>;
  /** `pendingKey(seriesId, dateKey)` for every cancelled date. */
  skippedKeys: Set<string>;
  windowStart: Date;
  now: Date;
  graceMinutes?: number;
  timeZone?: string;
}): PendingOccurrence[] {
  const {
    series,
    loggedKeys,
    skippedKeys,
    windowStart,
    now,
    graceMinutes = PENDING_GRACE_MINUTES,
    timeZone = CLUB_TIME_ZONE,
  } = args;

  const pending: PendingOccurrence[] = [];

  for (const entry of series) {
    if (entry.studentIds.length === 0) continue;

    const rule: WeeklyRule = {
      weekday: entry.weekday,
      startsOn: entry.startsOn,
      endsOn: entry.endsOn,
    };

    // The window's upper bound is tomorrow: today's own occurrence has to be eligible,
    // and hasSlotEnded decides whether its slot has actually passed yet.
    const windowEnd = new Date(now.getTime() + 86_400_000);

    for (const date of occurrencesBetween(rule, windowStart, windowEnd)) {
      const dateKey = dateKeyOf(date);

      if (skippedKeys.has(pendingKey(entry.id, dateKey))) continue;
      if (!hasSlotEnded(date, entry.endTime, now, graceMinutes, timeZone)) continue;

      const missingStudentIds = entry.studentIds.filter(
        (studentId) => !loggedKeys.has(pendingKey(entry.id, dateKey, studentId)),
      );
      if (missingStudentIds.length === 0) continue;

      pending.push({ seriesId: entry.id, date, dateKey, missingStudentIds });
    }
  }

  // Oldest first: the point is clearing a backlog, not seeing the newest gap.
  return pending.sort((a, b) => a.date.getTime() - b.date.getTime());
}
