import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  CONSENT_TEXT,
  CONTACT_CONSENT_TEXT,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_PHONE_TEL,
  GUIDE_PATH,
  THANKS_PATH,
} from "@/lib/site";
import {
  DATABASE_CONFIGURED,
  initSchema,
  recordBaselineEvent,
  recordEvent,
} from "@/lib/cro/db";
import { VISITOR_COOKIE } from "@/lib/cro/assign";
import { subscribeToSequence } from "@/lib/subscribe";
import { recordConsent, recentSubmissionsFromIp } from "@/lib/consent";
import {
  MAX_SUBMISSIONS_PER_IP_PER_HOUR,
  screenSubmission,
} from "@/lib/spam";
import { consentMayBeRequired, countryFromHeaders } from "@/lib/geo";
import { describeAttribution, type Attribution } from "@/lib/attribution";
import { LeadSchema, firstFieldError } from "@/lib/lead-schema";
import { appendLead } from "@/lib/sheets";
import { notifyNewLead } from "@/lib/pushover";

// googleapis signs its JWT with Node's crypto and does not run on Edge. Stated
// explicitly rather than left to the default, because the default is the thing
// that would change out from under this.
export const runtime = "nodejs";

// Force this route to run at request time, not build time
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// BRAND / CONTACT
const BRAND_NAME = "Foothold Systems";
// Confirmed as Foothold's mailing address. CAN-SPAM requires a valid physical
// address on every marketing email, so this is not decoration — if the business
// ever moves, this line moves with it before the next send.
const BRAND_ADDRESS = "403 E Arrow Hwy Suite 306, San Dimas, CA 91773";
// Phone and email come from src/lib/site.ts. The phone number goes to people who
// opted in — this email and the guide PDF — but not to the public website.
// ─────────────────────────────────────────────────────────────────────────────

// Where lead notifications land. A destination rather than a sender, so the
// domain has no bearing on deliverability; override via env to move it.
const TO_EMAIL = process.env.CONTACT_TO_EMAIL || "max@snaptechrepair.com";

// Which address the delivery email comes from. Must be on a Resend-verified domain.
// footholdsystems.com is verified in Resend, so mail now goes out under the brand
// it belongs to rather than borrowing SnapTech's domain.
//
// The domain publishes DMARC p=reject, which leaves no margin for a sender that
// isn't set up properly: anything failing alignment is rejected outright rather
// than landing in spam. Resend passes it through DKIM alignment on
// resend._domainkey.footholdsystems.com. If this address is ever changed to a
// domain without that in place, delivery stops dead.
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || "maximilian@footholdsystems.com";

// Public base URL used to build the download link
// www, matching the canonical host. The apex 308s, and the download link in the
// delivery email is the last place to spend a redirect.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.footholdsystems.com"
).replace(/\/$/, "");

// The lead magnet lives in /public/downloads (path shared with the thank-you page)
const GUIDE_URL = `${SITE_URL}${GUIDE_PATH}`;

// Booking link, tagged so calls that came out of the delivery email are visible.

/**
 * What a rejected submission is told.
 *
 * Deliberately the same wording a genuine failure gets, and deliberately not an
 * explanation. A bot learns nothing; a real person wrongly caught still has the
 * email address in the form's error message and a working way to reach us. The
 * actual reason goes to the log, where it can be seen if this ever starts
 * turning away people it shouldn't.
 */
const REJECTION_MESSAGE =
  "Something went wrong. Please try again, or email maximilian@footholdsystems.com and we'll send it over.";

export async function POST(request: NextRequest) {
  try {
    const raw: unknown = await request.json();

    // ── 1. Bot screening, before anything is validated, written or sent ──────
    //
    // First because it is the cheapest check and because a filled honeypot means
    // nothing else in the payload is worth reading. See lib/spam.ts.
    const signals = (raw ?? {}) as { honeypot?: unknown; elapsedMs?: unknown };
    const screened = screenSubmission({
      honeypot: signals.honeypot,
      elapsedMs: signals.elapsedMs,
    });
    if (!screened.ok) {
      console.warn(`Lead submission rejected (${screened.reason})`);
      // A success shape with nothing behind it. A bot that gets a 400 learns
      // which of its fields gave it away and tries again without them; one that
      // gets a 200 has no signal to work with and no reason to come back. No
      // row, no email, no push — this is the whole of what happens.
      return NextResponse.json({ success: true, redirect: THANKS_PATH });
    }

    // ── 2. Validation ────────────────────────────────────────────────────────
    const parsed = LeadSchema.safeParse(raw);
    if (!parsed.success) {
      const { field, message } = firstFieldError(parsed.error);
      // `field` lets the form put the message under the input it belongs to
      // rather than showing a generic failure at the bottom.
      return NextResponse.json({ error: message, field }, { status: 400 });
    }

    const lead = parsed.data;
    const email = lead.email;
    const name = lead.name;
    const firstName = name.split(/\s+/)[0] || "";
    const phone = lead.phone; // E.164, normalised by the schema
    const source = lead.source || "Foothold Systems - 5 Levels of AI";
    // Narrowed before it goes near the database, a spreadsheet or an email:
    // every value here came off a query string, so anyone can put anything in it.
    const attribution = sanitiseAttribution(lead.attribution);
    const campaign = describeAttribution(attribution);

    // ── 3. Marketing consent gate ────────────────────────────────────────────
    //
    // The guide is gated behind the marketing tick, except where consent has to
    // be a free choice. Re-derived here rather than trusting the client: the
    // route is a public endpoint, so a gate that only exists in the browser is
    // not a gate. Note this is the *email* opt-in; the phone-contact consent is
    // required unconditionally and enforced by the schema.
    const optedIn = lead.optIn === true;
    const gateApplies = consentMayBeRequired(countryFromHeaders(request.headers));

    if (gateApplies && !optedIn) {
      return NextResponse.json(
        {
          error: "Please tick the box to confirm you'd like the guide and the emails.",
          field: "optIn",
        },
        { status: 400 }
      );
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;

    // Fails open by design — recentSubmissionsFromIp returns 0 when the database
    // is unreachable, because a rate limiter that takes the form down with it is
    // a worse outage than the thing it prevents.
    const recentFromIp = await recentSubmissionsFromIp(clientIp, 60);
    if (recentFromIp >= MAX_SUBMISSIONS_PER_IP_PER_HOUR) {
      console.warn(
        `Lead submission rejected (${recentFromIp} submissions from this IP in the last hour)`
      );
      return NextResponse.json({ error: REJECTION_MESSAGE }, { status: 429 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Checked before any write rather than after. With no Resend key nothing
      // downstream works — not the guide, not the alert that would report the
      // guide failing — so failing here keeps the lead out of a sheet that
      // claims it was handled when it wasn't.
      console.error("RESEND_API_KEY is not set");
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const resend = new Resend(apiKey);

    // ── 4. The spreadsheet, awaited ──────────────────────────────────────────
    //
    // First of the three side effects and the only one that blocks, because it
    // is the system of record. Everything after this is a notification about a
    // row that already exists.
    const submittedAt = pacificTimestamp();
    let sheetAppended = false;
    try {
      await appendLead({
        timestamp: submittedAt,
        name,
        email,
        phone,
        consent: lead.contactConsent,
        utmSource: attribution?.utm_source ?? "",
        utmMedium: attribution?.utm_medium ?? "",
        utmCampaign: attribution?.utm_campaign ?? "",
        utmContent: attribution?.utm_content ?? "",
        fbclid: attribution?.fbclid ?? "",
        landingPage: attribution?.landing_path ?? "",
        referrer: attribution?.referrer ?? "",
      });
      sheetAppended = true;
    } catch (sheetError) {
      // A lead is never dropped silently. The row failed, so the payload goes to
      // a human by email instead and the request carries on — the person who
      // filled the form in still gets their guide, and the lead still reaches
      // someone who can act on it, just by a worse route.
      console.error("Google Sheets append failed — lead sent to ALERT_EMAIL instead:", sheetError);
      await alertOnSheetFailure(resend, sheetError, {
        submittedAt,
        name,
        email,
        phone,
        contactConsent: lead.contactConsent,
        optIn: optedIn,
        source,
        campaign,
        attribution,
        clientIp,
        userAgent: request.headers.get("user-agent"),
      });
    }

    // ── 5. Push notification, started but not waited on ──────────────────────
    //
    // Kicked off here and settled at the very end of the request. Not awaited
    // now, because nothing below depends on it and a slow push must not delay
    // the guide; settled before returning, because a serverless function that
    // returns with work in flight may simply be frozen, and a notification that
    // sometimes arrives is worse than one that always does. The 2s abort inside
    // notifyNewLead is the ceiling on what that can cost.
    const pushSent = notifyNewLead({ name, phone, email, campaign });

    // ── 6. The guide itself ──────────────────────────────────────────────────
    const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";

    const deliveryHtml = `
      <div style="background:#1b1b1b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:32px 16px;">
        <div style="max-width:560px;margin:0 auto;background:#eae8e1;border-radius:14px;overflow:hidden;">
          <div style="background:#1b1b1b;padding:28px 32px;">
            <p style="margin:0;color:#f6be00;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">${BRAND_NAME} &nbsp;&middot;&nbsp; AI for Business</p>
            <h1 style="margin:12px 0 0;color:#f2efe6;font-size:30px;line-height:1.1;font-weight:800;letter-spacing:-0.01em;">The 5 Levels of AI</h1>
            <p style="margin:6px 0 0;color:#f6be00;font-size:14px;font-weight:700;letter-spacing:0.02em;">And the prompts that get you there.</p>
          </div>
          <div style="padding:28px 32px;color:#1f1f1d;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${greeting}</p>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">Here's your copy. Five levels in plain English, about ten minutes to read. Two of the prompts are printed in full, so you can paste one into a chat box before you finish the guide.</p>
            <a href="${GUIDE_URL}" style="display:inline-block;background:#f6be00;color:#1b1b1b;font-weight:700;font-size:16px;text-decoration:none;padding:14px 28px;border-radius:8px;">Download the guide &rarr;</a>
            <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#57564f;">If the button doesn't work, paste this into your browser:<br><a href="${GUIDE_URL}" style="color:#1b1b1b;">${GUIDE_URL}</a></p>
            <hr style="border:none;border-top:1px solid #d4d1c6;margin:24px 0;">
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><strong>You have 1 and 2. The call is where 3, 4 and 5 come from.</strong></p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Levels 3 to 5 print as frameworks rather than something you paste, because the prompt is the easy half. Picking the first one worth building and wiring it into what you already run is the other half, and that's what the twenty minutes is for. No charge either way.</p>
            <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#57564f;">Twenty minutes, weekday afternoons &mdash; the only window I keep for these. The calendar opens seven days at a time, so what you see is what's left.</p>
            <p style="margin:6px 0 0;font-size:13px;line-height:1.6;color:#57564f;">Rather just talk? Call <a href="tel:${CONTACT_PHONE_TEL}" style="color:#1b1b1b;font-weight:600;">${CONTACT_PHONE}</a>.</p>
          </div>
          <div style="padding:16px 32px;background:#e0ddd2;color:#7a786f;font-size:11px;font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:0.08em;">
            ${BRAND_NAME} &middot; ${BRAND_ADDRESS}
          </div>
        </div>
      </div>`;

    const deliveryText = [
      `The 5 Levels of AI and the prompts that get you there, from ${BRAND_NAME}`,
      ``,
      firstName ? `Hi ${firstName},` : `Hi,`,
      ``,
      `Here's your copy. Five levels in plain English, about ten minutes to read. Two of the prompts are printed in full, so you can paste one into a chat box before you finish the guide.`,
      ``,
      `Download the guide: ${GUIDE_URL}`,
      ``,
      `You have 1 and 2. The call is where 3, 4 and 5 come from.`,
      `Levels 3 to 5 print as frameworks rather than something you paste, because the prompt is the easy half. Picking the first one worth building and wiring it into what you already run is the other half, and that's what the twenty minutes is for. No charge either way.`,
      ``,
      ``,
      `Twenty minutes, weekday afternoons - the only window I keep for these. The calendar opens seven days at a time, so what you see is what's left.`,
      `Rather just talk? Call ${CONTACT_PHONE}.`,
      ``,
      `${BRAND_NAME} · ${BRAND_ADDRESS}`,
    ].join("\n");

    const { error: deliveryError } = await resend.emails.send({
      from: `${BRAND_NAME} <${FROM_EMAIL}>`,
      to: [email],
      replyTo: CONTACT_EMAIL,
      subject: "Your copy of The 5 Levels of AI, prompts included",
      html: deliveryHtml,
      text: deliveryText,
    });

    if (deliveryError) {
      console.error("Resend delivery error:", deliveryError);
      await pushSent;
      // The row is already in the sheet and the phone has already buzzed, so the
      // lead is not lost — only the guide is. Reported as a failure because the
      // person is still waiting for a PDF that isn't coming, and the form's
      // error message tells them how to ask for it directly.
      return NextResponse.json({ error: "Failed to send the guide" }, { status: 500 });
    }

    // ── 7. Consent record, then enrolment ────────────────────────────────────
    //
    // Under the gate everyone here ticked; where consent is a free choice they
    // may not have, and that decision is recorded either way. The record stores
    // the wording rather than a bare boolean, because the two wordings differ by
    // region and which one someone saw is the whole of the evidence.
    //
    // Best-effort: the guide is already delivered by this point, and neither
    // step may turn a successful download into an error for the person who
    // asked for it.
    try {
      await recordConsent({
        email,
        granted: optedIn,
        // Both agreements, stored together. The phone consent has no separate
        // table and this is already the row that knows who they are; appending
        // its wording here means "what exactly did they agree to" still has one
        // answer rather than two half-answers.
        text: `${lead.consentText ?? CONSENT_TEXT} | ${CONTACT_CONSENT_TEXT} (${
          lead.contactConsent ? "agreed" : "not agreed"
        }, ${phone})`,
        source,
        // Both are evidence of when and from where consent was given, which is
        // the question asked if a provider ever reviews the list.
        ipAddress: clientIp,
        userAgent: request.headers.get("user-agent"),
        attribution,
      });
    } catch (consentErr) {
      console.error("Consent record failed (guide still delivered):", consentErr);
    }

    if (optedIn) {
      try {
        const result = await subscribeToSequence(resend, {
          email,
          firstName,
          source,
        });
        if (result.notes.length > 0) {
          console.error("Subscribe issues (guide still delivered):", result.notes);
        }
      } catch (subErr) {
        console.error("Subscribe failed (guide still delivered):", subErr);
      }
    }

    // ── 8. Experiment attribution ────────────────────────────────────────────
    //
    // Attribute the conversion to its experiment arm. Recorded server-side, so
    // unlike the Meta pixel this sees every submission — no ad blocker or
    // tracking prevention in the way. Best-effort: the guide has already been
    // delivered and a bookkeeping failure must not fail the request.
    try {
      const experimentId = lead.experimentId;
      const variant = lead.variant;
      const cookieVisitorId = request.cookies.get(VISITOR_COOKIE)?.value;

      // A download with no visitor cookie used to be dropped here without a
      // word. Consent is recorded a few lines above unconditionally, so the two
      // drifted apart and the gap looked like a conversion problem rather than a
      // bookkeeping one — 19 opt-ins against 10 downloads, with nothing in the
      // logs to say why.
      //
      // The cookie is set by /api/cro/track in response to the page view, so it
      // is missing whenever that call never landed: cookies blocked, the form
      // submitted before the tracker fired, a direct POST. None of those make the
      // download less real, so it is counted under a synthetic id instead.
      //
      // Prefixed rather than anonymous, for two reasons. The unique index is on
      // the visitor id, so a distinct value per download is what stops these
      // collapsing into a single row; and the prefix makes them countable later
      // — `WHERE visitor_id LIKE 'nocookie-%'` answers "how often does this
      // happen" without needing the logs.
      const visitorId =
        cookieVisitorId ??
        `nocookie-${crypto.randomUUID().replace(/-/g, "")}`;

      if (DATABASE_CONFIGURED) {
        const inExperiment =
          typeof experimentId === "number" &&
          Number.isInteger(experimentId) &&
          (variant === "a" || variant === "b");

        if (!cookieVisitorId) {
          // Logged, not swallowed. If this line becomes common it means the
          // tracker is not running, which is worth knowing on its own.
          console.warn(
            `Conversion recorded without a ${VISITOR_COOKIE} cookie ` +
              `(source: ${source}, experiment: ${inExperiment ? experimentId : "none"}). ` +
              "The download is counted; the visitor cannot be tied to their impression."
          );
        }

        await initSchema();
        if (inExperiment) {
          await recordEvent(experimentId, variant, "conversion", visitorId);
        } else {
          // No test running — still count it, so the baseline rate reflects
          // every download rather than only those during an experiment.
          await recordBaselineEvent("/guide", "conversion", visitorId);
        }
      }
    } catch (croErr) {
      console.error("CRO conversion logging failed (lead still delivered):", croErr);
    }

    // ── 9. Lead notification email (best-effort) ─────────────────────────────
    //
    // Kept alongside the push rather than replaced by it. The push is for acting
    // in the next five minutes; this is the copy that is still findable in a
    // mailbox next week, and it is the only one of the two that survives a phone
    // being off.
    try {
      await resend.emails.send({
        from: `${BRAND_NAME} Website <${FROM_EMAIL}>`,
        to: [TO_EMAIL],
        replyTo: email,
        subject: `New lead magnet download: ${email}`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827;">
            <h2 style="color:#0177e3;margin:0 0 20px;">New "5 Levels of AI" download</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;width:120px;">Email</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">Phone</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>
              ${name ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">Name</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(name)}</td></tr>` : ""}
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">Source</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(source)}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">Campaign</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(campaign)}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">Spreadsheet</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">${sheetAppended ? "row appended" : "<strong>APPEND FAILED — see the alert email</strong>"}</td></tr>
            </table>
            <p style="margin-top:20px;color:#6b7280;font-size:13px;">${escapeHtml(submittedAt)}. The guide was emailed to them automatically. Good moment for a follow-up about their level.</p>
          </div>`,
        text: `New "5 Levels of AI" download\n\nEmail: ${email}\nPhone: ${phone}\n${name ? `Name: ${name}\n` : ""}Source: ${source}\nCampaign: ${campaign}\nSpreadsheet: ${sheetAppended ? "row appended" : "APPEND FAILED — see the alert email"}\n\n${submittedAt}. The guide was emailed to them automatically.`,
      });
    } catch (notifyErr) {
      console.error("Lead notification failed (guide still delivered):", notifyErr);
    }

    // Settle the push before returning. See the note where it was started.
    await pushSent;

    // ── 10. What the client does next ────────────────────────────────────────
    //
    // The redirect target is sent rather than hardcoded in the form, so the
    // thank-you path lives in one place. `pixel` is the custom data the Meta
    // Lead event needs; it fires on the thank-you page rather than here, because
    // a server-side pixel call would be a different integration (Conversions
    // API) and this one has to run in the browser to carry the visitor's cookies.
    return NextResponse.json({
      success: true,
      redirect: THANKS_PATH,
      pixel: {
        content_name: "5 Levels of AI",
        ...(lead.variant
          ? { variant: lead.variant, experiment_id: lead.experimentId ?? null }
          : {}),
      },
    });
  } catch (err) {
    console.error("Lead API error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/**
 * Timestamp for the spreadsheet, in Pacific.
 *
 * `sv-SE` for the formatting rather than the language: it is the locale that
 * produces ISO-shaped `YYYY-MM-DD HH:mm:ss`, which sorts correctly as text in a
 * column Sheets is treating as plain strings under RAW. The offset is spelled out
 * because the same sheet is read in winter and summer.
 */
function pacificTimestamp(): string {
  const formatted = new Date().toLocaleString("sv-SE", {
    timeZone: "America/Los_Angeles",
  });
  return `${formatted} PT`;
}

/**
 * Last resort when the spreadsheet append fails.
 *
 * The whole payload, in a form a person can retype into the sheet by hand. This
 * exists because the alternative — a lead that reached the server and then went
 * nowhere — is the one failure mode of this route that costs real money and
 * leaves no trace of having happened.
 */
async function alertOnSheetFailure(
  resend: Resend,
  error: unknown,
  payload: Record<string, unknown>
): Promise<void> {
  const alertTo = process.env.ALERT_EMAIL;
  if (!alertTo) {
    // Nowhere to send it. Logged at full volume so the payload is at least in
    // the function logs, which is the only place left for it.
    console.error(
      "ALERT_EMAIL is unset — a lead failed to reach the spreadsheet and could not be emailed. Raw payload:",
      JSON.stringify(payload)
    );
    return;
  }

  const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const dump = JSON.stringify(payload, null, 2);

  try {
    await resend.emails.send({
      from: `${BRAND_NAME} Alerts <${FROM_EMAIL}>`,
      to: [alertTo],
      subject: `ACTION NEEDED: lead not written to the sheet (${String(payload.email ?? "unknown")})`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827;">
          <h2 style="color:#b91c1c;margin:0 0 12px;">A lead did not reach the spreadsheet</h2>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">They got the guide. The row did not get written, so this one has to go into the sheet by hand.</p>
          <p style="margin:0 0 8px;font-weight:600;">Why it failed</p>
          <pre style="background:#f3f4f6;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;">${escapeHtml(reason)}</pre>
          <p style="margin:16px 0 8px;font-weight:600;">The lead, in full</p>
          <pre style="background:#f3f4f6;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;">${escapeHtml(dump)}</pre>
        </div>`,
      text: `A lead did not reach the spreadsheet.\n\nThey got the guide. The row did not get written, so this one has to go into the sheet by hand.\n\nWhy it failed:\n${reason}\n\nThe lead, in full:\n${dump}`,
    });
  } catch (alertErr) {
    // Both the sheet and the alert are down. The log is all that is left.
    console.error(
      "ALERT_EMAIL send also failed. Raw payload:",
      JSON.stringify(payload),
      alertErr
    );
  }
}

/**
 * Keep attribution to a known shape.
 *
 * Everything in it arrives from a query string the visitor controls, and it
 * lands in a database row, a spreadsheet cell and an email we send ourselves.
 * Keys are capped in number, values in length, and anything that is not a string
 * is dropped.
 */
function sanitiseAttribution(
  input: Record<string, unknown> | null | undefined
): Attribution | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out: Attribution = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (!/^[a-z0-9_]{1,40}$/i.test(key)) continue;
    out[key] = trimmed.slice(0, 200);
    // A landing URL cannot meaningfully carry more than this, and a cap means a
    // crafted query string cannot grow the row without bound.
    if (Object.keys(out).length >= 12) break;
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Escape HTML to prevent injection in email bodies
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
