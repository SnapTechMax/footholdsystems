"use client";

import { useEffect } from "react";

/**
 * Fires the Purchase conversion once, on the page the buyer returns to.
 *
 * Meta optimises toward whatever you tell it a win looks like. With PageView
 * and Lead alone it learns to find people who fill in the form, which is not
 * the same population as people who pay — so the purchase events are the ones
 * that decide whether ad spend compounds or plateaus.
 *
 * THREE GUARDS, because a Purchase event that fires twice is worse than one
 * that never fires: it teaches the optimiser that a cohort converts at double
 * its real rate, and the spend follows.
 *
 *   1. The server only renders this when `isPaid` is true for the product, so
 *      no amount of URL fiddling produces a conversion without a recorded
 *      payment behind it.
 *   2. `justPurchased` — set only on the redirect the checkout builds — means a
 *      buyer re-reading their report next week does not fire a second one.
 *   3. localStorage, keyed by token and product, catches the refresh that keeps
 *      the marker in the address bar.
 *
 * Guard 3 is per-browser, so the same purchase opened on a phone and a laptop
 * can double-count. Guard 2 makes that unlikely — the marker only exists on the
 * URL Whop hands back — and closing it properly means the Conversions API with
 * a shared `eventID`, which is a server-side change worth doing on its own.
 */

const STORAGE_PREFIX = "fh_purchase";

export function PurchasePixel({
  token,
  product,
  value,
  justPurchased,
}: {
  token: string;
  product: "solutions" | "done_for_you";
  /** Dollars, not cents — this is what Meta reports as revenue. */
  value: number;
  /** True only when the checkout redirect brought them here. */
  justPurchased: boolean;
}) {
  useEffect(() => {
    if (!justPurchased) return;

    const key = `${STORAGE_PREFIX}:${token}:${product}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, String(Date.now()));
    } catch {
      // Private browsing, or storage disabled. Firing once too often is a
      // better failure here than never recording the sale at all.
    }

    window.fbq?.("track", "Purchase", {
      value,
      currency: "USD",
      content_name: product,
      content_type: "product",
      content_ids: [product],
    });

    window.gtag?.("event", "purchase", {
      // The scan token doubles as the order id: one purchase of a product per
      // scan, enforced by the partial unique index on scan_orders.
      transaction_id: `${token}:${product}`,
      value,
      currency: "USD",
      items: [{ item_id: product, item_name: product, price: value, quantity: 1 }],
    });
  }, [token, product, value, justPurchased]);

  return null;
}
