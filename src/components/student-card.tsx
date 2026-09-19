import Link from "next/link";

import type { StudentSummary } from "@/lib/students";
import { fiscalYearLabel, formatDateDisplay } from "@/lib/fiscal-year";
import { Badge, Card } from "@/components/ui";

export function StudentCard({
  student,
  hrefBase = "/students",
  tutorName,
}: {
  student: StudentSummary;
  hrefBase?: string;
  tutorName?: string;
}) {
  return (
    <Card className="transition-colors hover:border-line-strong">
      <Link href={`${hrefBase}/${student.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">
              {student.firstName} {student.lastName}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {tutorName ? `${tutorName} · ` : ""}
              {student.siteName ?? "No site"} ·{" "}
              {fiscalYearLabel(student.fiscalYearStart)}
            </p>
          </div>
          {student.status === "STOPPED" ? (
            <Badge tone="danger">Stopped</Badge>
          ) : (
            <Badge tone="positive">Active</Badge>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Hours" value={student.totalHours} />
          <Stat label="Lessons" value={student.lessonCount} />
          <Stat label="Goals met" value={student.achievementsAttained} />
        </dl>

        <p className="mt-3 text-xs text-faint">
          {student.lastLessonAt
            ? `Last lesson ${formatDateDisplay(student.lastLessonAt)}`
            : "No lessons logged yet"}
        </p>
      </Link>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-surface-2 px-2 py-2">
      <dd className="text-lg font-semibold tabular-nums text-ink">{value}</dd>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
    </div>
  );
}
