import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/db";
import { requireOnboarded } from "@/lib/guards";
import { getStudentSummaries, hoursThisMonth } from "@/lib/students";
import { fiscalYearLabel } from "@/lib/fiscal-year";
import { DEFAULT_FISCAL_YEAR } from "@/lib/students";
import { StudentCard } from "@/components/student-card";
import { ButtonLink, Card, EmptyState, StatTile } from "@/components/ui";

export const metadata = { title: "Students — TutorLog" };

export default async function DashboardPage() {
  const user = await requireOnboarded();

  const [students, monthHours, profile] = await Promise.all([
    getStudentSummaries(user.id),
    hoursThisMonth(user.id),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { site: { select: { name: true } } },
    }),
  ]);

  const active = students.filter((s) => s.status === "ACTIVE");
  const stopped = students.filter((s) => s.status === "STOPPED");
  // Hours a stopped student logged still count toward the year.
  const fyHours = students.reduce((sum, s) => sum + s.totalHours, 0);

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Your students</h1>
          <p className="mt-1 text-sm text-muted">
            One record per student, as the paper form required.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {students.length > 0 ? (
            <ButtonLink href="/print" variant="secondary">
              Print all forms
            </ButtonLink>
          ) : null}
          <ButtonLink href="/students/new">Add student</ButtonLink>
        </div>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <StatTile label="Active students" value={active.length} />
        <StatTile
          label="Hours this month"
          value={monthHours}
          sublabel="Lessons held, all students"
        />
        <StatTile
          label="Hours this year"
          value={Math.round(fyHours * 100) / 100}
          sublabel={fiscalYearLabel(DEFAULT_FISCAL_YEAR)}
        />
      </div>

      {students.length === 0 ? (
        <Card>
          <EmptyState
            title="No students yet"
            description="Add your first student to start logging lessons and tracking achievements."
            action={<ButtonLink href="/students/new">Add student</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Active ({active.length})
            </h2>
            {active.length === 0 ? (
              <Card>
                <EmptyState title="No active students" />
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {active.map((student) => (
                  <StudentCard key={student.id} student={student} />
                ))}
              </div>
            )}
          </section>

          {stopped.length > 0 ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                Stopped ({stopped.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {stopped.map((student) => (
                  <StudentCard key={student.id} student={student} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <p className="mt-8 text-xs text-faint">
        Tutoring at {profile?.site?.name ?? "no site on file"} ·{" "}
        <Link href="/onboarding" className="underline">
          edit profile
        </Link>
      </p>
    </AppShell>
  );
}
