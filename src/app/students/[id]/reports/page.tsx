import { requireStudent } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { formatDateInput } from "@/lib/fiscal-year";
import { ReportsPanel } from "@/components/report-editor";

export default async function ReportsPage({
  params,
}: PageProps<"/students/[id]/reports">) {
  const { id } = await params;
  const { readOnly } = await requireStudent(id);

  const reports = await prisma.report.findMany({
    where: { studentId: id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <ReportsPanel
      studentId={id}
      readOnly={readOnly}
      reports={reports.map((r) => ({
        id: r.id,
        title: r.title,
        periodStart: r.periodStart ? formatDateInput(r.periodStart) : null,
        periodEnd: r.periodEnd ? formatDateInput(r.periodEnd) : null,
        body: r.body,
        updatedAt: r.updatedAt.toISOString(),
      }))}
    />
  );
}
