import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import bcrypt from "bcryptjs";

import { prisma } from "./db";
import { SESSION_COOKIE, SESSION_TTL_DAYS, type UserRole } from "./constants";

/**
 * Deliberately minimal username/password auth for a club prototype.
 *
 * Passwords are bcrypt-hashed and sessions are opaque, httpOnly, SameSite=Lax cookies,
 * so nothing is stored or transmitted in the clear. What it does NOT have, by design:
 * password reset, email verification, login rate limiting, or session rotation.
 * See the README before putting real student data behind it.
 */

const BCRYPT_ROUNDS = 10;

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  onboardedAt: Date | null;
  siteId: string | null;
};

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function expiryFromNow(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Creates a session row and sets the cookie. Callable only from an action/route handler. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = expiryFromNow();

  await prisma.session.create({ data: { token, userId, expiresAt } });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    // deleteMany rather than delete: a stale cookie shouldn't throw on logout.
    await prisma.session.deleteMany({ where: { token } });
  }
  store.delete(SESSION_COOKIE);
}

/**
 * The current user, or null. `cache()` keeps this to one query per request even
 * though every page and action calls it through the guards.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          onboardedAt: true,
          siteId: true,
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  return { ...session.user, role: session.user.role as UserRole };
});

/** Best-effort cleanup of expired rows; safe to call on login. */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
}
