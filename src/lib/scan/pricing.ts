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
 * Where a buy button points.
 *
 * Our own route, never Whop directly. A Whop checkout has to be created
 * server-side per buyer so the scan token can be attached as metadata, and
 * metadata is the only thing tying a payment back to a report. A static link
 * cannot carry it, so there is no version of this that is a plain href to
 * whop.com.
 *
 * Always returns a URL. The route handles Whop being unreachable or
 * unconfigured, which is the right place for it: a caller cannot do anything
 * useful with a null except hide the button, and hiding the button loses the
 * sale even when the problem is momentary.
 */
export function checkoutUrl(
  token: string,
  product: "solutions" | "done_for_you" = "solutions"
): string {
  const params = new URLSearchParams({ token, product });
  return `${siteUrl()}/api/go/checkout?${params}`;
}
