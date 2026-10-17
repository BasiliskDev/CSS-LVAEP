import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { StudentTabs } from "@/components/student-tabs";
import { requireStudent } from "@/lib/guards";
import { fiscalYearLabel } from "@/lib/fiscal-year";
import { Badge, ButtonLink } from "@/components/ui";

export default async function StudentLayout({
  children,
  params,
}: LayoutProps<"/students/[id]">) {
  const { id } = await params;
  const { student, user, readOnly, unassigned } = await requireStudent(id);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        {/* The office has no student list of its own, so send them back to the panel
            they arrived from rather than through a redirect. */}
        <Link
          href={user.role === "ADMIN" ? "/admin" : "/dashboard"}
          className="text-sm text-muted hover:text-ink"
        >
          {user.role === "ADMIN" ? "← Office" : "← All students"}
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink">
            {student.firstName} {student.lastName}
          </h1>
          <ButtonLink
            href={`/students/${student.id}/print`}
            variant="secondary"
            size="sm"
          >
            Print form
          </ButtonLink>
          {student.status === "STOPPED" ? (
            <Badge tone="danger">Stopped</Badge>
          ) : (
            <Badge tone="positive">Active</Badge>
          )}
          {unassigned ? (
            <Badge tone="accent">Unassigned</Badge>
          ) : readOnly ? (
            <Badge tone="accent">Office view · read only</Badge>
          ) : null}
        </div>

        <p className="mt-1 text-sm text-muted">
          {student.site?.name ?? "No site"} · {fiscalYearLabel(student.fiscalYearStart)}
          {readOnly ? ` · Tutor: ${student.tutor?.displayName ?? "Unassigned"}` : ""}
        </p>
      </div>

      {unassigned ? (
        <div
          className="mb-4 rounded-md border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent"
          role="status"
        >
          <strong className="font-semibold">Not assigned to a tutor.</strong> Everything on
          record is kept. The office can assign this student from the Office page.
        </div>
      ) : null}

      <StudentTabs studentId={student.id} />

      <div className="mt-6">{children}</div>
    </AppShell>
  );
}
