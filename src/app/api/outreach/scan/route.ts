import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CATEGORY, isBusinessCategory } from "@/lib/scan/categories";
import { createOutreachScan, initScanSchema } from "@/lib/scan/db";
import { normaliseDomain } from "@/lib/scan/ora";
import { auditUrl } from "@/lib/scan/pricing";
import { outreachAuthorised, unauthorised } from "./auth";

/**
 * Queues an outreach scan for a cold prospect, over HTTP.
 *
 * The same work /admin/outreach does, reachable by the outbound mailer. That
 * panel is a Server Action, dispatched by a `Next-Action` header, so it is not
 * something another service can call — this is the door for one that needs to.
 *
 * QUEUE ONLY, deliberately. The scan itself is left to the sweeper that already
 * runs every ten minutes and already picks these rows up (`findStuckScans` does
 * not filter on `outreach`). Running it inline would hold the caller open for
 * the 13-25s a cold crawl takes, and would put the whole batch through Is
 * Agentic's 10-a-minute burst limit — which is shared with the public form,
 * the thing that must not be starved for cold outbound.
 *
 * Nothing here emails the prospect. `runScanJob` returns early on an outreach
 * row, by design, and the report is read at /audit/<token> from a link a human
 * put in a cold email.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One domain per call. Batching belongs to the caller's own pacing. */
export async function POST(request: NextRequest) {
  if (!outreachAuthorised(request)) return unauthorised();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const input = (body ?? {}) as { url?: unknown; category?: unknown };
  if (typeof input.url !== "string") {
    return NextResponse.json({ error: "`url` is required." }, { status: 400 });
  }

  // The same normaliser the public form uses, so one spelling of a host is one
  // cache entry — and so we are never pointed at an internal address.
  const domain = normaliseDomain(input.url);
  if (!domain) {
    return NextResponse.json(
      { error: "That is not a website address we can scan.", field: "url" },
      { status: 422 }
    );
  }

  const category = isBusinessCategory(input.category)
    ? input.category
    : DEFAULT_CATEGORY;

  await initScanSchema();
  const scan = await createOutreachScan({
    domain,
    url: `https://${domain}`,
    category,
  });

  return NextResponse.json(
    {
      token: scan.token,
      domain,
      category,
      // `reused` means a completed scan of this domain from the last 24h was
      // handed back, so the caller can poll once and be done.
      reused: scan.reused,
      status: scan.reused ? "complete" : "queued",
      auditUrl: auditUrl(scan.token),
    },
    { status: scan.reused ? 200 : 202, headers: { "Cache-Control": "no-store" } }
  );
}
