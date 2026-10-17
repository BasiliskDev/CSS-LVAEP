import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { getOccurrencesBetween } from "@/lib/scheduled-sessions";
import { AbsenceLegend, CalendarMonth } from "@/components/calendar-month";
import { requireOnboarded } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { LESSON_STATUS_META, type LessonStatus } from "@/lib/constants";
import {
  formatDateInput,
  formatMonthParam,
  monthLabel,
  parseMonthParam,
  todayUTC,
} from "@/lib/fiscal-year";
import { formatTimeRange } from "@/lib/time-slot";
import { hasSlotEnded } from "@/lib/club-time";
import { TutorFilter, type TutorOption } from "@/components/tutor-filter";
import { Badge, Card, CardHeader, EmptyState, StatTile, cx } from "@/components/ui";

export const metadata = { title: "Calendar — TutorLog" };

export default async function GlobalCalendarPage({
  searchParams,
}: PageProps<"/calendar">) {
  const user = await requireOnboarded();
  const query = await searchParams;

  const today = todayUTC();
  const requested = parseMonthParam(
    typeof query.month === "string" ? query.month : undefined,
  );
  const { year, month } = requested ?? {
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  };

  // The office sees every tutor's events; a tutor sees only their own students'.
  const isOffice = user.role === "ADMIN";

  // The office chooses whose calendar to read. Tutors are listed even when they have
  // nothing this month: an empty calendar is an answer, not a missing option.
  const tutors = isOffice
    ? await prisma.user.findMany({
        where: { role: "TUTOR" },
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" },
      })
    : [];

  // Resolve the requested tutor against the real list, so an unknown or stale id falls
  // back to "all tutors" rather than rendering an unexplained empty month.
  const requestedTutorId = typeof query.tutor === "string" ? query.tutor : undefined;
  const selectedTutor = tutors.find((tutor) => tutor.id === requestedTutorId) ?? null;

  const calendarHref = (y: number, m: number, tutorId: string | null) =>
    `/calendar?month=${formatMonthParam(y, m)}${tutorId ? `&tutor=${tutorId}` : ""}`;

  // Fetch the whole month in one query rather than per student.
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));

  // One month of lessons for everyone the viewer may see. The office then narrows in
  // memory, which is what lets the tutor pills carry their own counts.
  const allLessons = await prisma.lesson.findMany({
    where: {
      date: { gte: start, lt: end },
      student: isOffice ? undefined : { tutorId: user.id },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      date: true,
      hours: true,
      status: true,
      topics: true,
      startTime: true,
      endTime: true,
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          tutor: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  const lessons = selectedTutor
    ? allLessons.filter((lesson) => lesson.student.tutor?.id === selectedTutor.id)
    : allLessons;

  const monthHours =
    Math.round(
      lessons
        .filter((l) => LESSON_STATUS_META[l.status as LessonStatus].countsAsHours)
        .reduce((sum, l) => sum + l.hours, 0) * 100,
    ) / 100;

  // Per-student totals for the month, most hours first.
  const perStudent = new Map<
    string,
    { id: string; name: string; tutor: string; hours: number; events: number }
  >();
  for (const lesson of lessons) {
    const key = lesson.student.id;
    const row = perStudent.get(key) ?? {
      id: key,
      name: `${lesson.student.firstName} ${lesson.student.lastName}`,
      tutor: lesson.student.tutor?.displayName ?? "Unassigned",
      hours: 0,
      events: 0,
    };
    row.events += 1;
    if (LESSON_STATUS_META[lesson.status as LessonStatus].countsAsHours) {
      row.hours = Math.round((row.hours + lesson.hours) * 100) / 100;
    }
    perStudent.set(key, row);
  }
  const students = [...perStudent.values()].sort((a, b) => b.hours - a.hours);

  const byDate = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const key = formatDateInput(lesson.date);
    byDate.set(key, [...(byDate.get(key) ?? []), lesson]);
  }

  // Scheduled sessions the office has set up, so the calendar shows what is *meant* to
  // happen as well as what was logged. A date with neither is genuinely empty.
  const allOccurrences = await getOccurrencesBetween({
    start,
    end,
    tutorId: isOffice ? undefined : user.id,
  });

  const occurrences = selectedTutor
    ? allOccurrences.filter((occurrence) => occurrence.tutorId === selectedTutor.id)
    : allOccurrences;

  // Per-tutor backlog for the pills: only sessions whose slot has already passed count,
  // so a series scheduled later this month doesn't read as overdue.
  const toLogByTutor = new Map<string, number>();
  for (const occurrence of allOccurrences) {
    if (occurrence.skipped) continue;
    if (!hasSlotEnded(occurrence.date, occurrence.endTime)) continue;
    const missing = occurrence.students.length - occurrence.loggedStudentIds.length;
    if (missing > 0) {
      toLogByTutor.set(
        occurrence.tutorId,
        (toLogByTutor.get(occurrence.tutorId) ?? 0) + missing,
      );
    }
  }

  const tutorOptions: TutorOption[] = tutors.map((tutor) => ({
    ...tutor,
    toLog: toLogByTutor.get(tutor.id) ?? 0,
  }));

  const occurrencesByDate = new Map<string, typeof occurrences>();
  for (const occurrence of occurrences) {
    const list = occurrencesByDate.get(occurrence.dateKey) ?? [];
    list.push(occurrence);
    occurrencesByDate.set(occurrence.dateKey, list);
  }

  const dateKeys = new Set([...byDate.keys(), ...occurrencesByDate.keys()]);

  const chipsByDate = new Map(
    [...dateKeys].map((date) => [
      date,
      <div key={date} className="space-y-1">
      <ul className="space-y-1">
        {(byDate.get(date) ?? []).map((lesson) => {
          const meta = LESSON_STATUS_META[lesson.status as LessonStatus];
          const held = lesson.status === "HELD";
          const name = `${lesson.student.firstName} ${lesson.student.lastName.charAt(0)}.`;
          return (
            <li key={lesson.id}>
              <Link
                href={`/students/${lesson.student.id}/attendance?view=calendar&month=${formatMonthParam(year, month)}`}
                title={[
                  `${lesson.student.firstName} ${lesson.student.lastName}`,
                  formatTimeRange(lesson.startTime, lesson.endTime),
                  held ? `${lesson.hours} h` : meta.label,
                  lesson.topics,
                  isOffice ? `Tutor: ${lesson.student.tutor?.displayName ?? "Unassigned"}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                className={cx(
                  "block truncate rounded px-1.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-80",
                  held
                    ? "bg-brand text-white"
                    : "bg-accent-soft text-accent ring-1 ring-accent/30",
                )}
              >
                {held ? `${lesson.hours} h` : meta.code} · {name}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Scheduled but not yet logged: outlined rather than filled, so a glance tells
          you which sessions still owe hours. */}
      <ul className="space-y-1">
        {(occurrencesByDate.get(date) ?? [])
          .filter((occurrence) => occurrence.loggedStudentIds.length < occurrence.students.length)
          .map((occurrence) => {
            const missing = occurrence.students.length - occurrence.loggedStudentIds.length;
            const label = occurrence.title ?? `${missing} to log`;
            return (
              <li key={`${occurrence.seriesId}-${occurrence.dateKey}`}>
                <Link
                  href={
                    occurrence.skipped
                      ? `/admin/sessions/${occurrence.seriesId}`
                      : `/sessions/${occurrence.seriesId}/${occurrence.dateKey}`
                  }
                  title={[
                    formatTimeRange(occurrence.startTime, occurrence.endTime),
                    occurrence.skipped
                      ? `Cancelled${occurrence.skipReason ? `: ${occurrence.skipReason}` : ""}`
                      : `${missing} of ${occurrence.students.length} still to log`,
                    occurrence.students
                      .map((student) => `${student.firstName} ${student.lastName}`)
                      .join(", "),
                    isOffice ? `Tutor: ${occurrence.tutorName}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  className={cx(
                    "block truncate rounded border border-dashed px-1.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-80",
                    occurrence.skipped
                      ? "border-line-strong text-faint line-through"
                      : "border-brand/50 text-brand",
                  )}
                >
                  {occurrence.skipped ? "cancelled" : label}
                </Link>
              </li>
            );
          })}
      </ul>
      </div>,
    ]),
  );

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">
          {selectedTutor ? selectedTutor.displayName : "Calendar"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {selectedTutor
            ? "Their scheduled sessions and the hours they have logged."
            : isOffice
              ? "Every tutoring event on record, across all tutors."
              : "Every tutoring event across all of your students."}
        </p>
      </div>

      {isOffice ? (
        <TutorFilter
          tutors={tutorOptions}
          selectedId={selectedTutor?.id ?? null}
          hrefFor={(tutorId) => calendarHref(year, month, tutorId)}
        />
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Hours this month"
          value={monthHours}
          sublabel={monthLabel(year, month)}
        />
        <StatTile label="Events" value={lessons.length} />
        <StatTile label="Students seen" value={students.length} />
      </div>

      <CalendarMonth
        year={year}
        month={month}
        monthHref={(y, m) => calendarHref(y, m, selectedTutor?.id ?? null)}
        chipsByDate={chipsByDate}
        summary={
          <span className="text-sm text-muted">
            <span className="font-semibold tabular-nums text-ink">{monthHours}</span>{" "}
            hours this month
          </span>
        }
        legend={
          <>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-brand/60" />{" "}
              scheduled, not logged
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" /> hours
              tutored
            </span>
            <AbsenceLegend />
            <span>Click an event to open that student.</span>
          </>
        }
      />

      <div className="mt-6">
        <Card>
          <CardHeader
            title={`Students this month · ${monthLabel(year, month)}`}
            description="Hours logged per student, most first."
          />
          {students.length === 0 ? (
            <EmptyState
              title="No events this month"
              description="Use the arrows above to look at another month, or open a student to log an event."
            />
          ) : (
            <ul className="divide-y divide-line">
              {students.map((student) => (
                <li key={student.id}>
                  <Link
                    href={`/students/${student.id}/attendance`}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-ink">{student.name}</span>
                      {isOffice && !selectedTutor ? (
                        <span className="ml-2 text-xs text-muted">{student.tutor}</span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-3 text-sm text-muted">
                      <span>
                        {student.events} event{student.events === 1 ? "" : "s"}
                      </span>
                      <Badge tone="brand">{student.hours} h</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
