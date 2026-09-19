"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireOnboarded } from "@/lib/guards";
import { studentSchema } from "@/lib/validation";

export type StudentFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createStudentAction(
  _prev: StudentFormState,
  formData: FormData,
): Promise<StudentFormState> {
  const user = await requireOnboarded();

  const parsed = studentSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    siteId: formData.get("siteId"),
    days: formData.get("days"),
    times: formData.get("times"),
    fiscalYearStart: formData.get("fiscalYearStart"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const data = parsed.data;

  const student = await prisma.student.create({
    data: {
      tutorId: user.id,
      firstName: data.firstName,
      lastName: data.lastName,
      siteId: data.siteId || user.siteId,
      days: data.days,
      times: data.times,
      fiscalYearStart: data.fiscalYearStart,
      notes: data.notes,
    },
    select: { id: true },
  });

  revalidatePath("/dashboard");
  redirect(`/students/${student.id}`);
}
