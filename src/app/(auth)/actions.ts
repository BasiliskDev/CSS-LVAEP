"use server";

import { redirect } from "next/navigation";

import {
  createSession,
  destroySession,
  getCurrentUser,
  homeFor,
  pruneExpiredSessions,
  verifyPassword,
} from "@/lib/auth";
import { fieldErrorsOf, type FormState } from "@/lib/action-state";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";

/** These forms redirect on success, so they carry no `ok`. */
export type AuthFormState = FormState;

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true, passwordHash: true, onboardedAt: true, role: true },
  });

  // One generic message for both branches, so the form can't be used to
  // enumerate which usernames exist.
  const invalid: AuthFormState = { error: "Incorrect username or password" };
  if (!user) return invalid;
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid;

  await pruneExpiredSessions();
  await createSession(user.id);
  redirect(homeFor(user));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Used by the landing route to decide where to send someone. */
export async function currentUserDestination(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) return "/login";
  return homeFor(user);
}
