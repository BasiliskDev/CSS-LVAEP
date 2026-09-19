import { requireStudent } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { formatDateInput } from "@/lib/fiscal-year";
import { AchievementChecklist } from "@/components/achievement-checklist";

export default async function AchievementsPage({
  params,
}: PageProps<"/students/[id]/achievements">) {
  const { id } = await params;
  const { readOnly } = await requireStudent(id);

  const saved = await prisma.studentAchievement.findMany({
    where: { studentId: id },
    orderBy: { code: "asc" },
  });

  return (
    <AchievementChecklist
      studentId={id}
      readOnly={readOnly}
      saved={saved.map((a) => ({
        code: a.code,
        label: a.label,
        attained: a.attained,
        attainedAt: a.attainedAt ? formatDateInput(a.attainedAt) : null,
        note: a.note,
      }))}
    />
  );
}
