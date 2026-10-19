"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { fieldErrorsOf, type ActionState } from "@/lib/action-state";
import { prisma } from "@/lib/db";
import { parseDateInput } from "@/lib/fiscal-year";
import { requireScheduledSession } from "@/lib/guards";
import { isOccurrence } from "@/lib/recurrence";
import { ruleOf } from "@/lib/scheduled-sessions";
import { lessonSchema } from "@/lib/validation";

/** Exactly what lessonSchema produces, so a row can't drift from what Prisma accepts. */
type LessonRow = z.output<typeof lessonSchema>;

/**
 * Log one occurrence of a scheduled session: an event per student, in one submit.
 *
 * The hours are not negotiable here. The slot comes off the series row rather than the
 * form, so `lessonSchema`'s existing derivation still decides `hours` and a hand-crafted
 * POST can't inflate anyone's total — the same guarantee the single-lesson form has.
 */
export async function logSessionOccurrenceAction(
  scheduledSessionId: string,
  dateKey: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { series, user, readOnly } = await requireScheduledSession(scheduledSessionId);
  if (readOnly) {
    throw new Error("Read-only: this session belongs to another tutor.");
  }

  const parsedDate = parseDateInput(dateKey);
  if (!parsedDate) return { error: "That date isn't valid." };
  // Bound to a const so the narrowing survives into the closure below.
  const date = parsedDate;

  // The date arrived in a URL path segment, so this is the only thing between it and an
  // arbitrary write.
  if (!isOccurrence(ruleOf(series), date)) {
    return { error: "That date isn't part of this session." };
  }

  if (series.skips.some((skip) => skip.date.getTime() === date.getTime())) {
    return { error: "That date was cancelled, so there are no hours to log." };
  }

  // A student reassigned or handed back mid-term must not be writable by the old tutor.
  const students = series.students
    .map((membership) => membership.student)
    .filter((student) => student.tutorId === user.id);

  if (students.length === 0) {
    return { error: "None of this session's students are assigned to you any more." };
  }

  const included = students.filter((student) => formData.get(`include.${student.id}`) === "on");
  if (included.length === 0) {
    return { error: "Tick at least one student to log." };
  }

  // Validate every row before writing any — a half-logged session is worse than a
  // rejected one, and the tutor gets all the problems at once.
  const rows: Array<{ studentId: string; data: LessonRow }> = [];
  const fieldErrors: Record<string, string> = {};

  for (const student of included) {
    const parsed = lessonSchema.safeParse({
      date: dateKey,
      status: formData.get(`status.${student.id}`),
      // From the database, never the form.
      startTime: series.startTime,
      endTime: series.endTime,
      topics: formData.get(`topics.${student.id}`),
      homeworkAssigned: formData.get(`homeworkAssigned.${student.id}`) === "on",
      homeworkCompleted: formData.get(`homeworkCompleted.${student.id}`) === "on",
      notes: formData.get(`notes.${student.id}`),
    });

    if (!parsed.success) {
      Object.assign(fieldErrors, fieldErrorsOf(parsed.error, `.${student.id}`));
      continue;
    }
    rows.push({ studentId: student.id, data: parsed.data });
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  async function write() {
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        // `upsert` is unavailable: scheduledSessionId is nullable, so Prisma won't accept
        // the compound unique as a `where`. The unique index is still the backstop below.
        const existing = await tx.lesson.findFirst({
          where: { scheduledSessionId, studentId: row.studentId, date },
          select: { id: true },
        });

        if (existing) {
          await tx.lesson.update({ where: { id: existing.id }, data: row.data });
        } else {
          await tx.lesson.create({
            data: { ...row.data, studentId: row.studentId, scheduledSessionId },
          });
        }
      }
    });
  }

  try {
    await write();
  } catch (error) {
    // P2002 means a double submit raced us between the findFirst and the create. The
    // row now exists, so running the same pass again turns it into an update.
    const code = (error as { code?: string }).code;
    if (code !== "P2002") throw error;
    await write();
  }

  // This page first: without it the occurrence re-renders from pre-save data, so a row
  // just saved as an absence comes back looking unlogged.
  revalidatePath(`/sessions/${scheduledSessionId}/${dateKey}`);
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  for (const row of rows) {
    revalidatePath(`/students/${row.studentId}`, "layout");
  }

  return { ok: true };
}
