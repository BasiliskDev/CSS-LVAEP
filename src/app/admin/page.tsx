import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ReassignStudent } from "@/components/reassign-student";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, StatTile } from "@/components/ui";
import { hasSlotEnded } from "@/lib/club-time";
import { prisma } from "@/lib/db";
import { formatDateDisplay, formatDateInput, formatWeekdays, todayUTC } from "@/lib/fiscal-year";
import { requireAdmin } from "@/lib/guards";
import { addDaysUTC, occurrencesBetween, weeklyOccurrences } from "@/lib/recurrence";
import { getUnassignedStudents, summarize, type StudentSummary } from "@/lib/students";
import { formatTimeRange } from "@/lib/time-slot";

export const metadata = { title: "Office — TutorLog" };

/**
 * The office's control panel: who tutors, what they are scheduled to run, and whether
 * the hours have come in.
 *
 * The office keeps no students of its own — it assigns them — so only TUTOR accounts
 * get a caseload here. Office accounts are listed separately at the bottom, as
 * accounts rather than as tutors with an empty roster.
 */
export default async function AdminPage() {
  const user = await requireAdmin();
  const today = todayUTC();

  const [unassigned, people] = await Promise.all([
    getUnassignedStudents(),
    prisma.user.findMany({
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        username: true,
        role: true,
        email: true,
        onboardedAt: true,
        site: { select: { name: true } },
        students: {
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: {
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
          },
        },
        scheduledSessions: {
          where: { status: "ACTIVE" },
          orderBy: [{ startTime: "asc" }, { startsOn: "asc" }],
          select: {
            id: true,
            title: true,
            weekdays: true,
            startTime: true,
            endTime: true,
            startsOn: true,
            endsOn: true,
            site: { select: { name: true } },
            students: {
              select: { student: { select: { id: true, firstName: true, lastName: true } } },
            },
            skips: { select: { date: true } },
            lessons: { select: { studentId: true, date: true } },
          },
        },
      },
    }),
  ]);

  const tutorAccounts = people.filter((person) => person.role === "TUTOR");
  const office = people.filter((person) => person.role !== "TUTOR");

  // An office account should never hold students. If one does — assigned before this
  // rule existed — say so rather than hiding it, since nothing else on this page would
  // reveal that caseload.
  const officeWithStudents = office.filter((person) => person.students.length > 0);

  const rows = tutorAccounts.map((tutor) => {
    const students: StudentSummary[] = tutor.students.map(summarize);

    const sessions = tutor.scheduledSessions.map((session) => {
      const rule = { weekdays: session.weekdays, startsOn: session.startsOn, endsOn: session.endsOn };
      const skipped = new Set(session.skips.map((skip) => formatDateInput(skip.date)));
      const logged = new Set(
        session.lessons.map((lesson) => `${formatDateInput(lesson.date)}|${lesson.studentId}`),
      );

      // Dates whose slot has passed that nobody has logged hours against.
      const awaiting = weeklyOccurrences(rule).filter((date) => {
        const key = formatDateInput(date);
        if (skipped.has(key)) return false;
        if (!hasSlotEnded(date, session.endTime)) return false;
        return session.students.some(
          (membership) => !logged.has(`${key}|${membership.student.id}`),
        );
      });

      const [next] = occurrencesBetween(rule, today, addDaysUTC(today, 366));

      return {
        id: session.id,
        weekdays: session.weekdays,
        startTime: session.startTime,
        endTime: session.endTime,
        students: session.students.map((membership) => membership.student),
        awaiting: awaiting.length,
        next: next ?? null,
      };
    });

    return {
      ...tutor,
      students,
      sessions,
      totalHours: Math.round(students.reduce((sum, s) => sum + s.totalHours, 0) * 100) / 100,
      activeCount: students.filter((s) => s.status === "ACTIVE").length,
      awaiting: sessions.reduce((sum, s) => sum + s.awaiting, 0),
    };
  });

  const orgHours = Math.round(rows.reduce((sum, r) => sum + r.totalHours, 0) * 100) / 100;
  const orgStudents = rows.reduce((sum, r) => sum + r.students.length, 0);
  const orgSessions = rows.reduce((sum, r) => sum + r.sessions.length, 0);
  const orgAwaiting = rows.reduce((sum, r) => sum + r.awaiting, 0);

  const assignableTutors = rows
    .filter((tutor) => tutor.onboardedAt)
    .map((tutor) => ({ id: tutor.id, displayName: tutor.displayName }));

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Office</h1>
          <p className="mt-1 text-sm text-muted">
            Every tutor, what they are scheduled to run, and whether the hours have come in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/sessions" variant="secondary">
            Schedule sessions
          </ButtonLink>
          <ButtonLink href="/admin/invites" variant="secondary">
            Invite a tutor
          </ButtonLink>
          <ButtonLink href="/admin/students/new">Add student</ButtonLink>
        </div>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-4">
        <StatTile label="Tutors" value={rows.length} />
        <StatTile label="Students" value={orgStudents} />
        <StatTile label="Hours logged" value={orgHours} />
        <StatTile
          label="Student events"
          value={orgSessions}
          sublabel={orgAwaiting > 0 ? `${orgAwaiting} awaiting hours` : "all hours in"}
        />
      </div>

      {officeWithStudents.length > 0 ? (
        <Card className="mb-8 border-danger/40 bg-danger-soft p-4">
          <p className="text-sm text-danger">
            <strong className="font-semibold">An office account is holding students.</strong>{" "}
            {officeWithStudents
              .map((person) => `${person.displayName} (${person.students.length})`)
              .join(", ")}
            . The office assigns students rather than keeping them — open each student and
            reassign them to a tutor.
          </p>
        </Card>
      ) : null}

      {unassigned.length > 0 ? (
        <Card className="mb-8 border-accent/40">
          <CardHeader
            title={
              <span className="flex flex-wrap items-center gap-2">
                Unassigned students
                <Badge tone="accent">{unassigned.length}</Badge>
              </span>
            }
            description="Handed back by a tutor, or never assigned. Every hour and goal is intact — pick someone to take them on."
          />
          <ul className="divide-y divide-line">
            {unassigned.map((student) => (
              <li key={student.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                <div className="min-w-0">
                  <Link
                    href={`/students/${student.id}`}
                    className="font-medium text-ink hover:text-brand"
                  >
                    {student.firstName} {student.lastName}
                  </Link>
                  <p className="text-xs text-muted">
                    {student.totalHours} hours · {student.lessonCount} events ·{" "}
                    {student.achievementsAttained} goals
                    {student.removedByName
                      ? ` · Removed by ${student.removedByName}${
                          student.removedAt ? ` on ${formatDateDisplay(student.removedAt)}` : ""
                        }`
                      : ""}
                  </p>
                  {student.removedReason ? (
                    <p className="text-xs text-faint">“{student.removedReason}”</p>
                  ) : null}
                </div>
                <div className="ml-auto">
                  <ReassignStudent studentId={student.id} tutors={assignableTutors} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No tutors yet"
            description="Invite one and the account appears here once they accept."
            action={<ButtonLink href="/admin/invites">Invite a tutor</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((tutor) => (
            <Card key={tutor.id}>
              <CardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {tutor.displayName}
                    <span className="text-sm font-normal text-muted">@{tutor.username}</span>
                    {!tutor.onboardedAt ? (
                      <Badge tone="accent">onboarding incomplete</Badge>
                    ) : null}
                    {tutor.awaiting > 0 ? (
                      <Badge tone="danger">
                        {tutor.awaiting} awaiting hours
                      </Badge>
                    ) : null}
                  </span>
                }
                description={`${tutor.site?.name ?? "No site"} · ${tutor.activeCount} active · ${tutor.totalHours} hours`}
                action={
                  <ButtonLink
                    href={`/calendar?tutor=${tutor.id}`}
                    variant="secondary"
                    size="sm"
                  >
                    View calendar
                  </ButtonLink>
                }
              />

              {/* Student events — the schedule the office owns. */}
              <div className="border-b border-line px-5 py-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Student events
                </h3>
                {tutor.sessions.length === 0 ? (
                  <p className="text-sm text-muted">
                    Nothing scheduled.{" "}
                    <Link href="/admin/sessions" className="font-medium text-brand hover:underline">
                      Schedule a session
                    </Link>
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {tutor.sessions.map((session) => (
                      <li key={session.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <Link
                          href={`/admin/sessions/${session.id}`}
                          className="text-sm font-medium text-ink hover:text-brand"
                        >
                          {formatWeekdays(session.weekdays)}{" "}
                          {formatTimeRange(session.startTime, session.endTime)}
                        </Link>
                        <span className="text-sm text-muted">
                          {session.students.length === 0
                            ? "no students"
                            : session.students
                                .map((student) => `${student.firstName} ${student.lastName}`)
                                .join(", ")}
                        </span>
                        {session.awaiting > 0 ? (
                          <Badge tone="danger">{session.awaiting} unlogged</Badge>
                        ) : null}
                        <span className="ml-auto text-xs text-faint">
                          {session.next ? `next ${formatDateDisplay(session.next)}` : "finished"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {tutor.students.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">No students assigned yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-5 py-2 font-medium">Student</th>
                        <th className="px-5 py-2 font-medium">Site</th>
                        <th className="px-5 py-2 font-medium">Hours</th>
                        <th className="px-5 py-2 font-medium">Events</th>
                        <th className="px-5 py-2 font-medium">Goals</th>
                        <th className="px-5 py-2 font-medium">Last event</th>
                        <th className="px-5 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {tutor.students.map((student) => (
                        <tr key={student.id}>
                          <td className="px-5 py-2.5">
                            <Link
                              href={`/students/${student.id}`}
                              className="font-medium text-ink hover:text-brand"
                            >
                              {student.firstName} {student.lastName}
                            </Link>
                          </td>
                          <td className="px-5 py-2.5 text-muted">{student.siteName ?? "—"}</td>
                          <td className="px-5 py-2.5 tabular-nums">{student.totalHours}</td>
                          <td className="px-5 py-2.5 tabular-nums">{student.lessonCount}</td>
                          <td className="px-5 py-2.5 tabular-nums">
                            {student.achievementsAttained}
                          </td>
                          <td className="px-5 py-2.5 text-muted">
                            {student.lastLessonAt ? formatDateDisplay(student.lastLessonAt) : "—"}
                          </td>
                          <td className="px-5 py-2.5">
                            {student.status === "STOPPED" ? (
                              <Badge tone="danger">Stopped</Badge>
                            ) : (
                              <Badge tone="positive">Active</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {office.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Office accounts ({office.length})
          </h2>
          <Card>
            <ul className="divide-y divide-line">
              {office.map((person) => (
                <li key={person.id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
                  <span className="font-medium text-ink">{person.displayName}</span>
                  <span className="text-muted">@{person.username}</span>
                  {person.email ? <span className="text-xs text-faint">{person.email}</span> : null}
                  <Badge tone="brand">office</Badge>
                  {person.id === user.id ? <Badge>you</Badge> : null}
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3 text-xs text-muted">
              Office accounts schedule sessions and assign students; they never keep students
              of their own.
            </p>
          </Card>
        </section>
      ) : null}
    </AppShell>
  );
}
