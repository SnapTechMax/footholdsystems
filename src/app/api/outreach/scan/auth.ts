import { NextRequest, NextResponse } from "next/server";

/**
 * Shared secret for the outreach scan API.
 *
 * Its own variable rather than CRON_SECRET: this is handed to a second
 * application, and a key that is given away should be revocable without
 * changing what the sweeper authenticates with.
 *
 * Falls back to CRON_SECRET so the endpoint works on a deployment that has not
 * set the new variable yet — but never to *open*, for the reason the sweep
 * route spells out: this spends money at a third-party scanner on any domain it
 * is handed, so an unset secret closes the door rather than removing it.
 */
export function outreachAuthorised(request: NextRequest): boolean {
  const secret = process.env.OUTREACH_API_KEY || process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;

  return request.nextUrl.searchParams.get("secret") === secret;
}

export function unauthorised(): NextResponse {
  return NextResponse.json(
    { error: "Not authorised." },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}
