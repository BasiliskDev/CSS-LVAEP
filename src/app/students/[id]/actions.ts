"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { fieldErrorsOf, type ActionState } from "@/lib/action-state";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/guards";
import { nextCustomCode } from "@/lib/achievements";
import {
  achievementToggleSchema,
  customAchievementSchema,
  lessonSchema,
  removeStudentSchema,
  reportSchema,
  stopStudentSchema,
  studentSchema,
} from "@/lib/validation";
import { todayUTC } from "@/lib/fiscal-year";

// Re-exported so the components importing it keep their existing import path.
export type { ActionState } from "@/lib/action-state";


/**
 * Every action re-checks access through requireStudent, which 404s for a student
 * that isn't the caller's. The office (ADMIN) can read anything but must not write,
 * so writes additionally reject a read-only context.
 */
async function requireWritableStudent(studentId: string) {
  const context = await requireStudent(studentId);
  if (context.readOnly) {
    throw new Error("Read-only: this student belongs to another tutor.");
  }
  return context;
}

function revalidateStudent(studentId: string) {
  revalidatePath(`/students/${studentId}`, "layout");
  revalidatePath("/dashboard");
}

// --- Lessons ----------------------------------------------------------------

export async function saveLessonAction(
  studentId: string,
  lessonId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireWritableStudent(studentId);

  const parsed = lessonSchema.safeParse({
    date: formData.get("date"),
    status: formData.get("status"),
    // `hours` is deliberately not read from the form — the schema derives it from
    // the time slot, so a forged field cannot inflate a student's total.
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    topics: formData.get("topics"),
    homeworkAssigned: formData.get("homeworkAssigned") === "on",
    homeworkCompleted: formData.get("homeworkCompleted") === "on",
    notes: formData.get("notes"),
  });

  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const data = parsed.data;

  if (lessonId) {
    // Scope the update by studentId so a stray id can't reach another student's row.
    const result = await prisma.lesson.updateMany({
      where: { id: lessonId, studentId },
      data,
    });
    if (result.count === 0) return { error: "That lesson no longer exists." };
  } else {
    await prisma.lesson.create({ data: { ...data, studentId } });
  }

  revalidateStudent(studentId);
  return { ok: true };
}

export async function deleteLessonAction(studentId: string, lessonId: string) {
  await requireWritableStudent(studentId);
  await prisma.lesson.deleteMany({ where: { id: lessonId, studentId } });
  revalidateStudent(studentId);
}

// --- Achievements -----------------------------------------------------------

export async function toggleAchievementAction(studentId: string, formData: FormData) {
  await requireWritableStudent(studentId);

  const parsed = achievementToggleSchema.safeParse({
    code: formData.get("code"),
    attained: formData.get("attained") === "true",
    attainedAt: formData.get("attainedAt") ?? undefined,
    note: formData.get("note"),
  });

  if (!parsed.success) return;

  const { code, attained, attainedAt, note } = parsed.data;
  // Ticking the box stamps today unless a date was supplied; unticking clears it.
  const stamp = attained ? (attainedAt ?? todayUTC()) : null;

  await prisma.studentAchievement.upsert({
    where: { studentId_code: { studentId, code } },
    update: { attained, attainedAt: stamp, note },
    create: { studentId, code, attained, attainedAt: stamp, note },
  });

  revalidateStudent(studentId);
}

export async function addCustomAchievementAction(
  studentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireWritableStudent(studentId);

  const parsed = customAchievementSchema.safeParse({ label: formData.get("label") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const existing = await prisma.studentAchievement.findMany({
    where: { studentId },
    select: { code: true },
  });

  await prisma.studentAchievement.create({
    data: {
      studentId,
      code: nextCustomCode(existing.map((a) => a.code)),
      label: parsed.data.label,
    },
  });

  revalidateStudent(studentId);
  return { ok: true };
}

export async function deleteCustomAchievementAction(studentId: string, code: string) {
  await requireWritableStudent(studentId);
  // Only custom "E" rows are removable; catalog rows are part of the form.
  if (!code.startsWith("E")) return;
  await prisma.studentAchievement.deleteMany({ where: { studentId, code } });
  revalidateStudent(studentId);
}

// --- Reports ----------------------------------------------------------------

export async function saveReportAction(
  studentId: string,
  reportId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireWritableStudent(studentId);

  const parsed = reportSchema.safeParse({
    title: formData.get("title"),
    periodStart: formData.get("periodStart") ?? undefined,
    periodEnd: formData.get("periodEnd") ?? undefined,
    body: formData.get("body"),
  });

  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const data = parsed.data;

  if (data.periodStart && data.periodEnd && data.periodEnd < data.periodStart) {
    return { fieldErrors: { periodEnd: "End date is before the start date" } };
  }

  if (reportId) {
    const result = await prisma.report.updateMany({
      where: { id: reportId, studentId },
      data,
    });
    if (result.count === 0) return { error: "That report no longer exists." };
  } else {
    await prisma.report.create({ data: { ...data, studentId } });
  }

  revalidateStudent(studentId);
  return { ok: true };
}

export async function deleteReportAction(studentId: string, reportId: string) {
  await requireWritableStudent(studentId);
  await prisma.report.deleteMany({ where: { id: reportId, studentId } });
  revalidateStudent(studentId);
}

// --- Student record ---------------------------------------------------------

export async function updateStudentAction(
  studentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireWritableStudent(studentId);

  const parsed = studentSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    siteId: formData.get("siteId"),
    days: formData.get("days"),
    times: formData.get("times"),
    fiscalYearStart: formData.get("fiscalYearStart"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { siteId, ...rest } = parsed.data;
  await prisma.student.update({
    where: { id: studentId },
    data: { ...rest, siteId: siteId || null },
  });

  revalidateStudent(studentId);
  return { ok: true };
}

/** The form's STOPPED box: a reason is required, matching "Reason: ____". */
export async function stopStudentAction(
  studentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireWritableStudent(studentId);

  const parsed = stopStudentSchema.safeParse({
    stoppedReason: formData.get("stoppedReason"),
    stoppedAt: formData.get("stoppedAt") ?? undefined,
  });

  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  await prisma.student.update({
    where: { id: studentId },
    data: {
      status: "STOPPED",
      stoppedReason: parsed.data.stoppedReason,
      stoppedAt: parsed.data.stoppedAt ?? todayUTC(),
    },
  });

  revalidateStudent(studentId);
  return { ok: true };
}

export async function resumeStudentAction(studentId: string) {
  await requireWritableStudent(studentId);
  await prisma.student.update({
    where: { id: studentId },
    data: { status: "ACTIVE", stoppedAt: null, stoppedReason: null },
  });
  revalidateStudent(studentId);
}

/**
 * A tutor hands a student back to the office.
 *
 * Nothing is deleted: the student keeps every lesson, achievement, report and note, and
 * lands in the office's unassigned pool, where only an admin can reassign them. That is
 * what makes this irreversible *for the tutor* without being destructive — and it is why
 * Student.tutorId is nullable rather than the row being removed.
 */
export async function removeStudentAction(
  studentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { student, user } = await requireWritableStudent(studentId);

  const parsed = removeStudentSchema.safeParse({
    confirmName: formData.get("confirmName"),
    removedReason: formData.get("removedReason"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const expected = `${student.firstName} ${student.lastName}`;
  const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  if (normalise(parsed.data.confirmName) !== normalise(expected)) {
    return { fieldErrors: { confirmName: `Type "${expected}" exactly to confirm` } };
  }

  const [, updated] = await prisma.$transaction([
    // Drop their scheduled-session memberships, or the series keeps listing a student
    // this tutor no longer has and the reminder keeps chasing them for it.
    prisma.scheduledSessionStudent.deleteMany({ where: { studentId } }),
    prisma.student.updateMany({
      // Scoped by tutorId so a forged id can't unassign someone else's student.
      where: { id: studentId, tutorId: user.id },
      data: {
        tutorId: null,
        removedAt: new Date(),
        removedReason: parsed.data.removedReason,
        removedById: user.id,
        removedByName: user.displayName,
      },
    }),
  ]);

  if (updated.count === 0) return { error: "That student is no longer yours." };

  revalidateStudent(studentId);
  revalidatePath("/admin");
  revalidatePath("/calendar");

  // Redirect from the server rather than from the client once `ok` comes back: this page
  // is about to 404 for this tutor, and the revalidation above can unmount the form
  // before a client-side effect ever runs — leaving them staring at a not-found page.
  redirect("/dashboard");
}
