import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/guards";

/**
 * The office opens a student through the ordinary student pages. requireStudent
 * already grants admins read access and flags the view read-only, so there is no
 * second copy of the UI to keep in sync.
 */
export default async function AdminStudentPage({
  params,
}: PageProps<"/admin/students/[id]">) {
  await requireAdmin();
  const { id } = await params;
  redirect(`/students/${id}`);
}
