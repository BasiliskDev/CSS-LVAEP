import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDateDisplay } from "@/lib/fiscal-year";
import { requireAdmin } from "@/lib/guards";
import { countOccurrences } from "@/lib/recurrence";
import { formatTimeRange } from "@/lib/time-slot";
import { NewSessionPanel } from "./new-session-panel";
import type { SessionTutor } from "./session-form";

export const metadata = { title: "Sessions — TutorLog" };

const WEEKDAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

export default async function AdminSessionsPage() {
  const user = await requireAdmin();

  const [tutorRows, sites, sessions] = await Promise.all([
    prisma.user.findMany({
      // Tutors only: the office keeps the records, it does not keep students.
      where: { role: "TUTOR", onboardedAt: { not: null } },
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
    prisma.scheduledSession.findMany({
      orderBy: [{ status: "asc" }, { weekday: "asc" }, { startTime: "asc" }],
      include: {
        tutor: { select: { displayName: true } },
        site: { select: { name: true } },
        students: { select: { studentId: true } },
        _count: { select: { skips: true, lessons: true } },
      },
    }),
  ]);

  const tutors: SessionTutor[] = tutorRows;
  const active = sessions.filter((session) => session.status === "ACTIVE");
  const archived = sessions.filter((session) => session.status !== "ACTIVE");

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Sessions</h1>
          <p className="mt-1 text-sm text-muted">
            Who tutors whom, and when. Tutors log hours against these; they can&apos;t
            create them.
          </p>
        </div>
        <NewSessionPanel tutors={tutors} sites={sites} />
      </div>

      {active.length === 0 ? (
        <Card>
          <EmptyState
            title="Nothing scheduled yet"
            description="Create a weekly session and it appears on the tutor's calendar straight away."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {active.map((session) => {
            const occurrences = countOccurrences({
              weekday: session.weekday,
              startsOn: session.startsOn,
              endsOn: session.endsOn,
            });

            return (
              <Card key={session.id}>
                <CardHeader
                  title={
                    <Link href={`/admin/sessions/${session.id}`} className="hover:text-brand">
                      {session.title ?? `${WEEKDAY_NAMES[session.weekday]} with ${session.tutor.displayName}`}
                    </Link>
                  }
                  description={`${WEEKDAY_NAMES[session.weekday]} ${formatTimeRange(session.startTime, session.endTime)} · ${formatDateDisplay(session.startsOn)} – ${formatDateDisplay(session.endsOn)}`}
                  action={
                    <span className="flex flex-wrap items-center gap-2">
                      {session.students.length === 0 ? (
                        <Badge tone="accent">no students</Badge>
                      ) : (
                        <Badge tone="brand">
                          {session.students.length}{" "}
                          {session.students.length === 1 ? "student" : "students"}
                        </Badge>
                      )}
                      {session._count.skips > 0 ? (
                        <Badge>{session._count.skips} cancelled</Badge>
                      ) : null}
                    </span>
                  }
                />
                <div className="px-5 py-3 text-sm text-muted">
                  {session.tutor.displayName} · {session.site?.name ?? "No site"} ·{" "}
                  {occurrences} {occurrences === 1 ? "date" : "dates"} ·{" "}
                  {session._count.lessons} logged
                  <Link
                    href={`/admin/sessions/${session.id}`}
                    className="ml-3 font-medium text-brand hover:underline"
                  >
                    Open
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {archived.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Archived ({archived.length})
          </h2>
          <Card>
            <ul className="divide-y divide-line">
              {archived.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
                  <Link href={`/admin/sessions/${session.id}`} className="text-ink hover:text-brand">
                    {session.title ?? `${WEEKDAY_NAMES[session.weekday]} with ${session.tutor.displayName}`}
                  </Link>
                  <span className="text-muted">
                    {formatTimeRange(session.startTime, session.endTime)}
                  </span>
                  <span className="ml-auto text-xs text-faint">
                    {session._count.lessons} logged events kept
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}
    </AppShell>
  );
}
