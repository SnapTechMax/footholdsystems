import type { Site } from "./site";
import { na, pass, warn, type CheckFn, type CheckOutcome } from "./check";

/**
 * The Payments layer: can an agent pay you?
 *
 * Every one of these is a bonus check in Ora's scoring, so nothing here can
 * cost a point; they surface as opportunities on an eCommerce report and
 * are excluded everywhere else. Two rules copied from Ora keep them honest:
 * a site with no commerce signals reads N/A across the board, and the five
 * protocols are OR-scored — supporting any one is enough, and the rest read
 * N/A rather than as failures.
 */

const NOT_COMMERCE = "No commerce signals detected - agent-payment protocols are optional for non-commerce sites";

interface PaymentSurface {
  ucp: { version: string; capabilities: string[] } | null;
  acp: "live" | "headers" | null;
  x402: boolean;
  /** Which protocols the site's own text mentions, for the "documented" wording. */
  mentions: Set<string>;
}

function detectPayments(site: Site): Promise<PaymentSurface> {
  return site.once("payments", async () => {
    const text = `${site.page.text}\n${(await site.llmsTxt())?.body ?? ""}`;
    const mentions = new Set<string>();
    const mentionOf: [string, RegExp][] = [
      ["acp", /agentic commerce protocol|shared payment token|checkout_sessions/i],
      ["ucp", /universal commerce protocol|\bucp\b/i],
      ["ap2", /agent payments protocol|\bap2\b/i],
      ["mpp", /machine payments? protocol|\bmpp\b/i],
      ["x402", /\bx402\b/i],
    ];
    for (const [name, re] of mentionOf) if (re.test(text)) mentions.add(name);

    const ucpDoc = await site.json("/.well-known/ucp");
    const ucpData = (ucpDoc?.data ?? {}) as Record<string, unknown>;
    const ucp =
      ucpDoc && typeof ucpData.version === "string"
        ? {
            version: ucpData.version,
            capabilities: JSON.stringify(ucpData.capabilities ?? ucpData.services ?? "")
              .match(/[\w.]+/g) ?? [],
          }
        : null;

    let acp: PaymentSurface["acp"] = null;
    const options = await site.fetch("/checkout_sessions", { method: "OPTIONS", maxBytes: 8_000 });
    const allow = `${options.headers?.get("allow") ?? ""} ${options.headers?.get("access-control-allow-methods") ?? ""}`;
    if (options.status < 400 && /POST/i.test(allow)) acp = "live";
    else {
      const post = await site.fetch("/checkout_sessions", { method: "POST", body: "{}", maxBytes: 8_000 });
      if (post.contentType.includes("json") && /supported_versions|idempotency|api-version/i.test(post.body)) acp = "live";
      else if (post.headers?.get("api-version") || post.headers?.get("supported-versions")) acp = "headers";
    }

    const x402Doc = await site.json("/discovery/resources");
    const x402 = x402Doc !== null && Array.isArray((x402Doc.data as { items?: unknown; resources?: unknown }).items ?? (x402Doc.data as { resources?: unknown }).resources);

    return { ucp, acp, x402, mentions };
  });
}

/** The N/A a protocol reads when a sibling already covers the site. */
function coveredBy(name: string): CheckOutcome {
  return na(`Covered by ${name} - supporting any one agentic payment protocol is sufficient`);
}

function anyLive(surface: PaymentSurface): string | null {
  if (surface.ucp) return "UCP";
  if (surface.acp === "live") return "ACP";
  if (surface.x402) return "x402";
  return null;
}

const acpSupport: CheckFn = async (site) => {
  if (!site.hasCommerceSignals) return na(NOT_COMMERCE);
  const surface = await detectPayments(site);
  if (surface.acp === "live") return pass(3, "Live ACP checkout endpoint at /checkout_sessions (preflight allows POST or ACP-shaped error returned)");
  const live = anyLive(surface);
  if (live) return coveredBy(live);
  if (surface.acp === "headers" || surface.mentions.has("acp")) {
    return warn(0, "ACP text signals present but no live /checkout_sessions endpoint answered in ACP shape");
  }
  return warn(0, "no ACP (Agentic Commerce Protocol) signals detected");
};

const ucpSupport: CheckFn = async (site) => {
  if (!site.hasCommerceSignals) return na(NOT_COMMERCE);
  const surface = await detectPayments(site);
  if (surface.ucp) return pass(3, `UCP discovery profile at /.well-known/ucp (version ${surface.ucp.version})`);
  const live = anyLive(surface);
  if (live) return coveredBy(live);
  if (surface.mentions.has("ucp")) return warn(0, "UCP text signals (universal commerce protocol) but no /.well-known/ucp profile found");
  return warn(0, "no UCP (Universal Commerce Protocol) signals detected");
};

const ap2Support: CheckFn = async (site) => {
  if (!site.hasCommerceSignals) return na(NOT_COMMERCE);
  const surface = await detectPayments(site);
  if (surface.ucp?.capabilities.some((c) => /ap2/i.test(c))) {
    return pass(3, "AP2 mandate capability advertised in the UCP discovery profile");
  }
  const live = anyLive(surface);
  if (live) return coveredBy(live);
  if (surface.mentions.has("ap2")) return warn(0, "AP2 documented in site text; no mandate capability advertised in a UCP profile");
  return warn(0, "No AP2 (Agent Payments Protocol) signals detected");
};

const mppSupport: CheckFn = async (site) => {
  if (!site.hasCommerceSignals) return na(NOT_COMMERCE);
  const surface = await detectPayments(site);
  const live = anyLive(surface);
  if (live) return coveredBy(live);
  if (surface.mentions.has("mpp")) return warn(0, "MPP documented in site text; no live protocol surface found");
  return warn(0, "No MPP (Machine Payments Protocol) support detected");
};

const x402Support: CheckFn = async (site) => {
  if (!site.hasCommerceSignals) return na(NOT_COMMERCE);
  const surface = await detectPayments(site);
  if (surface.x402) return pass(2, "x402 Bazaar discovery endpoint found at /discovery/resources");
  const live = anyLive(surface);
  if (live) return coveredBy(live);
  if (surface.mentions.has("x402")) return warn(0, "x402 documented in site text; no live protocol surface found");
  return warn(0, "No x402 payment protocol support detected");
};

export const PAYMENT_CHECKS: Record<string, CheckFn> = {
  "acp-support": acpSupport,
  "ucp-support": ucpSupport,
  "ap2-support": ap2Support,
  "mpp-support": mppSupport,
  "x402-support": x402Support,
};
