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
  const { student, user, readOnly } = await requireStudent(id);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
          ← All students
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
          {readOnly ? <Badge tone="accent">Office view · read only</Badge> : null}
        </div>

        <p className="mt-1 text-sm text-muted">
          {student.site?.name ?? "No site"} · {fiscalYearLabel(student.fiscalYearStart)}
          {readOnly ? ` · Tutor: ${student.tutor.displayName}` : ""}
        </p>
      </div>

      <StudentTabs studentId={student.id} />

      <div className="mt-6">{children}</div>
    </AppShell>
  );
}
