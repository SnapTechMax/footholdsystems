import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { sendPush } from "@/lib/notify";
import { updateContact } from "@/lib/resend-contact";
import { unsubscribe } from "@/lib/scan/db";
import { CONTACT_EMAIL } from "@/lib/site";

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
 *
 * TWO PLACES HAVE TO HEAR ABOUT IT, and for a while only one did. The row in
 * `scan_leads` is our record and it stops the sweeper re-sending a report, but
 * the 22 email sequence is sent by Resend's own automation against the Resend
 * contact, which cannot see our database. Unsubscribing here used to write the
 * row and nothing else, so somebody who clicked this in their report — the
 * first email they get, and the only one whose footer links here rather than to
 * {{{RESEND_UNSUBSCRIBE_URL}}} — was told they were unsubscribed and then got
 * all 22 anyway. That is the complaint rate Gmail judges the domain on, and it
 * is the one number a sending domain does not recover from quickly.
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
      `Email ${CONTACT_EMAIL} and we'll take you off by hand, which always works.`
    );
  }

  // The half that actually stops the sequence. Awaited rather than left to
  // after(): the wording below depends on the answer, and a background task
  // that gets killed is exactly how this went unnoticed the first time.
  const apiKey = process.env.RESEND_API_KEY;
  const outcome = apiKey
    ? await updateContact(new Resend(apiKey), email, { unsubscribed: true })
    : "failed";

  if (outcome === "failed") {
    // Loud, and on the phone. We have just told somebody they are off the list
    // while Resend still has them on it, which nothing downstream will notice
    // and they will answer with the spam button. Priority 1 for the same reason
    // an unmatched payment is: the fix is quick now and expensive later.
    console.error(
      `[unsubscribe] ${email} is out in our database but NOT in Resend` +
        (apiKey ? "." : " — RESEND_API_KEY is unset.")
    );
    await sendPush({
      title: "Unsubscribe did not reach Resend",
      message:
        `${email} clicked unsubscribe. The database row is set, but the Resend ` +
        "contact is not, so the sequence is still running. Mark them " +
        "unsubscribed in Resend by hand.",
      priority: 1,
    });
  } else if (outcome === "not-found") {
    // Normal. Guide-era leads and anyone whose enrolment failed have a row here
    // and no contact there, and there is nothing running to stop.
    console.info(`[unsubscribe] no Resend contact for ${email} — nothing to stop.`);
  }

  // Same answer whether or not the address was on the list. Confirming which
  // addresses we hold to anyone who can type one into a URL is a disclosure we
  // have no reason to make.
  //
  // The failed case gets its own wording rather than the same reassurance,
  // because in that state the reassurance is not true yet — a person is about
  // to fix it by hand, and the honest sentence is the one that survives an
  // email arriving ten minutes later.
  return page(
    "You're unsubscribed",
    outcome === "failed"
      ? `We've got it. If anything else does arrive, reply to it or email ${CONTACT_EMAIL} and it stops by hand. Your scan report stays live at the link we already sent you.`
      : "You won't get any more email from us. Your scan report stays live at the link we already sent you."
  );
}
