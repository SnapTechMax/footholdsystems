import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { recordEngagement, type EngagementKind } from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * Resend webhook: delivery outcomes and, now, engagement.
 *
 * `delivered`, `bounced` and `complained` come from the receiving server's SMTP
 * response and from feedback loops — reported *to* the sender by the recipient's
 * provider, with nothing added to the message. They are also the figures that
 * matter most: a complaint rate is what Gmail and Yahoo judge a bulk sender on
 * (the threshold is 0.3%) and a bounce rate is what damages a sending domain.
 *
 * `clicked` and `opened` are a different trade, and this endpoint used to reject
 * both on principle. Opens need a 1×1 pixel and clicks need every link rewritten
 * through a redirector, and an unfamiliar redirector in a link is a bulk-mail
 * signal. That objection is answered — not removed — by the custom tracking
 * subdomain now configured on the domain: rewritten links point at
 * track.footholdsystems.com, which shares the registrable domain with the From
 * address and is covered by the same DMARC policy, so the link no longer sends
 * the reader somewhere unrelated to the sender.
 *
 * The pixel objection stands as it did. Opens are recorded because they were
 * asked for and are genuinely useful for spotting a dead segment, but clicks are
 * the metric to act on: an open now means an image loaded, which Apple Mail
 * Privacy Protection does on the reader's behalf whether or not anyone looked.
 *
 * Verification follows Svix's scheme, which Resend uses:
 *   svix-id, svix-timestamp, svix-signature
 *   signature = base64(HMAC-SHA256(`${id}.${timestamp}.${body}`, secret))
 * where the secret is `whsec_<base64>` and the HMAC key is the decoded part.
 *
 * Fails closed. A request that cannot be verified is rejected, because this
 * endpoint writes rows that inform decisions about the list.
 */

const TOLERANCE_SECONDS = 300;

interface ResendWebhookPayload {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    subject?: string;
    template_id?: string;
    broadcast_id?: string;
    bounce?: { type?: string; subType?: string; message?: string };
    /**
     * Clicks only. `email.opened` carries no equivalent object — its `data` is
     * the base payload and nothing more — so an open has no user agent, no IP
     * and no timestamp of its own, and is dated from the event's `created_at`.
     */
    click?: {
      link?: string;
      timestamp?: string;
      ipAddress?: string;
      userAgent?: string;
    };
  };
}

/** Payload `type` → the kind stored, and nothing else is recorded. */
const HANDLED: Record<string, EngagementKind> = {
  "email.clicked": "clicked",
  "email.opened": "opened",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

/** `whsec_<base64>` — the bytes after the prefix are the key. */
function signingKey(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return Buffer.from(raw, "base64");
}

function verify(
  rawBody: string,
  headers: Headers,
  secret: string
): string | null {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");

  if (!id || !timestamp || !signatureHeader) {
    return "missing svix-id, svix-timestamp or svix-signature";
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return `timestamp outside the ${TOLERANCE_SECONDS}s tolerance (off by ${age}s)`;
  }

  const expected = crypto
    .createHmac("sha256", signingKey(secret))
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");

  // The header carries space-separated `v1,<sig>` pairs — more than one while a
  // secret is being rotated, so any match counts.
  const candidates = signatureHeader
    .split(" ")
    .map((part) => part.split(",")[1])
    .filter((value): value is string => Boolean(value));

  const expectedBuf = Buffer.from(expected, "utf8");
  const matched = candidates.some((candidate) => {
    const candidateBuf = Buffer.from(candidate, "utf8");
    return (
      candidateBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(candidateBuf, expectedBuf)
    );
  });

  return matched ? null : "signature did not match";
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Resend webhook received but RESEND_WEBHOOK_SECRET is unset");
    return NextResponse.json(
      { ok: false, error: "Webhook not configured." },
      { status: 503 }
    );
  }

  // Raw body, not request.json() — the HMAC is over the exact bytes sent.
  const rawBody = await request.text();

  const failure = verify(rawBody, request.headers, secret);
  if (failure) {
    console.error(`Resend webhook rejected: ${failure}`);
    return NextResponse.json(
      { ok: false, error: "Invalid signature." },
      { status: 401 }
    );
  }

  let body: ResendWebhookPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const kind = body.type ? HANDLED[body.type] : undefined;
  if (!kind) {
    // Acknowledged so Resend stops retrying something we ignore on purpose:
    // email.sent, email.scheduled, the contact.* events and the rest.
    return NextResponse.json({ ok: true, ignored: body.type ?? "unknown" });
  }

  const data = body.data;
  const detail =
    kind === "bounced"
      ? [data?.bounce?.type, data?.bounce?.subType].filter(Boolean).join("/") ||
        null
      : null;

  // `svix-id` is the idempotency key. Resend retries a delivery it did not get a
  // 2xx for, reusing the id, so this is what collapses a retry — while leaving
  // three genuine clicks on three links in one email as three rows.
  const eventId = request.headers.get("svix-id");
  if (!eventId) {
    // Unreachable: verification above rejects a request without it. Narrowing
    // for the type checker, and a cheap guard if that order ever changes.
    return NextResponse.json({ ok: false, error: "Missing svix-id." }, { status: 400 });
  }

  const click = kind === "clicked" ? data?.click : undefined;

  try {
    const outcome = await recordEngagement({
      eventId,
      kind,
      recipient: data?.to?.[0] ?? null,
      emailId: data?.email_id ?? null,
      templateId: data?.template_id ?? null,
      subject: data?.subject ?? null,
      link: click?.link ?? null,
      detail,
      userAgent: click?.userAgent ?? null,
      ipAddress: click?.ipAddress ?? null,
      // A click reports when it happened, and that can be days after the send.
      // Everything else is dated from the event itself.
      occurredAt: click?.timestamp ?? body.created_at ?? null,
    });
    if (outcome === "not-configured") {
      console.error(
        "Resend webhook verified but no database is configured — event dropped."
      );
    }
    // Said out loud so a replayed test looks different from a fresh one, and so
    // a deployment with no DATABASE_URL cannot answer "ok" while storing nothing.
    return NextResponse.json({ ok: true, event: body.type, recorded: outcome });
  } catch (error) {
    // Still 200. Resend would otherwise retry, and a retry cannot fix a write
    // that failed for a reason on our side.
    console.error("Resend webhook: event not recorded:", error);
    return NextResponse.json({ ok: false, error: "Not recorded." });
  }
}
