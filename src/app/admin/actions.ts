"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { fieldErrorsOf, type ActionState, type FormState } from "@/lib/action-state";
import { INVITE_TTL_DAYS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { sendInviteEmail } from "@/lib/email";
import { requireAdmin } from "@/lib/guards";
import {
  adminStudentSchema,
  inviteSchema,
  reassignStudentSchema,
} from "@/lib/validation";

/**
 * The office's write surface. Every action here goes through requireAdmin(), which 404s
 * rather than 403s for everyone else.
 *
 * Note the revalidation: /admin was a read-only page until now, so nothing in the repo
 * ever invalidated it. Without this, every write here would look like it did nothing.
 */
function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/invites");
  revalidatePath("/admin/sessions");
}

// --- Invites ---------------------------------------------------------------------

export async function createInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    role: formData.get("role"),
    siteId: formData.get("siteId"),
  });

  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const data = parsed.data;

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (existingUser) {
    return { fieldErrors: { email: "Someone already has an account with that address" } };
  }

  const live = await prisma.invite.findFirst({
    where: {
      email: data.email,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (live) {
    return {
      fieldErrors: {
        email: "That address already has an open invite — resend or revoke it below",
      },
    };
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const invite = await prisma.invite.create({
    data: {
      email: data.email,
      // Same construction as a session token: opaque and long enough not to guess.
      token: randomBytes(32).toString("hex"),
      displayName: data.displayName,
      role: data.role,
      siteId: data.siteId || null,
      invitedById: admin.id,
      expiresAt,
    },
    select: { id: true, token: true, email: true, displayName: true, expiresAt: true },
  });

  const sent = await sendInviteEmail({
    email: invite.email,
    displayName: invite.displayName,
    token: invite.token,
    invitedByName: admin.displayName,
    expiresAt: invite.expiresAt,
  });

  await prisma.invite.update({
    where: { id: invite.id },
    data: sent.ok
      ? { emailSentAt: new Date(), emailError: null }
      : { emailError: sent.error },
  });

  revalidateAdmin();
  // Success either way: the invite exists and its link is on screen. A send that failed
  // is a delivery problem to report, not a reason to make the office start over.
  return { ok: true };
}

export async function resendInviteAction(inviteId: string): Promise<void> {
  const admin = await requireAdmin();

  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: { id: true, email: true, displayName: true, token: true, expiresAt: true, acceptedAt: true, revokedAt: true },
  });

  if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt <= new Date()) return;

  // The token is deliberately not rotated: a link the office already copied and pasted
  // somewhere has to keep working.
  const sent = await sendInviteEmail({
    email: invite.email,
    displayName: invite.displayName,
    token: invite.token,
    invitedByName: admin.displayName,
    expiresAt: invite.expiresAt,
  });

  await prisma.invite.update({
    where: { id: invite.id },
    data: sent.ok ? { emailSentAt: new Date(), emailError: null } : { emailError: sent.error },
  });

  revalidateAdmin();
}

export async function revokeInviteAction(inviteId: string): Promise<void> {
  await requireAdmin();
  await prisma.invite.updateMany({
    where: { id: inviteId, acceptedAt: null },
    data: { revokedAt: new Date() },
  });
  revalidateAdmin();
}

// --- Students --------------------------------------------------------------------

export async function createStudentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = adminStudentSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    tutorId: formData.get("tutorId"),
    siteId: formData.get("siteId"),
    days: formData.get("days"),
    times: formData.get("times"),
    fiscalYearStart: formData.get("fiscalYearStart"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const { tutorId, siteId, ...rest } = parsed.data;

  const tutor = await prisma.user.findUnique({
    where: { id: tutorId },
    select: { id: true, siteId: true, role: true },
  });
  if (!tutor) return { fieldErrors: { tutorId: "That tutor no longer exists" } };
  if (tutor.role !== "TUTOR") {
    return { fieldErrors: { tutorId: "Office accounts don't keep students" } };
  }

  const student = await prisma.student.create({
    // Fall back to the tutor's own site, the way the tutor-side form used to.
    data: { ...rest, tutorId: tutor.id, siteId: siteId || tutor.siteId },
    select: { id: true },
  });

  revalidateAdmin();
  revalidatePath("/dashboard");
  redirect(`/students/${student.id}`);
}

export async function reassignStudentAction(
  studentId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = reassignStudentSchema.safeParse({ tutorId: formData.get("tutorId") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const { tutorId } = parsed.data;

  const [student, tutor] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: tutorId }, select: { id: true, role: true } }),
  ]);
  if (!student) return { error: "That student no longer exists." };
  if (!tutor) return { fieldErrors: { tutorId: "That tutor no longer exists" } };
  if (tutor.role !== "TUTOR") {
    return { fieldErrors: { tutorId: "Office accounts don't keep students" } };
  }

  await prisma.$transaction([
    // Drop memberships in anyone else's sessions, or the previous tutor keeps being
    // chased for a student who is no longer theirs.
    prisma.scheduledSessionStudent.deleteMany({
      where: { studentId, scheduledSession: { tutorId: { not: tutorId } } },
    }),
    prisma.student.update({
      where: { id: studentId },
      // Every lesson, achievement and report stays exactly where it is — reassignment is
      // one scalar column, which is the whole reason tutorId is nullable rather than the
      // student being deleted on removal.
      data: {
        tutorId,
        removedAt: null,
        removedReason: null,
        removedById: null,
        removedByName: null,
      },
    }),
  ]);

  revalidateAdmin();
  revalidatePath("/dashboard");
  revalidatePath(`/students/${studentId}`, "layout");
  return { ok: true };
}
