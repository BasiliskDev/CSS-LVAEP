import { AppShell } from "@/components/app-shell";
import { requireOnboarded } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/lib/students";
import { NewStudentForm } from "./new-student-form";

export const metadata = { title: "Add student — TutorLog" };

export default async function NewStudentPage() {
  const user = await requireOnboarded();
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });
  const tutor = await prisma.user.findUnique({
    where: { id: user.id },
    select: { defaultDays: true, defaultTimes: true, siteId: true },
  });

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-semibold text-ink">Add a student</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          The form required a separate sheet per student — this is that sheet.
        </p>
        <NewStudentForm
          sites={sites}
          defaultFiscalYear={DEFAULT_FISCAL_YEAR}
          defaultDays={tutor?.defaultDays ?? ""}
          defaultTimes={tutor?.defaultTimes ?? ""}
          defaultSiteId={tutor?.siteId ?? ""}
        />
      </div>
    </AppShell>
  );
}
