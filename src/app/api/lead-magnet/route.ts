import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// Force this route to run at request time, not build time
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// BRAND / CONTACT — placeholders. Swap these for the real Foothold Systems
// details (phone is currently reused from SnapTech; address is a placeholder).
const BRAND_NAME = "Foothold Systems";
const CONTACT_EMAIL = "hello@footholdsystems.com";
const CONTACT_PHONE = "(626) 838-2862"; // TODO: confirm Foothold phone
const CONTACT_PHONE_TEL = "6268382862"; // TODO: confirm Foothold phone
const BRAND_ADDRESS = "403 E Arrow Hwy Suite 306, San Dimas, CA 91773"; // TODO: confirm Foothold mailing address (required on marketing email footers)
// ─────────────────────────────────────────────────────────────────────────────

// Where lead notifications go (defaults to a monitored inbox; override via env)
const TO_EMAIL = process.env.CONTACT_TO_EMAIL || "max@snaptechrepair.com";

// Which address the delivery email comes from. Must be on a Resend-verified domain.
// footholdsystems.com must be verified in Resend before this will send.
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || "noreply@footholdsystems.com";

// Public base URL used to build the download link
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://footholdsystems.com").replace(/\/$/, "");

// The lead magnet lives in /public/downloads
const GUIDE_PATH = "/downloads/foothold-5-levels-of-ai.pdf";
const GUIDE_URL = `${SITE_URL}${GUIDE_PATH}`;

interface LeadPayload {
  email?: string;
  name?: string;
  source?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LeadPayload = await request.json();

    const email = (body.email || "").trim();
    const name = (body.name || "").trim();
    const firstName = name.split(/\s+/)[0] || "";
    const source = body.source || "Foothold Systems - 5 Levels of AI";

    // Validation
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
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
            <p style="margin:0;color:#f6be00;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">${BRAND_NAME} &nbsp;&middot;&nbsp; AI for Small Business</p>
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
            <p style="margin:0;font-size:15px;line-height:1.7;">
              <a href="tel:${CONTACT_PHONE_TEL}" style="color:#1b1b1b;font-weight:600;">${CONTACT_PHONE}</a><br>
              <a href="mailto:${CONTACT_EMAIL}" style="color:#1b1b1b;">${CONTACT_EMAIL}</a>
            </p>
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
      CONTACT_PHONE,
      CONTACT_EMAIL,
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

    // 2) Lead notification (best-effort; don't fail the request if this errors)
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
            </table>
            <p style="margin-top:20px;color:#6b7280;font-size:13px;">${submittedAt} (Pacific). The guide was emailed to them automatically. Good moment for a follow-up about their level.</p>
          </div>`,
        text: `New "5 Levels of AI" download\n\nEmail: ${email}\n${name ? `Name: ${name}\n` : ""}Source: ${source}\n\n${submittedAt} (Pacific). The guide was emailed to them automatically.`,
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

// Escape HTML to prevent injection in email bodies
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
