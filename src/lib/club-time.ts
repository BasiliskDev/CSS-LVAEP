import { CLUB_TIME_ZONE } from "./constants";

/**
 * Where the app's two notions of time meet.
 *
 * Dates are stored as UTC midnight (see src/lib/fiscal-year.ts); time slots are bare
 * "HH:MM" strings on the club's wall clock. Asking "has this 5:30-6:30 PM session
 * finished?" by building `Date.UTC(y, m, d, 18, 30)` is wrong by the UTC offset — four
 * or five hours in New Jersey — which would chase tutors for hours before they had even
 * started tutoring.
 *
 * Every comparison here happens in *wall-clock space* instead: we ask what the club's
 * clock reads right now and compare that against the slot's own reading. No offset is
 * ever computed, so daylight saving needs no special handling.
 *
 * This module must not import ./fiscal-year — that module imports this one — and must
 * not be `server-only`: todayUTC() is called from client components too.
 */

/** A reading off the wall, not an instant. */
export type WallClock = {
  year: number;
  /** 1-12. A clock reading, not a Date's 0-indexed month. */
  month: number;
  day: number;
  /** Minutes since local midnight, 0-1439. */
  minutes: number;
};

const MINUTES_PER_DAY = 1440;
const MS_PER_DAY = 86_400_000;

/**
 * Formatters are expensive to construct and this runs once per occurrence per render,
 * so keep one per timezone.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      // `hourCycle: "h23"` and not `hour12: false`: some ICU builds render midnight as
      // "24" under the latter, which would silently become 1440 minutes and shift every
      // midnight comparison by a full day.
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** What the clock on the club's wall says at `instant`. */
export function wallClockIn(instant: Date, timeZone: string = CLUB_TIME_ZONE): WallClock {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    minutes: read("hour") * 60 + read("minute"),
  };
}

/**
 * The club's current day as a UTC-midnight Date, so it compares directly against every
 * date the database stores. This is what "today" means everywhere in the app.
 */
export function todayInClubTZ(now: Date = new Date(), timeZone: string = CLUB_TIME_ZONE): Date {
  const clock = wallClockIn(now, timeZone);
  return new Date(Date.UTC(clock.year, clock.month - 1, clock.day));
}

/** "HH:MM" -> minutes since midnight, or null if it isn't a time. */
function slotMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Wall-clock minutes since `(date, endTime)` passed — negative when it hasn't yet.
 * Null when `endTime` isn't a time. `date` is read with UTC getters; `endTime` is the
 * club's wall clock.
 *
 * Across a daylight-saving transition a wall-clock day is 23 or 25 hours, so the
 * whole-day term below can be off by an hour for occurrences several days back. That
 * is irrelevant to a boolean tested against an hour of grace, and exactly zero for the
 * same-day case that actually drives the reminder. Do not "fix" this by reaching for
 * date-fns-tz; the imprecision is bounded and deliberate.
 */
export function minutesSinceSlotEnd(
  date: Date,
  endTime: string | null | undefined,
  now: Date = new Date(),
  timeZone: string = CLUB_TIME_ZONE,
): number | null {
  const endMinutes = slotMinutes(endTime);
  if (endMinutes === null) return null;

  const today = todayInClubTZ(now, timeZone);
  const dayDiff = Math.round((today.getTime() - date.getTime()) / MS_PER_DAY);
  const nowMinutes = wallClockIn(now, timeZone).minutes;

  return dayDiff * MINUTES_PER_DAY + nowMinutes - endMinutes;
}

/**
 * Has the slot finished, allowing `graceMinutes` of slack before we say so? A slot with
 * no end time is never considered finished — there is nothing to measure against.
 */
export function hasSlotEnded(
  date: Date,
  endTime: string | null | undefined,
  now: Date = new Date(),
  graceMinutes = 0,
  timeZone: string = CLUB_TIME_ZONE,
): boolean {
  const elapsed = minutesSinceSlotEnd(date, endTime, now, timeZone);
  if (elapsed === null) return false;
  return elapsed >= graceMinutes;
}
