"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { fieldErrorsOf, type FormState } from "@/lib/action-state";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { acceptInviteSchema } from "@/lib/validation";

/**
 * Accepting an invite is the only way an account comes into existence. This route is
 * deliberately public — it is reached from an email link by someone with no session —
 * so the token is the entire credential, and it is re-checked here rather than trusted
 * from the page that rendered the form.
 */
export async function acceptInviteAction(
  token: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const invite = await prisma.invite.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      siteId: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
    },
  });

  if (!invite || invite.revokedAt) return { error: "This invite is no longer valid." };
  if (invite.acceptedAt) return { error: "This invite has already been used." };
  if (invite.expiresAt <= new Date()) {
    return { error: "This invite has expired — ask the office for a new one." };
  }

  const parsed = acceptInviteSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const data = parsed.data;

  const taken = await prisma.user.findUnique({
    where: { username: data.username },
    select: { id: true },
  });
  if (taken) return { fieldErrors: { username: "That username is taken" } };

  // One transaction, so a crash can't leave an account whose invite is still open —
  // which would let the same link create a second account.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username: data.username,
        displayName: data.displayName,
        passwordHash: await hashPassword(data.password),
        email: invite.email,
        role: invite.role,
        siteId: invite.siteId,
      },
      select: { id: true },
    });

    // Scoped by acceptedAt so two simultaneous submissions can't both win.
    const claimed = await tx.invite.updateMany({
      where: { id: invite.id, acceptedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count === 0) throw new Error("INVITE_ALREADY_CLAIMED");

    return created;
  });

  await createSession(user.id);
  revalidatePath("/admin/invites");
  // Onboarding collects the phone, site and usual days/times, exactly as before.
  redirect("/onboarding");
}
