import { AppShell } from "@/components/app-shell";
import { CopyField } from "@/components/copy-field";
import { Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui";
import { prisma } from "@/lib/db";
import { appOrigin, emailConfigured, inviteUrl } from "@/lib/email";
import { formatDateDisplay } from "@/lib/fiscal-year";
import { requireAdmin } from "@/lib/guards";
import { resendInviteAction, revokeInviteAction } from "../actions";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Invites — TutorLog" };

export default async function AdminInvitesPage() {
  const user = await requireAdmin();

  const [sites, invites] = await Promise.all([
    prisma.site.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.invite.findMany({
      orderBy: { createdAt: "desc" },
      include: { invitedBy: { select: { displayName: true } }, site: { select: { name: true } } },
    }),
  ]);

  const now = new Date();
  const open = invites.filter(
    (invite) => !invite.acceptedAt && !invite.revokedAt && invite.expiresAt > now,
  );
  const closed = invites.filter((invite) => !open.includes(invite));

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink">Invites</h1>
        <p className="mt-1 text-sm text-muted">
          Accounts are created here. Nobody can sign themselves up.
        </p>
      </div>

      {!emailConfigured() ? (
        <Card className="mb-6 border-accent/40 bg-accent-soft p-4">
          <p className="text-sm text-accent">
            <strong className="font-semibold">Email isn&apos;t set up yet.</strong> Invites still
            work — copy each link below and send it however you like.
          </p>
        </Card>
      ) : null}

      <InviteForm sites={sites} />

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Open invites ({open.length})
        </h2>

        {open.length === 0 ? (
          <Card>
            <EmptyState
              title="No open invites"
              description="Create one above and the link will appear here."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {open.map((invite) => (
              <Card key={invite.id} className="p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{invite.displayName}</span>
                  <span className="text-sm text-muted">{invite.email}</span>
                  {invite.role === "ADMIN" ? <Badge tone="brand">office</Badge> : null}
                  {invite.site ? <Badge>{invite.site.name}</Badge> : null}
                  <span className="ml-auto text-xs text-faint">
                    Expires {formatDateDisplay(invite.expiresAt)}
                  </span>
                </div>

                <CopyField value={inviteUrl(invite.token)} label={`Invite link for ${invite.email}`} />

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {invite.emailSentAt ? (
                    <span className="text-xs text-positive">
                      Emailed {formatDateDisplay(invite.emailSentAt)}
                    </span>
                  ) : (
                    <span className="text-xs text-accent" title={invite.emailError ?? undefined}>
                      {invite.emailError
                        ? "Email didn't send — use the link above"
                        : "Not emailed yet"}
                    </span>
                  )}

                  <form action={resendInviteAction.bind(null, invite.id)} className="ml-auto">
                    <Button type="submit" variant="secondary" size="sm">
                      Resend email
                    </Button>
                  </form>
                  <form action={revokeInviteAction.bind(null, invite.id)}>
                    <Button type="submit" variant="danger" size="sm">
                      Revoke
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Closed ({closed.length})
          </h2>
          <Card>
            <CardHeader title="Accepted, revoked and expired" />
            <ul className="divide-y divide-line">
              {closed.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
                  <span className="font-medium text-ink">{invite.displayName}</span>
                  <span className="text-muted">{invite.email}</span>
                  <span className="ml-auto">
                    {invite.acceptedAt ? (
                      <Badge tone="positive">
                        Accepted {formatDateDisplay(invite.acceptedAt)}
                      </Badge>
                    ) : invite.revokedAt ? (
                      <Badge tone="danger">Revoked</Badge>
                    ) : (
                      <Badge tone="neutral">Expired</Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <p className="mt-6 text-xs text-faint">Links point at {appOrigin()}</p>
    </AppShell>
  );
}
