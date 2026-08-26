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
   * One purchase per product per scan — which is exactly what the database
   * enforces, via the partial unique index on scan_orders.
   */
  purchase(token: string, product: "solutions" | "done_for_you"): string {
    return `purchase:${token}:${product}`;
  },
};
