import "server-only";

import { prisma } from "./db";
import { PENDING_LOOKBACK_DAYS, missingOccurrences, pendingKey, type PendingOccurrence } from "./pending-sessions";
import { addDaysUTC, occurrencesBetween, type WeeklyRule } from "./recurrence";
import { todayInClubTZ } from "./club-time";
import { formatDateInput } from "./fiscal-year";

/** Database reads for scheduled sessions, shared by the office pages and the reminder. */

export type OccurrenceStudent = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  /** Null once a tutor has handed them back, so the UI can stop offering to log them. */
  tutorId: string | null;
};

/** One session occurrence with everything a screen needs to render it. */
export type Occurrence = {
  seriesId: string;
  title: string | null;
  date: Date;
  dateKey: string;
  startTime: string;
  endTime: string;
  tutorId: string;
  tutorName: string;
  siteName: string | null;
  students: OccurrenceStudent[];
  skipped: boolean;
  skipReason: string | null;
  /** Student ids with a lesson already logged against this occurrence. */
  loggedStudentIds: string[];
};

const SERIES_INCLUDE = {
  tutor: { select: { id: true, displayName: true } },
  site: { select: { name: true } },
  students: {
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true, status: true, tutorId: true },
      },
    },
    orderBy: { createdAt: "asc" },
  },
  skips: { select: { date: true, reason: true } },
} as const;

function ruleOf(series: { weekday: number; startsOn: Date; endsOn: Date }): WeeklyRule {
  return { weekday: series.weekday, startsOn: series.startsOn, endsOn: series.endsOn };
}

/**
 * Every occurrence of every active session inside a window, flattened and sorted.
 * `tutorId` scopes it to one tutor; the office passes nothing and sees everyone.
 */
export async function getOccurrencesBetween(args: {
  start: Date;
  end: Date;
  tutorId?: string;
}): Promise<Occurrence[]> {
  const { start, end, tutorId } = args;

  const series = await prisma.scheduledSession.findMany({
    where: {
      status: "ACTIVE",
      tutorId,
      // Only series whose range can possibly overlap the window.
      startsOn: { lt: end },
      endsOn: { gte: start },
    },
    include: SERIES_INCLUDE,
  });

  if (series.length === 0) return [];

  const lessons = await prisma.lesson.findMany({
    where: {
      scheduledSessionId: { in: series.map((entry) => entry.id) },
      date: { gte: start, lt: end },
    },
    select: { scheduledSessionId: true, studentId: true, date: true },
  });

  const logged = new Set(
    lessons.map((lesson) =>
      pendingKey(lesson.scheduledSessionId!, formatDateInput(lesson.date), lesson.studentId),
    ),
  );

  const occurrences: Occurrence[] = [];

  for (const entry of series) {
    const skips = new Map(
      entry.skips.map((skip) => [formatDateInput(skip.date), skip.reason] as const),
    );
    const students = entry.students.map((membership) => membership.student);

    for (const date of occurrencesBetween(ruleOf(entry), start, end)) {
      const dateKey = formatDateInput(date);
      occurrences.push({
        seriesId: entry.id,
        title: entry.title,
        date,
        dateKey,
        startTime: entry.startTime,
        endTime: entry.endTime,
        tutorId: entry.tutor.id,
        tutorName: entry.tutor.displayName,
        siteName: entry.site?.name ?? null,
        students,
        skipped: skips.has(dateKey),
        skipReason: skips.get(dateKey) ?? null,
        loggedStudentIds: students
          .filter((student) => logged.has(pendingKey(entry.id, dateKey, student.id)))
          .map((student) => student.id),
      });
    }
  }

  return occurrences.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime),
  );
}

export type PendingSession = PendingOccurrence & {
  title: string | null;
  startTime: string;
  endTime: string;
  students: Array<{ id: string; firstName: string; lastName: string }>;
};

/**
 * Finished sessions this tutor still owes hours for. The decision itself lives in the
 * pure `missingOccurrences`; this only assembles its inputs and labels its output.
 */
export async function getPendingSessions(tutorId: string, now = new Date()): Promise<PendingSession[]> {
  const windowStart = addDaysUTC(todayInClubTZ(now), -PENDING_LOOKBACK_DAYS);

  const series = await prisma.scheduledSession.findMany({
    where: { tutorId, status: "ACTIVE", endsOn: { gte: windowStart } },
    include: SERIES_INCLUDE,
  });

  if (series.length === 0) return [];

  const lessons = await prisma.lesson.findMany({
    where: {
      scheduledSessionId: { in: series.map((entry) => entry.id) },
      date: { gte: windowStart },
    },
    select: { scheduledSessionId: true, studentId: true, date: true },
  });

  const loggedKeys = new Set(
    lessons.map((lesson) =>
      pendingKey(lesson.scheduledSessionId!, formatDateInput(lesson.date), lesson.studentId),
    ),
  );

  const skippedKeys = new Set(
    series.flatMap((entry) =>
      entry.skips.map((skip) => pendingKey(entry.id, formatDateInput(skip.date))),
    ),
  );

  const pending = missingOccurrences({
    series: series.map((entry) => ({
      id: entry.id,
      weekday: entry.weekday,
      startTime: entry.startTime,
      endTime: entry.endTime,
      startsOn: entry.startsOn,
      endsOn: entry.endsOn,
      // Don't chase a student who stopped, or who the tutor has already handed back.
      studentIds: entry.students
        .filter(
          (membership) =>
            membership.student.status === "ACTIVE" && membership.student.tutorId === tutorId,
        )
        .map((membership) => membership.studentId),
    })),
    loggedKeys,
    skippedKeys,
    windowStart,
    now,
  });

  const byId = new Map(series.map((entry) => [entry.id, entry] as const));

  return pending.map((occurrence) => {
    const entry = byId.get(occurrence.seriesId)!;
    const names = new Map(
      entry.students.map((membership) => [membership.studentId, membership.student] as const),
    );
    return {
      ...occurrence,
      title: entry.title,
      startTime: entry.startTime,
      endTime: entry.endTime,
      students: occurrence.missingStudentIds.map((id) => {
        const student = names.get(id)!;
        return { id, firstName: student.firstName, lastName: student.lastName };
      }),
    };
  });
}
