/**
 * The event ids the browser pixel and the Conversions API must agree on.
 *
 * Meta collapses a browser event and a server event into one when they share an
 * `event_id` and an `event_name`. That is the whole reason sending both is safe
 * rather than a way to double every conversion — and a double-counted
 * conversion is worse than a missing one, because it teaches ad delivery that a
 * cohort converts at twice its real rate and the spend follows.
 *
 * So the ids are DERIVED, never random. Both transports compute the same string
 * from the scan token, which is unique per report and known on both sides.
 *
 * Client-safe on purpose: no `server-only` import and no node builtins, because
 * the browser components import this too. If it ever needs a secret, it belongs
 * in meta-capi.ts instead and this file keeps only the string building.
 */

export const metaEventId = {
  /** One lead per scan. */
  lead(token: string): string {
    return `lead:${token}`;
  },
  /**
   * One report open per scan, ever — which is what `scans.report_opened_at`
   * enforces, so the browser half and the server half agree on when this is
   * allowed to happen rather than each keeping their own count.
   */
  reportOpened(token: string): string {
    return `report-opened:${token}`;
  },
  /**
   * One checkout start per product per scan.
   *
   * Deliberately not one per click. Somebody who bounces off the payment page
   * and comes back twice is one person with one intent, and deriving the id
   * from the token collapses those into a single signal — which matters more
   * here than elsewhere, because at this volume a handful of repeat clicks from
   * one indecisive visitor would visibly bend what Meta thinks intent looks
   * like. The cost is that genuine intent a week later is not counted again.
   */
  initiateCheckout(token: string, product: "solutions" | "done_for_you"): string {
    return `checkout:${token}:${product}`;
  },
  /**
   * One purchase per product per scan — which is exactly what the database
   * enforces, via the partial unique index on scan_orders.
   */
  purchase(token: string, product: "solutions" | "done_for_you"): string {
    return `purchase:${token}:${product}`;
  },
};
