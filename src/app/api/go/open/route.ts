import { NextRequest, NextResponse } from "next/server";
import { cleanRecipient, knownKey, recordOpen } from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * Open tracking pixel for the nurture sequence.
 *
 * Every email in the sequence ends with a 1×1 image pointing here. The client
 * loads it, this records the open, and a transparent GIF goes back.
 *
 * **Read the number for what it is.** This is a count of image loads, not of
 * people reading anything:
 *
 *  - Apple Mail Privacy Protection pre-fetches every image through Apple's
 *    proxy the moment mail arrives, so anyone using it registers an open whether
 *    or not they ever look. That is a large share of consumer mail, and it only
 *    inflates.
 *  - Anyone with images switched off registers nothing, however carefully they
 *    read. That only deflates.
 *
 * The two do not cancel out, and neither is measurable from here. Compare one
 * email against another — email 14 against email 3 — and the bias is roughly
 * common to both. Do not read the absolute figure as an audience.
 *
 * Same three rules as /api/go/book, for the same reasons:
 *
 *  1. **It always returns the image.** A database that is down or unconfigured
 *     must never show a broken image in someone's inbox. Recording is attempted
 *     and any failure is swallowed after logging.
 *  2. **Unknown keys are dropped, not stored.** `e` is checked against the
 *     sequence, so a crawler hitting this cannot invent emails in the dashboard.
 *  3. **Nothing from the query string reaches a response.** The body is a fixed
 *     constant, so there is nothing here to reflect back.
 */

/** 1×1 fully transparent GIF, 43 bytes. */
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

function pixelResponse(): NextResponse {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      // Every load has to reach the server or the count stops after the first.
      // Mail clients and their proxies cache aggressively, so this is emphatic
      // rather than polite.
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const rawCampaign = (params.get("e") ?? "")
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9._-]/g, "");
  const emailKey = knownKey(rawCampaign);
  const recipient = cleanRecipient(params.get("r"));

  if (emailKey) {
    try {
      await recordOpen({ emailKey, recipient });
    } catch (error) {
      console.error("Email open not recorded:", error);
    }
  }

  return pixelResponse();
}

/**
 * Some clients issue a HEAD before fetching an image. Answered with the same
 * headers and no body, and deliberately without recording — counting a HEAD and
 * the GET that follows it would double every open from those clients.
 */
export function HEAD(): NextResponse {
  const response = pixelResponse();
  return new NextResponse(null, {
    status: 200,
    headers: response.headers,
  });
}
