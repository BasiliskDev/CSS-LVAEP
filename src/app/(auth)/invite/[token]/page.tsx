import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata = { title: "Accept your invite — TutorLog" };

/** A dead end that still tells the visitor what to do next. */
function Dead({ title, detail }: { title: string; detail: string }) {
  return (
    <Card className="p-5">
      <h1 className="text-base font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">{detail}</p>
      <p className="mt-4 text-sm text-muted">
        <Link href="/login" className="font-medium text-brand hover:underline">
          Go to sign in
        </Link>
      </p>
    </Card>
  );
}

export default async function AcceptInvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({
    where: { token },
    select: {
      email: true,
      displayName: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      invitedBy: { select: { displayName: true } },
      site: { select: { name: true } },
    },
  });

  // One message for "no such token" and "revoked": a stranger poking at URLs learns
  // nothing either way.
  if (!invite || invite.revokedAt) {
    return (
      <Dead
        title="This invite isn't valid"
        detail="The link may have been mistyped or withdrawn. Ask the office to send a new one."
      />
    );
  }

  if (invite.acceptedAt) {
    return (
      <Dead
        title="This invite has already been used"
        detail="An account was created with this link. Sign in with the username you chose, or ask the office for help."
      />
    );
  }

  if (invite.expiresAt <= new Date()) {
    return (
      <Dead
        title="This invite has expired"
        detail="Invite links last a week. Ask the office to send you a fresh one."
      />
    );
  }

  // Don't swap sessions underneath someone who is already signed in — they may be on a
  // shared computer, and silently replacing their account would be alarming.
  const current = await getCurrentUser();
  if (current) {
    return (
      <Dead
        title={`You're signed in as ${current.displayName}`}
        detail="Sign out first, then open this invite link again to set up the new account."
      />
    );
  }

  return (
    <>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-ink">Set up your account</h1>
        <p className="mt-1 text-sm text-muted">
          {invite.invitedBy.displayName} invited {invite.email} to keep tutoring records
          {invite.site ? ` at ${invite.site.name}` : ""}
          {invite.role === "ADMIN" ? " as an office account" : ""}.
        </p>
      </div>
      <AcceptInviteForm token={token} defaultDisplayName={invite.displayName} />
    </>
  );
}
