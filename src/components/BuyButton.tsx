"use client";

import { metaEventId } from "@/lib/meta-event-id";
import {
  DONE_FOR_YOU_PRICE_CENTS,
  SOLUTIONS_PRICE_CENTS,
} from "@/lib/scan/pricing";

/**
 * Every buy button on the site, so a checkout start is never untracked.
 *
 * The two tiers are not a funnel, whatever the page order suggests. The $1,497
 * build sits on the report under the $49 paywall with "You do not need to buy
 * the list first" written on it, and people take that door — so it has to be
 * measurable as its own path, from the click through to the sale, not inferred
 * as an upsell that only happens after a $49 purchase.
 *
 * Both halves carry `value`, which is the thing that makes them distinguishable
 * to Meta. `InitiateCheckout` on the $49 and on the $1,497 are the same event
 * name; without the price attached, delivery cannot tell that one of them is
 * worth thirty of the other, and it will happily optimise toward whichever is
 * easier to get.
 *
 * The pixel call here races the navigation and sometimes loses — a click that
 * leaves the page can cut the beacon off. That is why `/api/go/checkout` sends
 * the same event server-side with the same `eventID`: the reliable half fires
 * from our own route, this one adds the browser's cookies when it survives, and
 * Meta collapses the pair. Delaying the navigation to protect the pixel would
 * be the wrong trade — this is the click that takes the money.
 *
 * An anchor, not a button, so it still works with JavaScript off. The tracking
 * is what degrades, not the sale.
 */
const PRICE_CENTS: Record<"solutions" | "done_for_you", number> = {
  solutions: SOLUTIONS_PRICE_CENTS,
  done_for_you: DONE_FOR_YOU_PRICE_CENTS,
};

export function BuyButton({
  token,
  product,
  href,
  className = "",
  children,
}: {
  token: string;
  product: "solutions" | "done_for_you";
  /** Built by `checkoutUrl` on the server, so it can carry email campaign tags. */
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const value = PRICE_CENTS[product] / 100;

  const track = () => {
    window.fbq?.(
      "track",
      "InitiateCheckout",
      {
        value,
        currency: "USD",
        content_name: product,
        content_type: "product",
        content_ids: [product],
        num_items: 1,
      },
      { eventID: metaEventId.initiateCheckout(token, product) }
    );

    window.gtag?.("event", "begin_checkout", {
      value,
      currency: "USD",
      items: [{ item_id: product, item_name: product, price: value, quantity: 1 }],
    });
  };

  return (
    <a href={href} onClick={track} className={className}>
      {children}
    </a>
  );
}
