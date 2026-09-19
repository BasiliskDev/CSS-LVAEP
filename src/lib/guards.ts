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

  return { student, user, readOnly: student.tutorId !== user.id };
}
