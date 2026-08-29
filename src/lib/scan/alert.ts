import "server-only";
import { Resend } from "resend";
import { auditUrl, formatPrice, reportUrl } from "./pricing";
import { sendPush } from "@/lib/notify";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * Tells a human that money arrived and the system could not say what for.
 *
 * WHY THIS IS AN EMAIL AND NOT A LOG LINE. The webhook answers an unmatched
 * payment with 200 and a `console.warn`, and both of those are correct: a 4xx
 * would have Whop retry a delivery that will never match, and the event may
 * genuinely not be ours. But 200 plus a warning is indistinguishable from
 * nothing happening. The failure it hides is the expensive one — somebody paid
 * {DONE_FOR_YOU_PRICE}, no order row exists, no confirmation page was reached,
 * no agreement was handed over, and the customer is sitting on a Whop receipt
 * waiting to hear from a business that does not know they exist.
 *
 * The likeliest cause is a link. A checkout created without a scan token, or
 * with an address nobody has ever scanned, produces exactly this. `/api/go/
 * upgrade` can do it when a merge tag fails to substitute.
 *
 * BEST EFFORT, ALWAYS. Every path returns rather than throws. This runs inside
 * a webhook that must go on to answer Whop, and an alert about a lost payment
 * must never become the reason a payment is lost.
 */

/** Verified sender, same reasoning as run.ts. Not the reply-to address. */
const FROM_EMAIL =
  process.env.CONTACT_FROM_EMAIL || "maximilian@footholdsystems.com";

function notifyTo(): string {
  return process.env.CONTACT_TO_EMAIL || CONTACT_EMAIL;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface UnmatchedPayment {
  /** Why nothing matched, in words, for the top of the email. */
  reason: string;
  /** Whop's payment id, which is how this gets found in their dashboard. */
  reference: string | null;
  product: string;
  amountCents: number | null;
  /** What the token or address resolved to nothing, when there was one. */
  token: string | null;
  email: string | null;
  /** Everything Whop sent back, so the answer is in here somewhere. */
  metadata: Record<string, unknown>;
  eventType: string;
}

export async function alertUnmatchedPayment(
  payment: UnmatchedPayment
): Promise<void> {
  const amountForPush =
    payment.amountCents === null
      ? "A payment"
      : formatPrice(payment.amountCents);

  /**
   * Push first, and at high priority.
   *
   * This is the one alert in the system where the cost of being read late is a
   * customer sitting on a receipt from a business that does not know they
   * exist. It goes ahead of the email and bypasses quiet hours, and it is
   * awaited rather than fired off, so a Resend outage cannot swallow it.
   */
  await sendPush({
    title: `${amountForPush} paid and not recorded`,
    message: [
      payment.reason,
      `Product: ${payment.product}`,
      `Whop ref: ${payment.reference ?? "none in the payload"}`,
      "Find it in Whop, which has the buyer's real email.",
    ].join("\n"),
    priority: 1,
  });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(
      "[alert] unmatched payment and RESEND_API_KEY is unset — nothing sent."
    );
    return;
  }

  const amount =
    payment.amountCents === null ? "amount unknown" : formatPrice(payment.amountCents);

  // The subject carries the whole story, because this is read on a phone and
  // the decision it prompts is "open this now or later".
  const subject = `Payment not recorded: ${amount} ${payment.product}${
    payment.reference ? ` (${payment.reference})` : ""
  }`;

  const facts: [string, string][] = [
    ["Reason", payment.reason],
    ["Event", payment.eventType],
    ["Amount", amount],
    ["Product", payment.product],
    ["Whop reference", payment.reference ?? "none in the payload"],
    ["Token in metadata", payment.token ?? "none"],
    ["Email in metadata", payment.email ?? "none"],
  ];

  const metadataLines = Object.entries(payment.metadata).map(
    ([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`
  );

  const text = [
    "A Whop payment succeeded and nothing in the database matched it.",
    "",
    "The customer has paid and has not been given what they bought. No order",
    "row exists, so no admin screen will show them and nothing else will",
    "mention this again.",
    "",
    ...facts.map(([k, v]) => `${k}: ${v}`),
    "",
    "Metadata as received:",
    ...(metadataLines.length > 0 ? metadataLines : ["(empty)"]),
    "",
    "What to do: find the payment in the Whop dashboard, which has the buyer's",
    "real email on it, and contact them. Then work out which link they used —",
    "a checkout created without a scan token does this every time.",
  ].join("\n");

  const html = `
    <div style="font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1b1b1b;max-width:560px;">
      <p style="margin:0 0 16px;font-weight:700;font-size:17px;">
        A Whop payment succeeded and nothing matched it.
      </p>
      <p style="margin:0 0 20px;">
        The customer has paid and has not been given what they bought. No order
        row exists, so no admin screen will show them and nothing else will
        mention this again.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;">
        ${facts
          .map(
            ([k, v]) => `
        <tr>
          <td style="padding:0 12px 8px 0;white-space:nowrap;color:#6b6a63;">${escapeHtml(k)}</td>
          <td style="padding:0 0 8px;font-weight:600;">${escapeHtml(v)}</td>
        </tr>`
          )
          .join("")}
      </table>
      <p style="margin:0 0 6px;color:#6b6a63;">Metadata as received</p>
      <pre style="margin:0 0 20px;padding:12px;background:#f4f3ee;border-radius:6px;font:400 13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word;">${escapeHtml(
        metadataLines.length > 0 ? metadataLines.join("\n") : "(empty)"
      )}</pre>
      <p style="margin:0;">
        Find the payment in the Whop dashboard, which has the buyer's real email
        on it, and contact them. Then work out which link they used. A checkout
        created without a scan token does this every time.
      </p>
    </div>`;

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: `FootHold AEO <${FROM_EMAIL}>`,
      to: [notifyTo()],
      replyTo: CONTACT_EMAIL,
      subject,
      html,
      text,
    });
    if (error) {
      console.error("[alert] unmatched payment alert failed to send:", error);
    }
  } catch (error) {
    console.error("[alert] unmatched payment alert threw:", error);
  }
}

/**
 * A sale, on the phone, with the attribution already in it.
 *
 * The whole reason this is not Whop's own notification: Whop knows an amount
 * and a card, and this knows whose website it was and which cold email earned
 * it. Turn Whop's on as well — two independent alerts on the same event is the
 * right amount for money arriving — but this is the one worth reading.
 *
 * Normal priority, deliberately. It is good news and it keeps until morning.
 * The unmatched-payment alert above is the one that bypasses quiet hours.
 */
export async function notifySale(sale: {
  domain: string;
  token: string;
  product: string;
  amountCents: number;
  outreach: boolean;
  emailKey: string | null;
  source: string | null;
  simulated?: boolean;
}): Promise<void> {
  const what = sale.product === "done_for_you" ? "the build" : "the fix list";

  // Where the buyer came from, in the order the answer is interesting. Cold
  // outbound wins because it is the channel with a question outstanding.
  const origin = sale.outreach
    ? "Cold outreach"
    : sale.source === "sequence"
      ? "Nurture sequence"
      : "From the report";

  const lines = [
    `${sale.domain} bought ${what}.`,
    origin,
    sale.emailKey ? `Batch: ${sale.emailKey}` : null,
    sale.simulated ? "SIMULATED — no money changed hands." : null,
  ].filter(Boolean) as string[];

  await sendPush({
    title: `${formatPrice(sale.amountCents)} — ${sale.domain}`,
    message: lines.join("\n"),
    url: sale.outreach ? auditUrl(sale.token) : reportUrl(sale.token),
    urlTitle: "Open their report",
    priority: 0,
  });
}
