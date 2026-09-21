import Link from "next/link";
import { notFound } from "next/navigation";

import { requireStudent } from "@/lib/guards";
import { getPrintableStudents } from "@/lib/print-data";
import { PrintableForm } from "@/components/printable-form";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Print form — TutorLog" };

export default async function PrintStudentPage({
  params,
}: PageProps<"/students/[id]/print">) {
  const { id } = await params;
  // Same guard as every other student route: yours, or any if you are the office.
  const { student } = await requireStudent(id);

  const [form] = await getPrintableStudents({ id: student.id });
  if (!form) notFound();

  return (
    <div className="min-h-screen bg-canvas py-6">
      <div className="no-print mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4">
        <div>
          <Link
            href={`/students/${student.id}`}
            className="text-sm text-muted hover:text-ink"
          >
            ← Back to {student.firstName} {student.lastName}
          </Link>
          <p className="mt-1 text-sm text-muted">
            Print preview. Choose <b>Landscape</b> if your browser doesn&apos;t pick it
            up automatically.
          </p>
        </div>
        <PrintButton label="Print this form" />
      </div>

      <div className="overflow-x-auto px-4">
        <div className="shadow-sm">
          <PrintableForm {...form} />
        </div>
      </div>
    </div>
  );
}
