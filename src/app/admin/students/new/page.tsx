import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/guards";
import { prisma } from "@/lib/db";
import { DEFAULT_FISCAL_YEAR } from "@/lib/students";
import { NewStudentForm } from "./new-student-form";

export const metadata = { title: "Add student — TutorLog" };

export default async function NewStudentPage() {
  const user = await requireAdmin();

  const [sites, tutors] = await Promise.all([
    prisma.site.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Only onboarded accounts: an invited tutor who hasn't finished setting up has no
    // site on file, and assigning to them would strand the student.
    prisma.user.findMany({
      where: { onboardedAt: { not: null } },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, username: true, defaultDays: true, defaultTimes: true, siteId: true },
    }),
  ]);

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-lg">
        <h1 className="text-xl font-semibold text-ink">Add a student</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          The form required a separate sheet per student — this is that sheet. Choose the
          tutor who will be keeping it.
        </p>
        <NewStudentForm sites={sites} tutors={tutors} defaultFiscalYear={DEFAULT_FISCAL_YEAR} />
      </div>
    </AppShell>
  );
}
