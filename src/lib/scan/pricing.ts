/**
 * The two things someone can buy off the back of a scan.
 *
 * Prices live here as cents, not dollars, because that is what gets written to
 * `scan_orders.amount_cents` and what every payment provider expects. A float
 * of dollars that only ever gets multiplied by 100 is a rounding bug waiting
 * for a price ending in .99.
 */

export const SOLUTIONS_PRICE_CENTS = 4900;
export const DONE_FOR_YOU_PRICE_CENTS = 150_000;

export function formatPrice(cents: number): string {
  // No cents shown when the price is whole dollars — "$49", not "$49.00".
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export const SOLUTIONS_PRICE = formatPrice(SOLUTIONS_PRICE_CENTS);
export const DONE_FOR_YOU_PRICE = formatPrice(DONE_FOR_YOU_PRICE_CENTS);

/**
 * Canonical origin for links in outgoing email.
 *
 * Falls back to the production host rather than to localhost: an email is the
 * one output that can outlive the process that made it, and a report link
 * pointing at localhost is worse than no link.
 */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.footholdsystems.com"
  );
}

export function reportUrl(token: string): string {
  return `${siteUrl()}/scan/${token}`;
}

export function unsubscribeUrl(email: string): string {
  return `${siteUrl()}/api/scan/unsubscribe?email=${encodeURIComponent(email)}`;
}

/**
 * Whop checkout link for a scan.
 *
 * NOT YET WIRED. `WHOP_CHECKOUT_URL` is the plan checkout link from the Whop
 * dashboard (it looks like https://whop.com/checkout/plan_xxxxxxxx). Whop
 * passes `metadata[...]` query parameters through to the webhook payload
 * untouched, which is how a completed payment finds its way back to the right
 * scan — the token is the only thing tying the two together, so it must be on
 * every checkout link.
 *
 * Returns null when unset. Every caller has to handle that, because the
 * alternative is an email with a dead "Pay now" button in it, which costs more
 * than showing no button at all.
 */
export function checkoutUrl(
  token: string,
  product: "solutions" | "done_for_you" = "solutions"
): string | null {
  const base =
    product === "done_for_you"
      ? process.env.WHOP_CHECKOUT_URL_DONE_FOR_YOU
      : process.env.WHOP_CHECKOUT_URL;
  if (!base) return null;

  try {
    const url = new URL(base);
    url.searchParams.set("metadata[scan_token]", token);
    url.searchParams.set("metadata[product]", product);
    return url.toString();
  } catch {
    return null;
  }
}
