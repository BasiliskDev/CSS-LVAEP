import Link from "next/link";

import { AppShell } from "@/components/app-shell";
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

  // Fetch the whole month in one query rather than per student.
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));

  const lessons = await prisma.lesson.findMany({
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
          tutor: { select: { displayName: true } },
        },
      },
    },
  });

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
      tutor: lesson.student.tutor.displayName,
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

  const chipsByDate = new Map(
    [...byDate].map(([date, items]) => [
      date,
      <ul key={date} className="space-y-1">
        {items.map((lesson) => {
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
                  isOffice ? `Tutor: ${lesson.student.tutor.displayName}` : null,
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
      </ul>,
    ]),
  );

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Calendar</h1>
        <p className="mt-1 text-sm text-muted">
          {isOffice
            ? "Every tutoring event on record, across all tutors."
            : "Every tutoring event across all of your students."}
        </p>
      </div>

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
        monthHref={(y, m) => `/calendar?month=${formatMonthParam(y, m)}`}
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
                      {isOffice ? (
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
