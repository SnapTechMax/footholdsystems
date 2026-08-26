import "server-only";
import type { OrderProduct } from "./db";
import {
  DONE_FOR_YOU_PRICE_CENTS,
  SOLUTIONS_PRICE_CENTS,
  siteUrl,
} from "./pricing";

/**
 * Creates Whop checkout configurations.
 *
 * Static checkout links from the Whop dashboard cannot carry metadata, and
 * metadata is the entire mechanism: the scan token goes out on the checkout and
 * comes back on the webhook, and that round trip is the only thing tying a
 * payment to a report. So every checkout is created server-side, per buyer,
 * with the metadata attached at creation.
 *
 * Contract, from docs.whop.com/api-reference/checkout-configurations:
 *
 *   POST https://api.whop.com/api/v1/checkout_configurations
 *   Authorization: Bearer <account API key>
 *   body: { mode: "payment", plan: { company_id, currency, plan_type,
 *           initial_price }, metadata, redirect_url }
 *   → { id: "ch_…", plan: { id: "plan_…" }, purchase_url: "/checkout/ch_…/" }
 *
 * Note `company_id` sits INSIDE `plan`, not at the top level as `account_id`.
 * The prose guide shows the older shape; the API reference is the one that
 * matches what the endpoint accepts.
 *
 * The key needs five permissions, not the two that sound sufficient:
 * checkout_configuration:create, plan:create, access_pass:create,
 * access_pass:update, checkout_configuration:basic:read. Creating a checkout
 * creates a plan, and creating a plan touches a product ("access pass"), so the
 * write scopes cascade.
 */

const API_URL = "https://api.whop.com/api/v1/checkout_configurations";
const CURRENCY = "usd";
const TIMEOUT_MS = 20_000;

export const WHOP_CONFIGURED = Boolean(
  process.env.WHOP_API_KEY && process.env.WHOP_ACCOUNT_ID
);

export interface CheckoutRequest {
  product: OrderProduct;
  /** Copied verbatim into the webhook payload as `data.metadata`. */
  metadata: Record<string, string>;
  /** Where Whop sends the buyer afterwards. */
  redirectUrl?: string;
}

export type CheckoutResult =
  | {
      ok: true;
      url: string;
      configId: string;
      planId: string | null;
      /** Which shape was used, so a health check can say. */
      mode: "fixed-plan" | "dynamic-plan";
    }
  | { ok: false; reason: string };

function priceDollarsFor(product: OrderProduct): number {
  const cents =
    product === "done_for_you" ? DONE_FOR_YOU_PRICE_CENTS : SOLUTIONS_PRICE_CENTS;
  // Whop takes dollars, we store cents. Divide once, here, rather than at each
  // call site where a stray cents value would silently become a $4,900 charge.
  return cents / 100;
}

/**
 * Whop rejects a dynamic plan whose title exceeds this, and says so only in a
 * 400 body that used to reach nothing but a function log.
 *
 * "FootHold AEO — full implementation" was 34 characters. Every $1,497 checkout
 * failed on it while the 25-character $49 title went through, so the expensive
 * half of the funnel was dead and the cheap half looked fine — which is exactly
 * the shape of bug that survives a casual test.
 */
const PLAN_TITLE_MAX = 30;

function titleFor(product: OrderProduct): string {
  const title =
    product === "done_for_you"
      ? "FootHold AEO — full build"
      : "FootHold AEO — your fixes";

  // Belt and braces. A future edit that pushes a title over the limit should
  // cost a truncated title on a Whop receipt, not a checkout that 400s and a
  // customer bounced back to the page they came from.
  return title.length > PLAN_TITLE_MAX
    ? title.slice(0, PLAN_TITLE_MAX).trimEnd()
    : title;
}

/**
 * A pre-made plan to bill against, when one is configured.
 *
 * Without these every click mints a brand new plan and touches a product, so a
 * dashboard accumulates one plan per checkout and revenue has no stable thing
 * to group by. With them, checkout just references a product that already
 * exists — which also drops the need for the plan and access-pass write
 * permissions, since nothing is being created.
 *
 * Optional. Unset, the dynamic path still works, so this can be adopted without
 * a flag day and rolled back by clearing a variable.
 */
function fixedPlanId(product: OrderProduct): string | undefined {
  const value =
    product === "done_for_you"
      ? process.env.WHOP_PLAN_ID_DONE_FOR_YOU
      : process.env.WHOP_PLAN_ID_SOLUTIONS;
  return value?.trim() || undefined;
}

/**
 * Resolves whatever `purchase_url` contains into an absolute URL.
 *
 * Documented as a path ("/checkout/ch_…/"), but returning an absolute URL later
 * would be an entirely reasonable change on their side, and prefixing one blindly
 * would produce https://whop.com/https://whop.com/…
 */
function absoluteUrl(purchaseUrl: string): string {
  if (/^https?:\/\//.test(purchaseUrl)) return purchaseUrl;
  return `https://whop.com${purchaseUrl.startsWith("/") ? "" : "/"}${purchaseUrl}`;
}

export async function createCheckout(
  request: CheckoutRequest
): Promise<CheckoutResult> {
  const apiKey = process.env.WHOP_API_KEY;
  const companyId = process.env.WHOP_ACCOUNT_ID;
  if (!apiKey || !companyId) {
    return { ok: false, reason: "WHOP_API_KEY or WHOP_ACCOUNT_ID is not set" };
  }

  const planId = fixedPlanId(request.product);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // Two shapes, and Whop treats them as alternatives: `plan_id` bills
      // against a product that already exists, `plan` creates one on the fly.
      // Preferring the first when it is configured is the whole point of the
      // fixed products — nothing is created, so nothing can fail validation.
      body: JSON.stringify({
        mode: "payment",
        ...(planId
          ? { plan_id: planId }
          : {
              plan: {
                company_id: companyId,
                currency: CURRENCY,
                plan_type: "one_time",
                initial_price: priceDollarsFor(request.product),
                title: titleFor(request.product),
              },
            }),
        metadata: request.metadata,
        redirect_url: request.redirectUrl ?? siteUrl(),
      }),
      cache: "no-store",
    });
  } catch (error) {
    clearTimeout(timer);
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      reason: aborted
        ? `Whop did not respond within ${TIMEOUT_MS / 1000}s`
        : `Could not reach Whop: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  clearTimeout(timer);

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    // Body included because a 403 here names the missing permission, which is
    // the single most useful thing to have in the log when this breaks.
    return {
      ok: false,
      reason: `Whop responded ${response.status}${body ? `: ${body.slice(0, 400)}` : ""}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, reason: "Whop returned a response that was not JSON" };
  }

  const data = (parsed ?? {}) as Record<string, unknown>;
  const purchaseUrl = typeof data.purchase_url === "string" ? data.purchase_url : null;
  const configId = typeof data.id === "string" ? data.id : null;
  if (!purchaseUrl || !configId) {
    return { ok: false, reason: "Whop response had no purchase_url or id" };
  }

  const plan = (data.plan ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    url: absoluteUrl(purchaseUrl),
    configId,
    planId: typeof plan.id === "string" ? plan.id : (planId ?? null),
    mode: planId ? "fixed-plan" : "dynamic-plan",
  };
}
