import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { sendPurchase } from "@/lib/meta-capi";
import { alertUnmatchedPayment, notifySale } from "@/lib/scan/alert";
import { markConverted } from "@/lib/scan/converted";
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
  /** Returned whole so an unmatched payment can be reported with everything
   *  Whop actually sent, rather than with the four fields we knew to look for. */
  metadata: Record<string, unknown>;
  /** The cold-email batch tag, which gets its own column on the order. */
  emailKey: string | null;
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

  // The cold-email batch, set by /api/go/checkout and /api/go/upgrade. Pulled
  // out here rather than read from the JSON later because it gets its own
  // column: grouping revenue by batch is the question outbound exists to ask.
  const emailKey =
    typeof metadata.email_key === "string" ? metadata.email_key : null;

  const reference =
    typeof data.id === "string"
      ? data.id
      : typeof root.id === "string"
        ? root.id
        : null;

  /**
   * What the buyer was charged, in the field names v1 actually uses.
   *
   * This read `final_amount ?? amount ?? subtotal` for its whole life. Neither
   * of the first two exists on a v1 payment — `final_amount` is the v2 name —
   * so every payment fell through to `subtotal`, which was right only by luck,
   * on a sale with no discount and no tax.
   *
   * `total` is the charge. `subtotal` stays as the fallback because it is the
   * nearest thing if `total` is ever absent. `amount_after_fees` is
   * deliberately not used: that is net of Whop's cut, which is a different fact
   * from what the customer paid, and this column holds the second one.
   */
  const rawAmount = data.total ?? data.subtotal;
  const amountCents =
    typeof rawAmount === "number" && Number.isFinite(rawAmount)
      ? // Whop reports dollars; everything we store is cents.
        Math.round(rawAmount * 100)
      : null;

  return { token, email, product, reference, amountCents, metadata, emailKey };
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

  const { token, email, product, reference, amountCents, metadata, emailKey } =
    extract(payload);

  if (!token && !email) {
    // 200, not 4xx: this is a real Whop event for something that isn't one of
    // ours (or an event type we don't handle), and a non-2xx would have Whop
    // retry it forever.
    console.warn("[whop] event with neither scan_token nor email — ignoring");
    // But somebody has still paid. `payment.succeeded` got this far, so this is
    // money with no way home, and 200 is the response that guarantees nothing
    // else will ever mention it. See lib/scan/alert.ts.
    after(() =>
      alertUnmatchedPayment({
        reason: "The checkout carried no scan token and no email address.",
        reference,
        product,
        amountCents,
        token: null,
        email: null,
        metadata,
        eventType,
      })
    );
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
      // The log is not the alert. Nothing reads it, and this is the branch a
      // bad link in a cold email lands on every single time.
      after(() =>
        alertUnmatchedPayment({
          reason: token
            ? "The checkout carried a scan token that matches no scan."
            : "The checkout carried an email address that has never run a scan.",
          reference,
          product,
          amountCents,
          token,
          email,
          metadata,
          eventType,
        })
      );
      return NextResponse.json({ ok: true, ignored: "unknown scan" });
    }

    const expectedCents =
      product === "done_for_you" ? DONE_FOR_YOU_PRICE_CENTS : SOLUTIONS_PRICE_CENTS;

    /**
     * A charge that is not the list price is worth saying out loud.
     *
     * The likeliest cause is a pinned Whop plan whose price drifted from
     * pricing.ts, which charges every customer the wrong amount and is
     * otherwise only visible by reading the Whop dashboard. A discount or an
     * affiliate code lands here too, and is not a problem — hence a log rather
     * than an alert.
     */
    if (amountCents !== null && amountCents !== expectedCents) {
      console.warn(
        `[whop] charged ${amountCents}c for ${product} but the price list says ${expectedCents}c, ref ${reference ?? "unknown"}`
      );
    }

    const { alreadyPaid } = await recordPayment({
      scanId: scan.id,
      product,
      /**
       * What actually happened, with the price list as the fallback.
       *
       * The note here used to say the opposite: that our own price wins,
       * because a mismatch "should show up in reconciliation rather than be
       * silently absorbed". It had it backwards, and the code never did what it
       * said. Recording the list price is exactly what absorbs a mismatch — the
       * row then agrees with the source no matter what the customer was
       * charged. This is the money table, so it holds the money, and the
       * disagreement is logged above instead.
       */
      amountCents: amountCents ?? expectedCents,
      provider: "whop",
      // Falls back to a deterministic reference so the row is still traceable
      // if a payload arrives without an id.
      providerRef: reference ?? `whop:${token ?? email}:${product}`,
      // Both stored so /admin/sales can answer which email earned this without
      // anyone opening Whop. See the columns in initScanSchema.
      emailKey,
      metadata,
    });

    /**
     * The two things that happen once per sale, both behind `alreadyPaid`.
     *
     * Whop retries webhooks. The conversion carries a shared event_id so Meta
     * would collapse duplicates anyway, but not sending them is better than
     * relying on that, and a phone that buzzes again on every retry is one that
     * stops being read.
     *
     * The push goes first because it is for a person, and it never throws — see
     * lib/notify.ts. Both are awaited rather than left to `after()`, so neither
     * can be cut off by the function returning.
     */
    if (!alreadyPaid) {
      await notifySale({
        domain: scan.domain,
        token: scan.token,
        product,
        amountCents: amountCents ?? expectedCents,
        outreach: scan.outreach,
        emailKey,
        source: typeof metadata.source === "string" ? metadata.source : null,
      });

      // The server half of the Purchase conversion, and the more trustworthy
      // half. The browser event depends on the buyer returning through the
      // redirect and staying long enough for a script to run; this fires from
      // the system that actually took the money, so a customer who closes the
      // tab still counts and no extension can suppress it.
      await sendPurchase({
        token: scan.token,
        product,
        valueCents: expectedCents,
        // On an outreach scan this column holds the internal row every cold
        // audit hangs off, not the buyer. Their real address is in Whop, and
        // the token already identifies the sale.
        email: scan.outreach ? undefined : scan.email,
      });
    }

    // End the nurture sequence for this person. Every remaining email pitches
    // the thing they have just bought, and the fastest way to turn a new
    // customer into an unsubscribe is to keep selling to them.
    //
    // Best-effort and after the payment is recorded: the money is the part that
    // must not be lost, and a contact update failing is an annoyance rather
    // than a loss. Only for the done-for-you tier, because buying the $49
    // report is not a reason to stop making the case for the upgrade.
    //
    // Skipped for an outreach sale, where there is no sequence to end: the
    // buyer came from a cold email sent by hand and was never enrolled, and
    // the address on the row is our own internal one.
    if (product === "done_for_you" && !alreadyPaid && !scan.outreach) {
      await markConverted(scan.email);
    }

    if (scan.outreach && !alreadyPaid) {
      // Worth saying out loud in the log. A cold prospect who paid is the
      // outbound channel working, and nothing else in the system will mention
      // it — there is no lead row, no sequence and no email thread to find it
      // in later.
      console.info(
        `[whop] outreach sale: ${scan.domain} bought ${product} on token ${scan.token.slice(0, 8)}…`
      );
    }

    return NextResponse.json({ ok: true, alreadyPaid });
  } catch (error) {
    console.error("[whop] webhook failed:", error);
    // 500 so Whop retries — a dropped payment event means someone paid and
    // never got what they bought.
    return NextResponse.json({ error: "Could not record payment." }, { status: 500 });
  }
}
