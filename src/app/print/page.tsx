import Link from "next/link";

import { requireOnboarded } from "@/lib/guards";
import { getPrintableStudents } from "@/lib/print-data";
import { PrintableForm } from "@/components/printable-form";
import { PrintButton } from "@/components/print-button";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Print all forms — TutorLog" };

/** One sheet per student, page-broken, so the whole caseload prints in one go. */
export default async function PrintAllPage({ searchParams }: PageProps<"/print">) {
  const user = await requireOnboarded();
  const query = await searchParams;
  const includeStopped = query.stopped === "1";

  const forms = (await getPrintableStudents({ tutorId: user.id })).filter(
    (f) => includeStopped || f.student.status !== "STOPPED",
  );

  return (
    <div className="min-h-screen bg-canvas py-6">
      <div className="no-print mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4">
        <div>
          <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
            ← Back to students
          </Link>
          <p className="mt-1 text-sm text-muted">
            {forms.length} form{forms.length === 1 ? "" : "s"}, one page each
            {includeStopped ? ", including stopped students" : ""}.{" "}
            <Link
              href={includeStopped ? "/print" : "/print?stopped=1"}
              className="underline"
            >
              {includeStopped ? "Active only" : "Include stopped students"}
            </Link>
          </p>
        </div>
        {forms.length > 0 ? <PrintButton label="Print all forms" /> : null}
      </div>

      {forms.length === 0 ? (
        <EmptyState
          title="No students to print"
          description="Add a student first, or include stopped students above."
        />
      ) : (
        <div className="space-y-6 overflow-x-auto px-4">
          {forms.map((form) => (
            <div key={form.student.id} className="shadow-sm">
              <PrintableForm {...form} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
