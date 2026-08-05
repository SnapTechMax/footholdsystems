import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { recordDelivery } from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * Resend delivery webhook.
 *
 * This is the answer to "how are my emails doing" that costs nothing.
 *
 * Open tracking cannot be done without a tracking pixel — no email protocol
 * reports an open, so every ESP that shows an open rate embeds a 1×1 image, and
 * that image is a bulk-mail signal wherever it comes from. A pixel was added
 * here and then removed for exactly that reason.
 *
 * These events are different in kind. `delivered`, `bounced` and `complained`
 * come from the receiving server's SMTP response and from feedback loops — they
 * are reported *to* the sender by the recipient's provider, not inferred from
 * something embedded in the message. Nothing is added to the email at all, so
 * there is no deliverability cost whatsoever.
 *
 * They are also the figures that actually matter. An open rate says an image
 * loaded. A complaint rate is the number Gmail and Yahoo judge a bulk sender on
 * — the threshold is 0.3% — and a bounce rate is what damages a sending domain.
 * Neither was visible anywhere before this.
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
  data?: {
    email_id?: string;
    to?: string[];
    subject?: string;
    bounce?: { type?: string; subType?: string; message?: string };
  };
}

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

  // Only the three that cost nothing to collect and mean something. `opened` and
  // `clicked` are deliberately ignored even if Resend is configured to send
  // them: both require Resend's own tracking, which injects a pixel and rewrites
  // links, and clicks are already recorded server-side by /api/go/book.
  const kind =
    body.type === "email.delivered"
      ? "delivered"
      : body.type === "email.bounced"
        ? "bounced"
        : body.type === "email.complained"
          ? "complained"
          : null;

  if (!kind) {
    // Acknowledged so Resend stops retrying something we ignore on purpose.
    return NextResponse.json({ ok: true, ignored: body.type ?? "unknown" });
  }

  try {
    await recordDelivery({
      kind,
      subject: body.data?.subject ?? null,
      recipient: body.data?.to?.[0] ?? null,
      emailId: body.data?.email_id ?? null,
      detail:
        kind === "bounced"
          ? [body.data?.bounce?.type, body.data?.bounce?.subType]
              .filter(Boolean)
              .join("/") || null
          : null,
    });
  } catch (error) {
    // Still 200. Resend would otherwise retry, and a retry cannot fix a write
    // that failed for a reason on our side.
    console.error("Resend webhook: delivery not recorded:", error);
    return NextResponse.json({ ok: false, error: "Not recorded." });
  }

  return NextResponse.json({ ok: true, event: body.type });
}
