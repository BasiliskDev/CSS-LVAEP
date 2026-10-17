import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { summarize, type StudentSummary } from "@/lib/students";
import { formatDateDisplay } from "@/lib/fiscal-year";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, StatTile } from "@/components/ui";
import { ReassignStudent } from "@/components/reassign-student";
import { getUnassignedStudents } from "@/lib/students";

export const metadata = { title: "Office — TutorLog" };

export default async function AdminPage() {
  const user = await requireAdmin();

  const unassigned = await getUnassignedStudents();

  const tutors = await prisma.user.findMany({
    orderBy: { displayName: "asc" },
    select: {
      id: true,
      displayName: true,
      username: true,
      role: true,
      onboardedAt: true,
      site: { select: { name: true } },
      students: {
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
    },
  });

  const rows = tutors.map((tutor) => {
    const students: StudentSummary[] = tutor.students.map(summarize);
    return {
      ...tutor,
      students,
      totalHours:
        Math.round(students.reduce((sum, s) => sum + s.totalHours, 0) * 100) / 100,
      activeCount: students.filter((s) => s.status === "ACTIVE").length,
      coreAttained: students.reduce((sum, s) => sum + s.coreAttained, 0),
    };
  });

  const orgHours = Math.round(rows.reduce((sum, r) => sum + r.totalHours, 0) * 100) / 100;
  const orgStudents = rows.reduce((sum, r) => sum + r.students.length, 0);
  const orgCore = rows.reduce((sum, r) => sum + r.coreAttained, 0);

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Office</h1>
          <p className="mt-1 text-sm text-muted">
            Every tutor and student on record. Accounts, students and schedules are set up
            from here.
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
        <StatTile label="Core outcomes" value={orgCore} sublabel="Starred goals attained" />
      </div>

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
                  <ReassignStudent
                    studentId={student.id}
                    tutors={rows
                      .filter((tutor) => tutor.onboardedAt)
                      .map((tutor) => ({ id: tutor.id, displayName: tutor.displayName }))}
                  />
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
                    <span className="text-sm font-normal text-muted">
                      @{tutor.username}
                    </span>
                    {tutor.role === "ADMIN" ? <Badge tone="brand">office</Badge> : null}
                    {!tutor.onboardedAt ? (
                      <Badge tone="accent">onboarding incomplete</Badge>
                    ) : null}
                  </span>
                }
                description={`${tutor.site?.name ?? "No site"} · ${tutor.activeCount} active · ${tutor.totalHours} hours`}
              />

              {tutor.students.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">No students yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                        <th className="px-5 py-2 font-medium">Student</th>
                        <th className="px-5 py-2 font-medium">Site</th>
                        <th className="px-5 py-2 text-right font-medium">Hours</th>
                        <th className="px-5 py-2 text-right font-medium">Lessons</th>
                        <th className="px-5 py-2 text-right font-medium">Goals</th>
                        <th className="px-5 py-2 font-medium">Last lesson</th>
                        <th className="px-5 py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {tutor.students.map((student) => (
                        <tr key={student.id} className="hover:bg-surface-2">
                          <td className="px-5 py-2">
                            <Link
                              href={`/admin/students/${student.id}`}
                              className="font-medium text-brand hover:underline"
                            >
                              {student.firstName} {student.lastName}
                            </Link>
                          </td>
                          <td className="px-5 py-2 text-muted">
                            {student.siteName ?? "—"}
                          </td>
                          <td className="px-5 py-2 text-right tabular-nums">
                            {student.totalHours}
                          </td>
                          <td className="px-5 py-2 text-right tabular-nums">
                            {student.lessonCount}
                          </td>
                          <td className="px-5 py-2 text-right tabular-nums">
                            {student.achievementsAttained}
                          </td>
                          <td className="px-5 py-2 text-muted">
                            {student.lastLessonAt
                              ? formatDateDisplay(student.lastLessonAt)
                              : "—"}
                          </td>
                          <td className="px-5 py-2">
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
    </AppShell>
  );
}
