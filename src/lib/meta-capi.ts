import "server-only";
import { createHash } from "node:crypto";

/**
 * Meta Conversions API — the same events as the browser pixel, sent server-side.
 *
 * WHY BOTH: the browser pixel is the only half that sees a page, and the half
 * that gets blocked. Ad blockers, Brave, Safari's tracking prevention and iOS
 * all suppress `fbevents.js` silently, so a real customer converts and Meta
 * never hears about it. Optimising ad delivery against an undercount means
 * paying for it twice — once in the lost conversion and again in the worse
 * targeting it teaches.
 *
 * The purchase side is the stronger argument. A browser Purchase depends on the
 * buyer returning through the redirect and staying long enough for a script to
 * run. The Whop webhook is the system that actually took the money: it fires
 * whether or not anyone came back, and it cannot be blocked by an extension.
 *
 * DEDUPLICATION is what makes sending both safe rather than double-counting.
 * Every event carries an `event_id` derived from the scan token, and the
 * browser computes the identical string (see metaEventId, imported by the
 * client components). Meta collapses a browser and a server event that share an
 * event_id and an event_name into one. Getting this wrong in the other
 * direction — two events, no shared id — is the failure that teaches the
 * optimiser a cohort converts at twice its real rate, so the id is derived
 * rather than random on purpose.
 *
 * Never throws. Every caller is either a request path answering a customer or a
 * webhook recording a payment, and neither should fail because an analytics
 * endpoint did.
 */

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v25.0";

/** Server-side only. Generated in Events Manager → Settings → Conversions API. */
function accessToken(): string | undefined {
  return process.env.META_CAPI_ACCESS_TOKEN;
}

/** Shared with the browser tag, which is the point — one pixel, two transports. */
function pixelId(): string | undefined {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID;
}

export const CAPI_CONFIGURED = Boolean(
  process.env.META_CAPI_ACCESS_TOKEN && process.env.NEXT_PUBLIC_META_PIXEL_ID
);

// The ids both transports must agree on live in their own module, because the
// browser components import them too and this file is server-only.
import { metaEventId } from "./meta-event-id";

/** Meta wants email lowercased, trimmed, then SHA-256 hex. */
function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export interface CapiUserData {
  email?: string | null;
  /** Not hashed — Meta wants these raw, and uses them for match quality. */
  ip?: string | null;
  userAgent?: string | null;
  /** Meta's own browser cookies, when the request carried them. */
  fbp?: string | null;
  fbc?: string | null;
}

export interface CapiEvent {
  eventName: "Lead" | "Purchase";
  /** Must match what the browser sends. Use metaEventId. */
  eventId: string;
  /** The page the conversion belongs to, as Meta reports it. */
  eventSourceUrl?: string;
  userData: CapiUserData;
  customData?: Record<string, unknown>;
  /** Defaults to now. Pass the real time for a replayed webhook. */
  eventTime?: number;
}

/**
 * Sends one event. Resolves either way; the boolean is for logging and tests.
 *
 * Awaiting this in a request path costs a round trip to Meta, so callers should
 * put it inside `after()` where one exists.
 */
export async function sendCapiEvent(event: CapiEvent): Promise<boolean> {
  const token = accessToken();
  const pixel = pixelId();
  if (!token || !pixel) {
    // Not an error. The site runs without CAPI configured, and saying so once
    // per event would drown the logs.
    return false;
  }

  const user: Record<string, unknown> = {};
  if (event.userData.email) user.em = [hashEmail(event.userData.email)];
  if (event.userData.ip) user.client_ip_address = event.userData.ip;
  if (event.userData.userAgent) user.client_user_agent = event.userData.userAgent;
  if (event.userData.fbp) user.fbp = event.userData.fbp;
  if (event.userData.fbc) user.fbc = event.userData.fbc;

  const body = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        action_source: "website",
        ...(event.eventSourceUrl ? { event_source_url: event.eventSourceUrl } : {}),
        user_data: user,
        ...(event.customData ? { custom_data: event.customData } : {}),
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixel}/events`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        // Query string rather than a header: this is what Meta documents, and
        // the token is server-side only so it never reaches a browser.
        body: JSON.stringify({ ...body, access_token: token }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        `[capi] ${event.eventName} rejected ${response.status}: ${detail.slice(0, 300)}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      `[capi] ${event.eventName} failed:`,
      error instanceof Error ? error.message : String(error)
    );
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Convenience for the scan capture path. */
export async function sendLead(args: {
  token: string;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  sourceUrl?: string;
  category?: string;
}): Promise<boolean> {
  return sendCapiEvent({
    eventName: "Lead",
    eventId: metaEventId.lead(args.token),
    eventSourceUrl: args.sourceUrl,
    userData: {
      email: args.email,
      ip: args.ip,
      userAgent: args.userAgent,
      fbp: args.fbp,
      fbc: args.fbc,
    },
    customData: {
      content_name: "ai-visibility-scan",
      ...(args.category ? { content_category: args.category } : {}),
    },
  });
}

/** Convenience for the payment webhook. */
export async function sendPurchase(args: {
  token: string;
  product: "solutions" | "done_for_you";
  valueCents: number;
  email?: string | null;
}): Promise<boolean> {
  return sendCapiEvent({
    eventName: "Purchase",
    eventId: metaEventId.purchase(args.token, args.product),
    userData: { email: args.email },
    customData: {
      value: args.valueCents / 100,
      currency: "USD",
      content_name: args.product,
      content_type: "product",
      content_ids: [args.product],
    },
  });
}
