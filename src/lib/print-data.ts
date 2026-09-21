import "server-only";

import { prisma } from "./db";
import { isCustomCode } from "./achievements";
import { summarizeAttendance } from "./fiscal-year";
import type { LessonStatus } from "./constants";

/** Everything one printed form needs, assembled in a single pass. */
export async function getPrintableStudents(where: { id?: string; tutorId?: string }) {
  const students = await prisma.student.findMany({
    where: {
      ...(where.id ? { id: where.id } : {}),
      ...(where.tutorId ? { tutorId: where.tutorId } : {}),
    },
    orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    include: {
      site: { select: { name: true } },
      tutor: { select: { displayName: true } },
      lessons: { select: { id: true, date: true, hours: true, status: true } },
      achievements: {
        select: { code: true, label: true, attained: true },
        orderBy: { code: "asc" },
      },
    },
  });

  return students.map((student) => ({
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      fiscalYearStart: student.fiscalYearStart,
      days: student.days,
      times: student.times,
      status: student.status,
      stoppedReason: student.stoppedReason,
    },
    tutorName: student.tutor.displayName,
    siteName: student.site?.name ?? null,
    summary: summarizeAttendance(
      student.lessons.map((l) => ({
        id: l.id,
        date: l.date,
        hours: l.hours,
        status: l.status as LessonStatus,
      })),
      student.fiscalYearStart,
    ),
    attained: new Set(
      student.achievements.filter((a) => a.attained).map((a) => a.code),
    ),
    customGoals: student.achievements
      .filter((a) => isCustomCode(a.code))
      .map((a) => ({ code: a.code, label: a.label, attained: a.attained })),
  }));
}
