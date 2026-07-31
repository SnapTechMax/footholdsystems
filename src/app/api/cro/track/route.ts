import { NextRequest, NextResponse } from "next/server";
import { COOKIE_OPTIONS, VISITOR_COOKIE, variantCookieName } from "@/lib/cro/assign";
import {
  DATABASE_CONFIGURED,
  initSchema,
  recordBaselineEvent,
  recordEvent,
} from "@/lib/cro/db";
import type { VariantKey } from "@/lib/cro/types";

export const dynamic = "force-dynamic";

/**
 * Records that a visitor saw a variant, and pins them to it.
 *
 * Called from the browser rather than during the server render so that a page
 * render isn't blocked on a database write, and so obvious bot fetches that
 * never execute JavaScript don't count as impressions.
 */
export async function POST(request: NextRequest) {
  if (!DATABASE_CONFIGURED) {
    return NextResponse.json({ ok: false, reason: "no-database" });
  }

  try {
    const { experimentId, variant, visitorId, pagePath } =
      (await request.json()) as {
        experimentId?: number | null;
        variant?: string | null;
        visitorId?: string;
        pagePath?: string;
      };

    if (
      typeof visitorId !== "string" ||
      !/^[a-z0-9]{8,64}$/i.test(visitorId) ||
      typeof pagePath !== "string" ||
      !pagePath.startsWith("/") ||
      pagePath.length > 200
    ) {
      return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
    }

    const inExperiment =
      typeof experimentId === "number" &&
      Number.isInteger(experimentId) &&
      (variant === "a" || variant === "b");

    await initSchema();

    if (inExperiment) {
      await recordEvent(
        experimentId as number,
        variant as VariantKey,
        "impression",
        visitorId
      );
    } else {
      // Between experiments: still count the view, so there's a real baseline
      // rate for the next test to be judged against.
      await recordBaselineEvent(pagePath, "impression", visitorId);
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(VISITOR_COOKIE, visitorId, COOKIE_OPTIONS);
    if (inExperiment) {
      response.cookies.set(
        variantCookieName(experimentId as number),
        variant as string,
        COOKIE_OPTIONS
      );
    }
    return response;
  } catch (error) {
    console.error("CRO track failed:", error);
    // Never let analytics break the page.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
