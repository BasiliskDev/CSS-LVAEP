import "server-only";

/**
 * Outbound email, behind one function.
 *
 * Only invite links go out today, and the provider is provisioned through the Vercel
 * Marketplace (`vercel integration add resend/resend-email`), which injects the API key
 * as an environment variable. Everything provider-specific lives in this file, so
 * swapping providers means rewriting `deliver()` and nothing else.
 *
 * Sending is best-effort by design. The club has no verified sender domain, so mail to
 * an outside address often will not arrive at all; the invite row is the record and the
 * copyable link in the office UI is the path that always works. Nothing here throws —
 * callers get a result and record it.
 */

export type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Resend's shared sender works out of the box, so only the API key has to be set.
 * Point EMAIL_FROM at your own address once a domain is verified — until then mail
 * from the shared sender reaches the account owner and little else.
 */
function senderAddress(): string {
  return process.env.EMAIL_FROM ?? "TutorLog <onboarding@resend.dev>";
}

function apiKey(): string | null {
  return process.env.RESEND_API_KEY ?? null;
}

/** Whether an attempt is even worth making. The UI uses this to set expectations. */
export function emailConfigured(): boolean {
  return Boolean(apiKey());
}

/**
 * The app's public origin, for links that have to survive leaving the browser.
 * `VERCEL_PROJECT_PRODUCTION_URL` is injected on Vercel and carries no scheme.
 */
export function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

export function inviteUrl(token: string): string {
  return `${appOrigin()}/invite/${token}`;
}

type Message = {
  to: string;
  subject: string;
  text: string;
};

/** The one provider-specific call. Resend's REST API — no SDK, so nothing to pin. */
async function deliver(message: Message): Promise<SendResult> {
  const key = apiKey();

  if (!key) {
    return {
      ok: false,
      error:
        "Email isn't configured yet, so nothing was sent — copy the invite link below instead.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: senderAddress(),
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      // The provider's own message is the useful part — a rejected sender domain reads
      // very differently from a bad key, and the office needs to see which it was.
      const detail = await response.text();
      return { ok: false, error: `${response.status}: ${detail.slice(0, 300)}` };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Send failed" };
  }
}

export async function sendInviteEmail(invite: {
  email: string;
  displayName: string;
  token: string;
  invitedByName: string;
  expiresAt: Date;
}): Promise<SendResult> {
  const url = inviteUrl(invite.token);
  const expires = invite.expiresAt.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return deliver({
    to: invite.email,
    subject: "Your TutorLog account",
    text: [
      `Hi ${invite.displayName},`,
      "",
      `${invite.invitedByName} has set up a TutorLog account for you at Literacy`,
      "Volunteers of America, Essex/Passaic County. TutorLog is where you'll record",
      "your tutoring hours and your students' progress.",
      "",
      "Open this link to choose a username and password:",
      url,
      "",
      `The link works until ${expires}. If it expires, ask the office for a new one.`,
    ].join("\n"),
  });
}
