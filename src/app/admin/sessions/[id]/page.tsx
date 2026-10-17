import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card } from "@/components/ui";
import { hasSlotEnded } from "@/lib/club-time";
import { prisma } from "@/lib/db";
import { formatDateDisplay, formatDateInput } from "@/lib/fiscal-year";
import { requireAdmin } from "@/lib/guards";
import { weeklyOccurrences } from "@/lib/recurrence";
import { formatTimeRange } from "@/lib/time-slot";
import {
  archiveScheduledSessionAction,
  restoreScheduledSessionAction,
} from "../actions";
import { OccurrenceList, type OccurrenceRow } from "./occurrence-list";
import { SessionForm, type SessionDraft, type SessionTutor } from "../session-form";

export const metadata = { title: "Session — TutorLog" };

const WEEKDAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

export default async function AdminSessionPage({ params }: PageProps<"/admin/sessions/[id]">) {
  const user = await requireAdmin();
  const { id } = await params;

  const session = await prisma.scheduledSession.findUnique({
    where: { id },
    include: {
      tutor: { select: { id: true, displayName: true } },
      site: { select: { name: true } },
      students: { select: { studentId: true } },
      skips: { select: { date: true, reason: true } },
    },
  });
  if (!session) notFound();

  const [tutorRows, sites, lessons] = await Promise.all([
    prisma.user.findMany({
      where: { onboardedAt: { not: null } },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        siteId: true,
        students: {
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: { id: true, firstName: true, lastName: true, status: true },
        },
      },
    }),
    prisma.site.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.lesson.findMany({
      where: { scheduledSessionId: id },
      select: { date: true, studentId: true },
    }),
  ]);

  const tutors: SessionTutor[] = tutorRows;

  const skips = new Map(
    session.skips.map((skip) => [formatDateInput(skip.date), skip.reason] as const),
  );
  const loggedPerDate = new Map<string, number>();
  for (const lesson of lessons) {
    const key = formatDateInput(lesson.date);
    loggedPerDate.set(key, (loggedPerDate.get(key) ?? 0) + 1);
  }

  const occurrences: OccurrenceRow[] = weeklyOccurrences({
    weekday: session.weekday,
    startsOn: session.startsOn,
    endsOn: session.endsOn,
  }).map((date) => {
    const dateKey = formatDateInput(date);
    return {
      dateKey,
      label: formatDateDisplay(date),
      skipped: skips.has(dateKey),
      skipReason: skips.get(dateKey) ?? null,
      loggedCount: loggedPerDate.get(dateKey) ?? 0,
      studentCount: session.students.length,
      // Only a slot that has actually finished in club time counts as owing hours.
      past: hasSlotEnded(date, session.endTime),
    };
  });

  const draft: SessionDraft = {
    id: session.id,
    tutorId: session.tutorId,
    title: session.title,
    weekday: session.weekday,
    startTime: session.startTime,
    endTime: session.endTime,
    startsOn: formatDateInput(session.startsOn),
    endsOn: formatDateInput(session.endsOn),
    siteId: session.siteId,
    notes: session.notes,
    studentIds: session.students.map((membership) => membership.studentId),
  };

  const archived = session.status !== "ACTIVE";

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <Link href="/admin/sessions" className="text-sm text-muted hover:text-ink">
          ← All sessions
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink">
            {session.title ?? `${WEEKDAY_NAMES[session.weekday]} with ${session.tutor.displayName}`}
          </h1>
          {archived ? <Badge tone="neutral">Archived</Badge> : <Badge tone="positive">Active</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {WEEKDAY_NAMES[session.weekday]} {formatTimeRange(session.startTime, session.endTime)} ·{" "}
          {session.tutor.displayName} · {session.site?.name ?? "No site"}
        </p>
      </div>

      <Card className="mb-6 p-4">
        <p className="text-xs text-muted">
          Changing the slot or the dates does <strong>not</strong> rewrite hours already
          logged — those keep the times they were recorded with, because the paper record
          mustn&apos;t move retroactively. Dates below will simply be measured against the
          new slot from now on.
        </p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <SessionForm tutors={tutors} sites={sites} session={draft} />
        <OccurrenceList scheduledSessionId={session.id} occurrences={occurrences} />
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-3 p-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">
              {archived ? "Bring this session back" : "Archive this session"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {archived
                ? "It will start appearing on the calendar and in reminders again."
                : "It stops appearing on calendars and in reminders. Logged hours are kept either way — sessions are never deleted."}
            </p>
          </div>
          <form
            action={
              archived
                ? restoreScheduledSessionAction.bind(null, session.id)
                : archiveScheduledSessionAction.bind(null, session.id)
            }
            className="ml-auto"
          >
            <Button type="submit" variant={archived ? "secondary" : "danger"}>
              {archived ? "Restore session" : "Archive session"}
            </Button>
          </form>
        </div>
      </Card>
    </AppShell>
  );
}
