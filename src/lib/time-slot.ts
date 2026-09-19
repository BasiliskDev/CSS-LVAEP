/**
 * Time-slot arithmetic for tutoring events.
 *
 * Tutors record a session as "6:00 PM to 7:30 PM", not as "1.5". The slot is what
 * goes on the form; the hours that every total is built from are derived from it.
 *
 * Times are plain "HH:MM" 24-hour strings — exactly what `<input type="time">`
 * produces and consumes. They carry no date and no timezone, so a slot means the
 * same thing regardless of where the server runs.
 */

/** Minutes since midnight, or null if the value isn't a valid "HH:MM". */
export function parseTimeInput(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** "18:30" -> "6:30 PM". Falls back to the raw value if it can't be parsed. */
export function formatTimeDisplay(value: string | null | undefined): string {
  const minutes = parseTimeInput(value);
  if (minutes === null) return value ?? "";
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "6:00 PM – 7:30 PM", or "" when the slot is incomplete. */
export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start || !end) return "";
  return `${formatTimeDisplay(start)} – ${formatTimeDisplay(end)}`;
}

/**
 * Length of a slot in hours, rounded to 2dp.
 *
 * Returns null when either end is unparseable, and for a slot that doesn't move
 * forward: a session ending before it starts is a typo, not an overnight booking,
 * so the caller reports it rather than silently wrapping past midnight.
 */
export function hoursBetween(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const from = parseTimeInput(start);
  const to = parseTimeInput(end);
  if (from === null || to === null) return null;
  if (to <= from) return null;
  return Math.round(((to - from) / 60) * 100) / 100;
}

/** "1 hr 30 min" — how the computed duration reads back to the tutor. */
export function formatDuration(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr${h === 1 ? "" : "s"}`;
  return `${h} hr${h === 1 ? "" : "s"} ${m} min`;
}

/** Shifts a "HH:MM" by whole minutes, clamped to the same day. */
export function addMinutes(value: string, delta: number): string | null {
  const minutes = parseTimeInput(value);
  if (minutes === null) return null;
  const next = Math.min(23 * 60 + 59, Math.max(0, minutes + delta));
  return `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`;
}
