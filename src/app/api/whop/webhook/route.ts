import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
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
 * NOT YET CONNECTED. What is here is the receiving end: signature check,
 * payload parsing, idempotent write. To finish it, in the Whop dashboard add a
 * webhook pointing at POST /api/whop/webhook for the payment-succeeded event,
 * then set WHOP_WEBHOOK_SECRET to the signing secret it gives you and
 * WHOP_CHECKOUT_URL to the plan's checkout link.
 *
 * The scan token travels out on the checkout link as `metadata[scan_token]`
 * and comes back in the webhook payload. That round trip is the only thing
 * connecting a payment to a report, so both halves have to stay in step —
 * see checkoutUrl() in pricing.ts.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifies the signature over the raw body.
 *
 * Raw, not re-serialised: JSON.stringify does not guarantee key order or
 * spacing, so a round trip through an object produces different bytes and a
 * signature that never matches. This is the classic way webhook verification
 * silently fails.
 *
 * Whop's exact header and digest format should be confirmed against their docs
 * when the webhook is set up — the shape below (hex HMAC-SHA256 over the body)
 * is the common one, and the header name is read from an env var so correcting
 * it does not need a deploy.
 */
function verifySignature(rawBody: string, request: NextRequest): boolean {
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  // Fails shut. An unverified endpoint that grants paid access on request is
  // just a free unlock with extra steps.
  if (!secret) return false;

  const headerName = process.env.WHOP_SIGNATURE_HEADER || "x-whop-signature";
  const provided = request.headers.get(headerName);
  if (!provided) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  // Some providers prefix the digest ("sha256=..."); tolerate both.
  const candidate = provided.includes("=")
    ? provided.slice(provided.indexOf("=") + 1).trim()
    : provided.trim();

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(candidate, "utf8");
  // timingSafeEqual throws on a length mismatch, which is itself a signal —
  // check length first rather than letting it throw into the catch-all.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifySignature(rawBody, request)) {
    return NextResponse.json({ error: "Bad signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
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

    return NextResponse.json({ ok: true, alreadyPaid });
  } catch (error) {
    console.error("[whop] webhook failed:", error);
    // 500 so Whop retries — a dropped payment event means someone paid and
    // never got what they bought.
    return NextResponse.json({ error: "Could not record payment." }, { status: 500 });
  }
}
