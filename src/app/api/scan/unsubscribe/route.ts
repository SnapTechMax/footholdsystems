import { NextRequest, NextResponse } from "next/server";
import { unsubscribe } from "@/lib/scan/db";

/**
 * One-click unsubscribe, linked from the footer of every scan email.
 *
 * A GET with no confirmation step, deliberately. Mail clients prefetch links
 * and that will occasionally unsubscribe somebody who never clicked — which is
 * a far smaller problem than making someone fill in a form to stop email they
 * did not want. CAN-SPAM wants this to work in one click and so does everyone
 * receiving it.
 *
 * Returns HTML rather than JSON: this is opened in a browser by a person.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title></head>
<body style="margin:0;background:#0e0e11;color:#f5f3ee;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <div style="max-width:34rem;margin:0 auto;padding:16vh 24px;">
    <p style="margin:0 0 10px;font:700 12px/1 -apple-system,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#f6be00;">FootHold AEO</p>
    <h1 style="margin:0 0 16px;font-size:32px;line-height:1.15;">${title}</h1>
    <p style="margin:0;color:#a5a29a;">${body}</p>
  </div>
</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return page("No address given", "That link was missing an email address.");
  }

  try {
    await unsubscribe(email);
  } catch (error) {
    console.error("[unsubscribe] failed:", error);
    return page(
      "That didn't work",
      "Email max@footholdsystems.com and we'll take you off by hand, which always works."
    );
  }

  // Same answer whether or not the address was on the list. Confirming which
  // addresses we hold to anyone who can type one into a URL is a disclosure we
  // have no reason to make.
  return page(
    "You're unsubscribed",
    "You won't get any more email from us. Your scan report stays live at the link we already sent you."
  );
}
