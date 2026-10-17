import "server-only";

import { notFound, redirect } from "next/navigation";

import { getCurrentUser, type SessionUser } from "./auth";
import { prisma } from "./db";

/**
 * The single place authorization is decided. Every page and every server action
 * goes through one of these before reading or writing anything.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** A tutor who has not finished onboarding has no site on file, so send them back. */
export async function requireOnboarded(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.onboardedAt) redirect("/onboarding");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  return user;
}

/**
 * Loads a student the current user is allowed to see: their own, or any student
 * if they are an admin. Anything else is a 404 — not a 403, so the URL doesn't
 * confirm that someone else's student exists.
 */
export async function requireStudent(studentId: string) {
  const user = await requireUser();

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      site: true,
      tutor: { select: { id: true, displayName: true, username: true } },
    },
  });

  if (!student) notFound();
  if (student.tutorId !== user.id && user.role !== "ADMIN") notFound();

  // A student in the unassigned pool has no tutorId, so `readOnly` is true for everyone
  // — which is right: the office reassigns through its own actions, not by editing the
  // student page, and no tutor should be able to write to a student who isn't theirs.
  return {
    student,
    user,
    readOnly: student.tutorId !== user.id,
    unassigned: student.tutorId === null,
  };
}

/**
 * Loads a scheduled session the current user is allowed to see: their own, or any of
 * them if they are the office. Shaped like requireStudent, including the 404 — the URL
 * shouldn't confirm that someone else's session exists.
 */
export async function requireScheduledSession(scheduledSessionId: string) {
  const user = await requireUser();

  const series = await prisma.scheduledSession.findUnique({
    where: { id: scheduledSessionId },
    include: {
      site: true,
      tutor: { select: { id: true, displayName: true, username: true } },
      students: {
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, status: true, tutorId: true },
          },
        },
      },
      skips: { select: { date: true, reason: true } },
    },
  });

  if (!series) notFound();
  if (series.tutorId !== user.id && user.role !== "ADMIN") notFound();

  return { series, user, readOnly: series.tutorId !== user.id };
}
