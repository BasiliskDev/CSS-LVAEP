import "server-only";

import { prisma } from "./db";
import { CORE_CODES } from "./achievements";
import {
  summarizeAttendance,
  fiscalYearStartFor,
  todayUTC,
  totalHeldHours,
  type AttendanceLesson,
} from "./fiscal-year";
import type { LessonStatus } from "./constants";

/** Shared reads used by both the tutor dashboard and the office view. */

export const DEFAULT_FISCAL_YEAR = fiscalYearStartFor(todayUTC());

export type StudentSummary = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  fiscalYearStart: number;
  siteName: string | null;
  days: string | null;
  times: string | null;
  stoppedReason: string | null;
  totalHours: number;
  lessonCount: number;
  lastLessonAt: Date | null;
  achievementsAttained: number;
  coreAttained: number;
};

type StudentWithRelations = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  fiscalYearStart: number;
  days: string | null;
  times: string | null;
  stoppedReason: string | null;
  site: { name: string } | null;
  lessons: Array<{ id: string; date: Date; hours: number; status: string }>;
  achievements: Array<{ code: string; attained: boolean }>;
};

export function summarize(student: StudentWithRelations): StudentSummary {
  const lessons: AttendanceLesson[] = student.lessons.map((l) => ({
    id: l.id,
    date: l.date,
    hours: l.hours,
    status: l.status as LessonStatus,
  }));

  const attained = student.achievements.filter((a) => a.attained);

  return {
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    status: student.status,
    fiscalYearStart: student.fiscalYearStart,
    siteName: student.site?.name ?? null,
    days: student.days,
    times: student.times,
    stoppedReason: student.stoppedReason,
    totalHours: summarizeAttendance(lessons, student.fiscalYearStart).grandTotal,
    lessonCount: student.lessons.length,
    lastLessonAt: lessons.reduce<Date | null>(
      (latest, l) => (!latest || l.date > latest ? l.date : latest),
      null,
    ),
    achievementsAttained: attained.length,
    coreAttained: attained.filter((a) => CORE_CODES.includes(a.code)).length,
  };
}

const SUMMARY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  status: true,
  fiscalYearStart: true,
  days: true,
  times: true,
  stoppedReason: true,
  site: { select: { name: true } },
  lessons: { select: { id: true, date: true, hours: true, status: true } },
  achievements: { select: { code: true, attained: true } },
} as const;

export async function getStudentSummaries(tutorId?: string): Promise<StudentSummary[]> {
  const students = await prisma.student.findMany({
    where: tutorId ? { tutorId } : undefined,
    orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    select: SUMMARY_SELECT,
  });
  return students.map(summarize);
}

/** Held hours logged by a tutor in the current calendar month. */
export async function hoursThisMonth(tutorId: string): Promise<number> {
  const now = todayUTC();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const lessons = await prisma.lesson.findMany({
    where: { student: { tutorId }, date: { gte: start, lt: end } },
    select: { id: true, date: true, hours: true, status: true },
  });

  return totalHeldHours(
    lessons.map((l) => ({ ...l, status: l.status as LessonStatus })),
  );
}
