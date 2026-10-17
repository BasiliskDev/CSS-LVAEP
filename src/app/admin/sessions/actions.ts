"use server";

import { revalidatePath } from "next/cache";

import { fieldErrorsOf, type ActionState } from "@/lib/action-state";
import { prisma } from "@/lib/db";
import { parseDateInput } from "@/lib/fiscal-year";
import { requireAdmin } from "@/lib/guards";
import { countOccurrences, isOccurrence } from "@/lib/recurrence";
import { scheduledSessionSchema, sessionSkipSchema } from "@/lib/validation";

/** Scheduling is the office's job, so every action here is behind requireAdmin(). */

function revalidateSessions(scheduledSessionId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/sessions");
  if (scheduledSessionId) revalidatePath(`/admin/sessions/${scheduledSessionId}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

function readSessionForm(formData: FormData) {
  return {
    tutorId: formData.get("tutorId"),
    title: formData.get("title"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    siteId: formData.get("siteId"),
    notes: formData.get("notes"),
    // getAll returns FormDataEntryValue[], so the cast to string is not optional.
    studentIds: formData.getAll("studentIds").map(String),
  };
}

/**
 * A session belongs to a tutor, and its students have to be that tutor's own —
 * otherwise the tutor would be reminded to log hours for someone they can't open.
 * The office schedules sessions; it never runs them.
 */
async function checkStudentsBelongToTutor(studentIds: string[], tutorId: string) {
  const tutor = await prisma.user.findUnique({
    where: { id: tutorId },
    select: { role: true },
  });
  if (!tutor) return "That tutor no longer exists.";
  if (tutor.role !== "TUTOR") return "Office accounts don't run sessions.";

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, tutorId: true },
  });

  if (students.length !== studentIds.length) {
    return "One of those students no longer exists.";
  }

  const stray = students.find((student) => student.tutorId !== tutorId);
  if (stray) {
    return `${stray.firstName} ${stray.lastName} isn't assigned to that tutor.`;
  }

  return null;
}

export async function createScheduledSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = scheduledSessionSchema.safeParse(readSessionForm(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const data = parsed.data;

  const problem = await checkStudentsBelongToTutor(data.studentIds, data.tutorId);
  if (problem) return { fieldErrors: { studentIds: problem } };

  if (countOccurrences({ weekday: data.weekday, startsOn: data.startsOn, endsOn: data.endsOn }) === 0) {
    return {
      fieldErrors: { endsOn: "That range contains no occurrences of the day you picked" },
    };
  }

  await prisma.scheduledSession.create({
    data: {
      tutorId: data.tutorId,
      siteId: data.siteId || null,
      title: data.title,
      weekday: data.weekday,
      startTime: data.startTime,
      endTime: data.endTime,
      startsOn: data.startsOn,
      endsOn: data.endsOn,
      notes: data.notes,
      students: { create: data.studentIds.map((studentId) => ({ studentId })) },
    },
  });

  revalidateSessions();
  return { ok: true };
}

export async function updateScheduledSessionAction(
  scheduledSessionId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = scheduledSessionSchema.safeParse(readSessionForm(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const data = parsed.data;

  const problem = await checkStudentsBelongToTutor(data.studentIds, data.tutorId);
  if (problem) return { fieldErrors: { studentIds: problem } };

  const existing = await prisma.scheduledSession.findUnique({
    where: { id: scheduledSessionId },
    select: { id: true },
  });
  if (!existing) return { error: "That session no longer exists." };

  await prisma.$transaction([
    prisma.scheduledSession.update({
      where: { id: scheduledSessionId },
      data: {
        tutorId: data.tutorId,
        siteId: data.siteId || null,
        title: data.title,
        weekday: data.weekday,
        startTime: data.startTime,
        endTime: data.endTime,
        startsOn: data.startsOn,
        endsOn: data.endsOn,
        notes: data.notes,
      },
    }),
    // Diff the membership rather than replacing it, so createdAt ordering survives.
    prisma.scheduledSessionStudent.deleteMany({
      where: { scheduledSessionId, studentId: { notIn: data.studentIds } },
    }),
    prisma.scheduledSessionStudent.createMany({
      data: data.studentIds.map((studentId) => ({ scheduledSessionId, studentId })),
      skipDuplicates: true,
    }),
  ]);

  revalidateSessions(scheduledSessionId);
  // Hours already logged keep the slot they were logged with: history must not move
  // when the schedule changes. The occurrence list flags any mismatch.
  return { ok: true };
}

export async function archiveScheduledSessionAction(scheduledSessionId: string): Promise<void> {
  await requireAdmin();
  // Archived, never deleted: deleting would orphan every lesson logged against it, and
  // past occurrences would stop being recognisable as part of a session at all.
  await prisma.scheduledSession.update({
    where: { id: scheduledSessionId },
    data: { status: "ARCHIVED" },
  });
  revalidateSessions(scheduledSessionId);
}

export async function restoreScheduledSessionAction(scheduledSessionId: string): Promise<void> {
  await requireAdmin();
  await prisma.scheduledSession.update({
    where: { id: scheduledSessionId },
    data: { status: "ACTIVE" },
  });
  revalidateSessions(scheduledSessionId);
}

/** Cancel one date — a holiday, a closure — leaving the series intact. */
export async function skipOccurrenceAction(
  scheduledSessionId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = sessionSkipSchema.safeParse({
    date: formData.get("date"),
    reason: formData.get("reason"),
    logHoliday: formData.get("logHoliday") === "on",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const { date, reason, logHoliday } = parsed.data;

  const series = await prisma.scheduledSession.findUnique({
    where: { id: scheduledSessionId },
    select: {
      weekday: true,
      startsOn: true,
      endsOn: true,
      students: { select: { studentId: true } },
    },
  });
  if (!series) return { error: "That session no longer exists." };

  // Never trust a posted date — it has to be a real occurrence of this rule.
  if (!isOccurrence({ weekday: series.weekday, startsOn: series.startsOn, endsOn: series.endsOn }, date)) {
    return { fieldErrors: { date: "That date isn't one of this session's dates" } };
  }

  await prisma.scheduledSessionSkip.upsert({
    // Both columns are non-null, so unlike Lesson this compound unique works as a where.
    where: { scheduledSessionId_date: { scheduledSessionId, date } },
    update: { reason },
    create: { scheduledSessionId, date, reason },
  });

  if (logHoliday) {
    // Stamp the paper form's own "H" so a closure reads as a holiday rather than a gap.
    await prisma.lesson.createMany({
      data: series.students.map((membership) => ({
        studentId: membership.studentId,
        scheduledSessionId,
        date,
        status: "HOLIDAY",
        hours: 0,
        notes: reason,
      })),
      skipDuplicates: true,
    });
  }

  revalidateSessions(scheduledSessionId);
  return { ok: true };
}

export async function restoreOccurrenceAction(
  scheduledSessionId: string,
  dateKey: string,
): Promise<void> {
  await requireAdmin();
  const date = parseDateInput(dateKey);
  if (!date) return;

  // Only the cancellation is lifted. Any HOLIDAY rows it stamped are logged hours now,
  // and deleting those is the tutor's call, not a side effect of un-cancelling.
  await prisma.scheduledSessionSkip.deleteMany({ where: { scheduledSessionId, date } });
  revalidateSessions(scheduledSessionId);
}
