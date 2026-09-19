"use server";

import { redirect } from "next/navigation";

import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  pruneExpiredSessions,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loginSchema, registerSchema } from "@/lib/validation";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function fieldErrorsOf(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { username, displayName, password } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (existing) {
    return { fieldErrors: { username: "That username is taken" } };
  }

  const user = await prisma.user.create({
    data: {
      username,
      displayName,
      passwordHash: await hashPassword(password),
    },
    select: { id: true },
  });

  await createSession(user.id);
  redirect("/onboarding");
}

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
    select: { id: true, passwordHash: true, onboardedAt: true },
  });

  // One generic message for both branches, so the form can't be used to
  // enumerate which usernames exist.
  const invalid: AuthFormState = { error: "Incorrect username or password" };
  if (!user) return invalid;
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid;

  await pruneExpiredSessions();
  await createSession(user.id);
  redirect(user.onboardedAt ? "/dashboard" : "/onboarding");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Used by the landing route to decide where to send someone. */
export async function currentUserDestination(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) return "/login";
  return user.onboardedAt ? "/dashboard" : "/onboarding";
}
