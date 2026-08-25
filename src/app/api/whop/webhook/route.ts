import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  findLatestScanForEmail,
  getScanByToken,
  initScanSchema,
  recordPayment,
  type OrderProduct,
} from "@/lib/scan/db";
import {
  DONE_FOR_YOU_PRICE_CENTS,
  SOLUTIONS_PRICE_CENTS,
} from "@/lib/scan/pricing";

/**
 * Whop payment webhook — unlocks the paid half of a report.
 *
 * The scan token travels out as metadata on a checkout created through the API
 * (see lib/scan/whop.ts) and comes back here in `data.metadata`. That round
 * trip is the only thing connecting a payment to a report, so both halves have
 * to stay in step.
 *
 * Setup: in the Whop dashboard add a webhook pointing at POST
 * /api/whop/webhook subscribed to payment.succeeded, then set
 * WHOP_WEBHOOK_SECRET to the ws_ signing secret it gives you. Unset, every
 * delivery is rejected and no payment can ever unlock a report.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifies a Whop webhook against the Standard Webhooks specification.
 *
 * Whop implements Standard Webhooks, not a bespoke scheme, and every detail
 * matters because getting any of them wrong rejects every real payment while
 * looking like it is working. The first version of this file guessed at a
 * single `x-whop-signature` header carrying a hex HMAC over the bare body, and
 * all four of those assumptions were wrong.
 *
 * The contract, from docs.whop.com/developer/guides/webhooks:
 *
 *   headers   webhook-id, webhook-timestamp, webhook-signature (frozen, they
 *             do not change across API versions)
 *   signed    `{webhook-id}.{webhook-timestamp}.{raw body}`
 *   digest    HMAC-SHA256, base64, presented as `v1,<signature>`
 *   secret    a `ws_`-prefixed string, stored exactly as Whop gives it
 *   replay    reject anything more than five minutes from now
 *
 * Raw body, never a re-serialised object: JSON.stringify does not preserve key
 * order or spacing, so a round trip produces different bytes and a signature
 * that can never match.
 */

/** Five minutes, per the spec. Guards against a captured request being replayed. */
const TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Candidate signing keys derived from the stored secret.
 *
 * Standard Webhooks treats the part after the prefix as base64 and signs with
 * the decoded bytes, which is what Whop's own helper does. Whop's docs also say
 * to store the `ws_` string whole and let the helper derive the key, without
 * spelling out the derivation for anyone verifying by hand.
 *
 * Both derivations are tried rather than betting on one reading. This costs
 * nothing in security, since either candidate still requires knowing the
 * secret, and it avoids the failure mode where a misreading silently rejects
 * every genuine payment.
 */
function signingKeys(secret: string): Buffer[] {
  const keys: Buffer[] = [];
  const withoutPrefix = secret.startsWith("ws_") ? secret.slice(3) : secret;

  const decoded = Buffer.from(withoutPrefix, "base64");
  // Buffer.from tolerates junk rather than throwing, so a non-base64 secret
  // yields a short or empty buffer instead of an error. Length is the check.
  if (decoded.length > 0) keys.push(decoded);

  keys.push(Buffer.from(secret, "utf8"));
  return keys;
}

type VerifyResult = { ok: true } | { ok: false; reason: string };

function verifySignature(rawBody: string, request: NextRequest): VerifyResult {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  // Fails shut. An unverified endpoint that grants paid access on request is a
  // free unlock with extra steps.
  if (!secret) return { ok: false, reason: "WHOP_WEBHOOK_SECRET is not set" };

  const id = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const header = request.headers.get("webhook-signature");
  if (!id || !timestamp || !header) {
    return { ok: false, reason: "missing Standard Webhooks headers" };
  }

  const sent = Number(timestamp);
  if (!Number.isFinite(sent)) {
    return { ok: false, reason: "webhook-timestamp is not a number" };
  }
  const drift = Math.abs(Date.now() / 1000 - sent);
  if (drift > TIMESTAMP_TOLERANCE_SECONDS) {
    return {
      ok: false,
      reason: `webhook-timestamp is ${Math.round(drift)}s from now, outside the ${TIMESTAMP_TOLERANCE_SECONDS}s window`,
    };
  }

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = signingKeys(secret).map((key) =>
    createHmac("sha256", key).update(signedContent, "utf8").digest("base64")
  );

  // The header may carry several space-separated signatures during a secret
  // rotation, each tagged with a version. Any match is a pass.
  const provided = header
    .split(" ")
    .map((part) => (part.includes(",") ? part.slice(part.indexOf(",") + 1) : part))
    .filter(Boolean);

  for (const candidate of provided) {
    for (const valid of expected) {
      if (safeEqual(candidate, valid)) return { ok: true };
    }
  }
  return { ok: false, reason: "no signature matched" };
}

/** Constant-time comparison, so response timing cannot be used to forge one. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, which is itself information;
  // check length first rather than letting it throw into a catch-all.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Digs the values we need out of a payload whose exact shape is Whop's business. */
function extract(payload: unknown): {
  token: string | null;
  email: string | null;
  product: OrderProduct;
  reference: string | null;
  amountCents: number | null;
} {
  const root = (payload ?? {}) as Record<string, unknown>;
  // Providers commonly nest the interesting part under `data`.
  const data = (root.data ?? root) as Record<string, unknown>;
  const metadata = (data.metadata ?? root.metadata ?? {}) as Record<string, unknown>;

  const token =
    typeof metadata.scan_token === "string" ? metadata.scan_token : null;

  // Purchases from the nurture sequence carry no token, because the link lives
  // in an email rather than on a report page. All they can pass is who clicked,
  // which is enough to find the scan the order belongs to.
  const email =
    typeof metadata.email === "string" && metadata.email.includes("@")
      ? metadata.email
      : null;

  const product: OrderProduct =
    metadata.product === "done_for_you" ? "done_for_you" : "solutions";

  const reference =
    typeof data.id === "string"
      ? data.id
      : typeof root.id === "string"
        ? root.id
        : null;

  const rawAmount = data.final_amount ?? data.amount ?? data.subtotal;
  const amountCents =
    typeof rawAmount === "number" && Number.isFinite(rawAmount)
      ? // Whop reports dollars; everything we store is cents.
        Math.round(rawAmount * 100)
      : null;

  return { token, email, product, reference, amountCents };
}

/**
 * Flags the Resend contact so the automation's condition step ends their run.
 *
 * The property name has to match CONVERTED_PROPERTY in
 * scripts/create-email-sequence.mjs. Resend contact properties are string or
 * number only, hence "yes" rather than a boolean.
 */
async function markConverted(email: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const property = process.env.SEQUENCE_CONVERTED_PROPERTY || "converted";
  try {
    const { error } = await new Resend(apiKey).contacts.update({
      email,
      properties: { [property]: "yes" },
    });
    if (error) {
      console.error(`[whop] could not mark ${email} converted:`, error.message);
    }
  } catch (error) {
    console.error("[whop] contact update threw:", error);
  }
}

/**
 * The only event that unlocks anything.
 *
 * Whop sends 40+ event types and the first version of this handler checked
 * none of them, so `payment.failed` and `payment.pending` would each have
 * granted access exactly as `payment.succeeded` does. Anything not on this
 * list is acknowledged and ignored.
 */
const UNLOCKING_EVENTS = new Set(["payment.succeeded"]);

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const verified = verifySignature(rawBody, request);
  if (!verified.ok) {
    // Reason logged, never returned: telling an unauthenticated caller which
    // part of their forgery was wrong is free help.
    console.warn(`[whop] rejected webhook: ${verified.reason}`);
    return NextResponse.json({ error: "Bad signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
  }

  const eventType =
    payload && typeof payload === "object" && "type" in payload
      ? String((payload as { type: unknown }).type)
      : "";

  if (!UNLOCKING_EVENTS.has(eventType)) {
    // 200, so Whop stops retrying something we have correctly decided to skip.
    return NextResponse.json({ ok: true, ignored: `event ${eventType || "unknown"}` });
  }

  const { token, email, product, reference, amountCents } = extract(payload);

  if (!token && !email) {
    // 200, not 4xx: this is a real Whop event for something that isn't one of
    // ours (or an event type we don't handle), and a non-2xx would have Whop
    // retry it forever.
    console.warn("[whop] event with neither scan_token nor email — ignoring");
    return NextResponse.json({ ok: true, ignored: "nothing to match on" });
  }

  try {
    await initScanSchema();

    // Token first, because it names one exact scan. Email is the fallback for
    // sequence purchases and resolves to that person's most recent scan.
    const scan = token
      ? await getScanByToken(token)
      : await findLatestScanForEmail(email as string);

    if (!scan) {
      // Loud, because somebody has paid and we cannot say what for. This needs
      // a human, so it is a warning with enough detail to go and find them.
      console.warn(
        `[whop] payment recorded nowhere: no scan for ${
          token ? `token ${token.slice(0, 8)}…` : `email ${email}`
        }, product ${product}, ref ${reference ?? "unknown"}`
      );
      return NextResponse.json({ ok: true, ignored: "unknown scan" });
    }

    const { alreadyPaid } = await recordPayment({
      scanId: scan.id,
      product,
      // Trust our own price list over the payload. The amount in a webhook is
      // what the provider says was charged; the amount we record is what the
      // product costs, and a mismatch should show up in reconciliation rather
      // than be silently absorbed.
      amountCents:
        amountCents ??
        (product === "done_for_you"
          ? DONE_FOR_YOU_PRICE_CENTS
          : SOLUTIONS_PRICE_CENTS),
      provider: "whop",
      // Falls back to a deterministic reference so the row is still traceable
      // if a payload arrives without an id.
      providerRef: reference ?? `whop:${token ?? email}:${product}`,
    });

    // End the nurture sequence for this person. Every remaining email pitches
    // the thing they have just bought, and the fastest way to turn a new
    // customer into an unsubscribe is to keep selling to them.
    //
    // Best-effort and after the payment is recorded: the money is the part that
    // must not be lost, and a contact update failing is an annoyance rather
    // than a loss. Only for the done-for-you tier, because buying the $49
    // report is not a reason to stop making the case for the upgrade.
    if (product === "done_for_you" && !alreadyPaid) {
      await markConverted(scan.email);
    }

    return NextResponse.json({ ok: true, alreadyPaid });
  } catch (error) {
    console.error("[whop] webhook failed:", error);
    // 500 so Whop retries — a dropped payment event means someone paid and
    // never got what they bought.
    return NextResponse.json({ error: "Could not record payment." }, { status: 500 });
  }
}
