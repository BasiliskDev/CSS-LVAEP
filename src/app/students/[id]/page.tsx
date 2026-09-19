import { requireStudent } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { StudentOverview } from "@/components/student-overview";

export default async function StudentOverviewPage({
  params,
}: PageProps<"/students/[id]">) {
  const { id } = await params;
  const { student, readOnly } = await requireStudent(id);
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });

  return (
    <StudentOverview
      readOnly={readOnly}
      sites={sites}
      student={{
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        siteId: student.siteId,
        days: student.days,
        times: student.times,
        fiscalYearStart: student.fiscalYearStart,
        notes: student.notes,
        status: student.status,
        stoppedReason: student.stoppedReason,
      }}
    />
  );
}
