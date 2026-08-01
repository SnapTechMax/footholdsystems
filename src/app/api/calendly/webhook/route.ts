import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

/**
 * Calendly webhook. Sets a `booked` property on the Resend contact so the
 * nurture sequence can stop asking someone to book something they have booked.
 *
 * A condition step in the automation reads that property before every send and
 * ends the run for anyone marked booked, so this endpoint only supplies the fact.
 *
 * Signature verification follows the scheme Calendly shares with Stripe and
 * others: a `Calendly-Webhook-Signature` header of the form
 * `t=<unix seconds>,v1=<hex hmac>`, where the HMAC is SHA-256 over
 * `<t>.<raw request body>` keyed with the signing key issued when the webhook
 * subscription was created.
 *
 * This fails closed. A request that cannot be verified is rejected rather than
 * trusted, because the endpoint changes who receives email. The rejection reason
 * is logged so a mismatch shows up as a clear line rather than silence.
 */

const TOLERANCE_SECONDS = 300;

interface CalendlyPayload {
  event?: string;
  payload?: {
    email?: string;
    name?: string;
    scheduled_event?: { start_time?: string; name?: string };
  };
}

/** Parse `t=...,v1=...` into its parts. */
function parseSignatureHeader(header: string | null): {
  timestamp: string;
  signature: string;
} | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header
      .split(",")
      .map((pair) => pair.trim().split("="))
      .filter((entry) => entry.length === 2)
  );
  if (!parts.t || !parts.v1) return null;
  return { timestamp: parts.t, signature: parts.v1 };
}

function verify(rawBody: string, header: string | null, secret: string): string | null {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return "malformed or missing Calendly-Webhook-Signature header";

  // Reject stale requests so a captured payload can't be replayed later.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(parsed.timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return `timestamp outside the ${TOLERANCE_SECONDS}s tolerance (off by ${age}s)`;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(parsed.signature, "utf8");
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return "signature did not match";
  }
  return null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.CALENDLY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Calendly webhook received but CALENDLY_WEBHOOK_SECRET is unset");
    return NextResponse.json(
      { ok: false, error: "Webhook not configured." },
      { status: 503 }
    );
  }

  // Raw body, not request.json() — the HMAC is over the exact bytes sent.
  const rawBody = await request.text();

  const failure = verify(
    rawBody,
    request.headers.get("calendly-webhook-signature"),
    secret
  );
  if (failure) {
    console.error(`Calendly webhook rejected: ${failure}`);
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }

  let body: CalendlyPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const email = body.payload?.email?.trim().toLowerCase();
  const eventName = body.event ?? "";

  // invitee.created is a booking; invitee.canceled puts them back in the funnel.
  const booked =
    eventName === "invitee.created"
      ? "yes"
      : eventName === "invitee.canceled"
        ? "no"
        : null;

  if (!email || booked === null) {
    // Acknowledge anything else so Calendly doesn't retry a payload we ignore.
    return NextResponse.json({ ok: true, ignored: eventName || "unknown" });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.contacts.update({
      email,
      properties: { booked },
    });
    if (error) {
      console.error(`Calendly webhook: contact update failed for ${email}:`, error.message);
      // Still 200. The booking is real and already recorded in Calendly, and a
      // retry would not fix a contact Resend has never seen, which is what
      // happens when someone books without ever downloading the guide.
      return NextResponse.json({ ok: false, error: "Contact update failed." });
    }
  } catch (error) {
    console.error("Calendly webhook: contact update threw:", error);
    return NextResponse.json({ ok: false, error: "Contact update failed." });
  }

  console.log(`Calendly ${eventName}: marked ${email} booked=${booked}`);
  return NextResponse.json({ ok: true, event: eventName, booked });
}
