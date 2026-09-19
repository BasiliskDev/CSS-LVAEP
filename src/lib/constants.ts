import { z } from "zod";

/** SQLite has no enums, so these unions are the source of truth for the String columns. */

export const USER_ROLES = ["TUTOR", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];
export const userRoleSchema = z.enum(USER_ROLES);

export const STUDENT_STATUSES = ["ACTIVE", "STOPPED"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];
export const studentStatusSchema = z.enum(STUDENT_STATUSES);

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
