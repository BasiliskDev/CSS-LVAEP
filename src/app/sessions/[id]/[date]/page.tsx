import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SessionLogForm, type SessionLogStudent } from "@/components/session-log-form";
import { Card } from "@/components/ui";
import type { LessonStatus } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatDateDisplay, parseDateInput } from "@/lib/fiscal-year";
import { requireScheduledSession } from "@/lib/guards";
import { isOccurrence } from "@/lib/recurrence";
import { ruleOf } from "@/lib/scheduled-sessions";
import { formatTimeRange, hoursBetween } from "@/lib/time-slot";

export const metadata = { title: "Log session hours — TutorLog" };

export default async function LogSessionPage({ params }: PageProps<"/sessions/[id]/[date]">) {
  const { id, date: dateKey } = await params;
  const { series, user, readOnly } = await requireScheduledSession(id);

  const date = parseDateInput(dateKey);
  // A date that isn't part of this series is a 404, not an error page: the URL shouldn't
  // behave as though some other occurrence might exist there.
  if (!date) notFound();
  if (!isOccurrence(ruleOf(series), date)) {
    notFound();
  }

  const skip = series.skips.find((entry) => entry.date.getTime() === date.getTime());

  // Only students still assigned to the signed-in tutor can be logged here.
  const mine = series.students
    .map((membership) => membership.student)
    .filter((student) => student.tutorId === user.id);

  const existing = await prisma.lesson.findMany({
    where: { scheduledSessionId: id, date },
    select: {
      studentId: true,
      status: true,
      topics: true,
      homeworkAssigned: true,
      homeworkCompleted: true,
      notes: true,
    },
  });
  const loggedByStudent = new Map(existing.map((lesson) => [lesson.studentId, lesson] as const));

  const students: SessionLogStudent[] = mine.map((student) => {
    const logged = loggedByStudent.get(student.id);
    return {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      logged: logged
        ? {
            status: logged.status as LessonStatus,
            topics: logged.topics,
            homeworkAssigned: logged.homeworkAssigned,
            homeworkCompleted: logged.homeworkCompleted,
            notes: logged.notes,
          }
        : null,
    };
  });

  const slotLabel = formatTimeRange(series.startTime, series.endTime);
  const hours = hoursBetween(series.startTime, series.endTime) ?? 0;

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
            ← Back to students
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-ink">
            {series.title ?? "Tutoring session"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {series.site?.name ?? "No site"}
            {readOnly ? ` · Tutor: ${series.tutor.displayName}` : ""}
          </p>
        </div>

        {skip ? (
          <Card className="border-accent/40 bg-accent-soft p-4">
            <p className="text-sm text-accent">
              <strong className="font-semibold">This date was cancelled</strong>
              {skip.reason ? ` — ${skip.reason}` : ""}. There are no hours to log.
            </p>
          </Card>
        ) : readOnly ? (
          <Card className="p-4">
            <p className="text-sm text-muted">
              This session belongs to {series.tutor.displayName}. Only they can log its hours.
            </p>
          </Card>
        ) : students.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-muted">
              None of this session&apos;s students are assigned to you any more, so there is
              nothing to log. The office can reassign them.
            </p>
          </Card>
        ) : (
          <SessionLogForm
            scheduledSessionId={id}
            dateKey={dateKey}
            dateLabel={formatDateDisplay(date)}
            slotLabel={slotLabel}
            hours={hours}
            students={students}
          />
        )}
      </div>
    </AppShell>
  );
}
