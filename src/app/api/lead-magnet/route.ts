import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  CONSENT_TEXT,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_PHONE_TEL,
  GUIDE_PATH,
  calendlyUrl,
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
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || "max@footholdsystems.com";

// Public base URL used to build the download link
// www, matching the canonical host. The apex 308s, and the download link in the
// delivery email is the last place to spend a redirect.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.footholdsystems.com"
).replace(/\/$/, "");

// The lead magnet lives in /public/downloads (path shared with the thank-you page)
const GUIDE_URL = `${SITE_URL}${GUIDE_PATH}`;

// Booking link, tagged so calls that came out of the delivery email are visible.
const BOOKING_URL = calendlyUrl("guide-email", "email");

interface LeadPayload {
  email?: string;
  name?: string;
  source?: string;
  /** Set when a CRO experiment is running on the page that produced the lead. */
  experimentId?: number | null;
  variant?: "a" | "b" | null;
  /** Whether they ticked the marketing opt-in. */
  optIn?: boolean;
  /** Wording shown beside that checkbox, stored with the consent record. */
  consentText?: string;
  /** Campaign parameters from the landing URL. See lib/attribution.ts. */
  attribution?: Attribution | null;
  /** Decoy field — anything in it means the submission was automated. */
  honeypot?: string;
  /** Milliseconds the form was on screen before submission. */
  elapsedMs?: number;
}

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
  "Something went wrong. Please try again, or email max@footholdsystems.com and we'll send it over.";

export async function POST(request: NextRequest) {
  try {
    const body: LeadPayload = await request.json();

    const email = (body.email || "").trim();
    const name = (body.name || "").trim();
    const firstName = name.split(/\s+/)[0] || "";
    const source = body.source || "Foothold Systems - 5 Levels of AI";
    // Narrowed before it goes near the database or an email: every value here
    // came off a query string, so anyone can put anything in it.
    const attribution = sanitiseAttribution(body.attribution);

    // Validation
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // The guide is gated behind the tick, except where consent has to be a free
    // choice. Re-derived here rather than trusting the client: the route is a
    // public endpoint, so a gate that only exists in the browser is not a gate.
    const optedIn = body.optIn === true;
    const gateApplies = consentMayBeRequired(countryFromHeaders(request.headers));

    if (gateApplies && !optedIn) {
      return NextResponse.json(
        { error: "Please tick the box to confirm you'd like the guide and the emails." },
        { status: 400 }
      );
    }

    // Bot screening, before a single email is sent or a row written. Ordered
    // cheapest first: two field checks that need nothing, then the one query.
    const screened = screenSubmission({
      honeypot: body.honeypot,
      elapsedMs: body.elapsedMs,
    });
    if (!screened.ok) {
      console.warn(`Lead submission rejected (${screened.reason})`);
      return NextResponse.json({ error: REJECTION_MESSAGE }, { status: 400 });
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
      console.error("RESEND_API_KEY is not set");
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const resend = new Resend(apiKey);
    const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi,";

    // 1) Delivery email to the person who requested the guide
    const deliveryHtml = `
      <div style="background:#1b1b1b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:32px 16px;">
        <div style="max-width:560px;margin:0 auto;background:#eae8e1;border-radius:14px;overflow:hidden;">
          <div style="background:#1b1b1b;padding:28px 32px;">
            <p style="margin:0;color:#f6be00;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">${BRAND_NAME} &nbsp;&middot;&nbsp; AI for Business</p>
            <h1 style="margin:12px 0 0;color:#f2efe6;font-size:30px;line-height:1.1;font-weight:800;letter-spacing:-0.01em;">The 5 Levels of AI</h1>
          </div>
          <div style="padding:28px 32px;color:#1f1f1d;">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${greeting}</p>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">Here's your copy. Five levels, plain English. Find yours in ten minutes, then read what staying there is costing you.</p>
            <a href="${GUIDE_URL}" style="display:inline-block;background:#f6be00;color:#1b1b1b;font-weight:700;font-size:16px;text-decoration:none;padding:14px 28px;border-radius:8px;">Download the guide &rarr;</a>
            <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#57564f;">If the button doesn't work, paste this into your browser:<br><a href="${GUIDE_URL}" style="color:#1b1b1b;">${GUIDE_URL}</a></p>
            <hr style="border:none;border-top:1px solid #d4d1c6;margin:24px 0;">
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;"><strong>The map is free. Your step takes one call.</strong></p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">The guide tells you your level. It can't tell you which move is yours or what it's worth. That's twenty minutes with us, free whether or not you hire us.</p>
            <a href="${BOOKING_URL}" style="display:inline-block;background:#1b1b1b;color:#f2efe6;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:8px;">Book a call &rarr;</a>
            <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#57564f;">Twenty minutes, weekday afternoons &mdash; the only window I keep for these. The calendar opens seven days at a time, so what you see is what's left.</p>
            <p style="margin:6px 0 0;font-size:13px;line-height:1.6;color:#57564f;">Rather just talk? Call <a href="tel:${CONTACT_PHONE_TEL}" style="color:#1b1b1b;font-weight:600;">${CONTACT_PHONE}</a>.</p>
          </div>
          <div style="padding:16px 32px;background:#e0ddd2;color:#7a786f;font-size:11px;font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:0.08em;">
            ${BRAND_NAME} &middot; ${BRAND_ADDRESS}
          </div>
        </div>
      </div>`;

    const deliveryText = [
      `The 5 Levels of AI, from ${BRAND_NAME}`,
      ``,
      firstName ? `Hi ${firstName},` : `Hi,`,
      ``,
      `Here's your copy. Five levels, plain English. Find yours in ten minutes, then read what staying there is costing you.`,
      ``,
      `Download the guide: ${GUIDE_URL}`,
      ``,
      `The map is free. Your step takes one call.`,
      `The guide tells you your level. It can't tell you which move is yours or what it's worth. That's twenty minutes with us, free whether or not you hire us.`,
      ``,
      `Book a call: ${BOOKING_URL}`,
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
      subject: "Your copy of The 5 Levels of AI",
      html: deliveryHtml,
      text: deliveryText,
    });

    if (deliveryError) {
      console.error("Resend delivery error:", deliveryError);
      return NextResponse.json({ error: "Failed to send the guide" }, { status: 500 });
    }

    // 2) Record what they agreed to, then enrol them only if they agreed.
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
        text: body.consentText ?? CONSENT_TEXT,
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

    // 3) Attribute the conversion to its experiment arm. Recorded server-side,
    // so unlike the Meta pixel this sees every submission — no ad blocker or
    // tracking prevention in the way. Best-effort: the guide has already been
    // delivered and a bookkeeping failure must not fail the request.
    try {
      const experimentId = body.experimentId;
      const variant = body.variant;
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

    // 4) Lead notification (best-effort; don't fail the request if this errors)
    try {
      const submittedAt = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
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
              ${name ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">Name</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(name)}</td></tr>` : ""}
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">Source</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(source)}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:600;">Campaign</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(describeAttribution(attribution))}</td></tr>
            </table>
            <p style="margin-top:20px;color:#6b7280;font-size:13px;">${submittedAt} (Pacific). The guide was emailed to them automatically. Good moment for a follow-up about their level.</p>
          </div>`,
        text: `New "5 Levels of AI" download\n\nEmail: ${email}\n${name ? `Name: ${name}\n` : ""}Source: ${source}\nCampaign: ${describeAttribution(attribution)}\n\n${submittedAt} (Pacific). The guide was emailed to them automatically.`,
      });
    } catch (notifyErr) {
      console.error("Lead notification failed (guide still delivered):", notifyErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Lead magnet API error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/**
 * Keep attribution to a known shape.
 *
 * Everything in it arrives from a query string the visitor controls, and it
 * lands in a database row and in an email we send ourselves. Keys are capped in
 * number, values in length, and anything that is not a string is dropped.
 */
function sanitiseAttribution(input: Attribution | null | undefined): Attribution | null {
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
