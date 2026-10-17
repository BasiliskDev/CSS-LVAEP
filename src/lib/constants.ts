import { z } from "zod";

/** SQLite has no enums, so these unions are the source of truth for the String columns. */

export const USER_ROLES = ["TUTOR", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const userRoleSchema = z.enum(USER_ROLES);

export const LESSON_STATUSES = [
  "HELD",
  "TUTOR_ABSENT",
  "STUDENT_ABSENT",
  "HOLIDAY",
] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];
export const lessonStatusSchema = z.enum(LESSON_STATUSES);

/**
 * The paper form's internal codes, printed in its own legend:
 * "TA: Tutor Absent  SA: Student Absent  H: Holiday".
 */
export const LESSON_STATUS_META: Record<
  LessonStatus,
  { code: string; label: string; countsAsHours: boolean }
> = {
  HELD: { code: "", label: "Lesson held", countsAsHours: true },
  TUTOR_ABSENT: { code: "TA", label: "Tutor absent", countsAsHours: false },
  STUDENT_ABSENT: { code: "SA", label: "Student absent", countsAsHours: false },
  HOLIDAY: { code: "H", label: "Holiday", countsAsHours: false },
};

export const SESSION_COOKIE = "session";
export const SESSION_TTL_DAYS = 30;

/**
 * The club is in New Jersey, so every "HH:MM" in the app — a lesson's time slot, a
 * scheduled session's slot — is this timezone's wall clock. Dates are stored as UTC
 * midnight; src/lib/club-time.ts is the only place the two meet.
 */
export const CLUB_TIME_ZONE = "America/New_York";

/** How long an invite link stays usable. */
export const INVITE_TTL_DAYS = 7;
