import "server-only";
import { BUSINESS_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/site";
import { intakeMarkdown } from "./digest";
import {
  INTAKE_SECTIONS,
  displayAnswer,
  type IntakeAnswers,
} from "./questions";

/**
 * The two emails a completed intake sends.
 *
 * Same conventions as the scan report email next door: light background,
 * table-based layout, inline styles, no web fonts and no external images,
 * because that is still what email clients support and the brand's dark canvas
 * renders badly in Outlook.
 *
 * The notification is the one that matters. It goes to one person who has to
 * read a customer's answers and start work from them, so it is laid out to be
 * read top to bottom rather than to look like a form export — and its
 * plain-text half is literal markdown, so the whole thing can be pasted
 * somewhere useful without being retyped.
 */

const INK = "#111111";
const MUTED = "#5b5b5b";
const ACCENT = "#f6be00";
const LINE = "#e4e2dc";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped, then newlines preserved. Answers are typed as lists more often than not. */
function escapeMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

export interface IntakeEmail {
  subject: string;
  html: string;
  text: string;
}

/* ── the notification, to us ──────────────────────────────────────────────── */

export function buildIntakeNotification(args: {
  answers: IntakeAnswers;
  submittedAt: string;
  declarationText: string;
  scanUrl?: string | null;
  adminUrl: string;
}): IntakeEmail {
  const { answers, submittedAt, declarationText, scanUrl, adminUrl } = args;
  const business = answers.business_name?.trim() || "Unnamed business";
  const contact = answers.contact_name?.trim() || "";
  const email = answers.email?.trim() || "";
  const phone = answers.phone?.trim() || "";

  const sections = INTAKE_SECTIONS.map((section) => {
    const answered = section.fields.filter(
      (field) => (answers[field.name] ?? "").trim() !== ""
    );
    if (answered.length === 0) return "";

    const rows = answered
      .map((field) => {
        const value = displayAnswer(field, answers[field.name].trim());
        return `
        <tr>
          <td style="padding:0 0 18px;">
            <p style="margin:0 0 5px;font:700 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">
              ${escapeHtml(field.label)}
            </p>
            <p style="margin:0;font:400 15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
              ${escapeMultiline(value)}
            </p>
          </td>
        </tr>`;
      })
      .join("");

    return `
      <tr>
        <td style="padding:0 0 10px;">
          <p style="margin:26px 0 14px;padding:0 0 8px;border-bottom:2px solid ${INK};font:800 15px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${INK};">
            ${escapeHtml(section.title)}
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            ${rows}
          </table>
        </td>
      </tr>`;
  }).join("");

  const blank = INTAKE_SECTIONS.flatMap((section) => section.fields)
    .filter((field) => (answers[field.name] ?? "").trim() === "")
    .map((field) => field.label);

  const blankBlock =
    blank.length === 0
      ? ""
      : `
      <tr>
        <td style="padding:22px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${LINE};border-radius:8px;background:#faf9f6;">
            <tr>
              <td style="padding:16px 18px;">
                <p style="margin:0 0 8px;font:700 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};">
                  Left blank &mdash; ask on the kickoff call
                </p>
                <p style="margin:0;font:400 14px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                  ${blank.map(escapeHtml).join(" &middot; ")}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Build intake</title></head>
<body style="margin:0;padding:0;background:#f4f2ec;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f2ec;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;background:#ffffff;border-radius:12px;">
          <tr>
            <td style="padding:30px 28px 0;">
              <p style="margin:0 0 6px;font:700 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:${ACCENT};">
                Build intake
              </p>
              <p style="margin:0 0 6px;font:800 26px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                ${escapeHtml(business)}
              </p>
              <p style="margin:0 0 20px;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                ${escapeHtml(contact)}${contact && email ? " &middot; " : ""}${
                  email ? `<a href="mailto:${escapeHtml(email)}" style="color:${INK};">${escapeHtml(email)}</a>` : ""
                }${phone ? ` &middot; <a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}" style="color:${INK};">${escapeHtml(phone)}</a>` : ""}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:0 0 4px;">
                    <p style="margin:0;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                      <a href="${escapeHtml(adminUrl)}" style="color:${INK};font-weight:700;">Open it in the admin</a>${
                        scanUrl
                          ? ` &middot; <a href="${escapeHtml(scanUrl)}" style="color:${INK};font-weight:700;">their scan report</a>`
                          : ""
                      }
                    </p>
                  </td>
                </tr>
                ${sections}
                ${blankBlock}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px 30px;">
              <p style="margin:0;padding:16px 0 0;border-top:1px solid ${LINE};font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                Confirmed on submission: &ldquo;${escapeHtml(declarationText)}&rdquo;
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`;

  return {
    subject: `Build intake: ${business}`,
    html,
    // Markdown, deliberately. This half is the one that gets pasted somewhere.
    text: intakeMarkdown(answers, { submittedAt, scanUrl, declarationText }),
  };
}

/* ── the confirmation, to them ────────────────────────────────────────────── */

/**
 * What the customer gets back.
 *
 * Short. Its job is to confirm the answers arrived and say what happens next.
 * The agreement was signed before the form, so there is nothing to hand over
 * and nothing left for them to do: saying so plainly is the point. Everything
 * they just spent twenty minutes typing is not repeated back at them: they
 * wrote it, and a wall of their own words is not a receipt.
 */
export function buildIntakeConfirmation(args: {
  answers: IntakeAnswers;
}): IntakeEmail {
  const { answers } = args;
  const business = answers.business_name?.trim() || "your business";
  const first = (answers.contact_name?.trim() || "").split(/\s+/)[0] || "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>We have everything</title></head>
<body style="margin:0;padding:0;background:#f4f2ec;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f2ec;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background:#ffffff;border-radius:12px;">
          <tr>
            <td style="padding:34px 30px;">
              <p style="margin:0 0 18px;font:800 24px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                Got it${first ? `, ${escapeHtml(first)}` : ""}.
              </p>
              <p style="margin:0 0 18px;font:400 16px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                Your answers for ${escapeHtml(business)} are in. That is the
                part that usually takes the longest, and it is done. The
                agreement is signed, the form is sent, and there is nothing
                else we need from you today.
              </p>
              <p style="margin:0 0 8px;font:700 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">
                What happens now
              </p>
              <p style="margin:0 0 18px;font:400 16px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                We read your answers properly rather than skimming them, and
                come back with anything that needs a real conversation rather
                than a form box, plus the account access we need. Expect that
                within one business day. Build time is two to three weeks from
                there.
              </p>
              <p style="margin:0 0 18px;font:400 16px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                Remembered something, or got one wrong? Reply to this email and
                say so. Nothing is locked in.
              </p>
              <p style="margin:0;padding:20px 0 0;border-top:1px solid ${LINE};font:400 14px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                Maximilian<br>FootHold Systems<br>
                <a href="mailto:${CONTACT_EMAIL}" style="color:${MUTED};">${CONTACT_EMAIL}</a> &middot; ${CONTACT_PHONE}<br>
                <span style="font-size:12px;">${BUSINESS_ADDRESS}</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>`;

  const text = [
    `Got it${first ? `, ${first}` : ""}.`,
    "",
    `Your answers for ${business} are in. That is the part that usually takes the longest, and it is done. The agreement is signed, the form is sent, and there is nothing else we need from you today.`,
    "",
    "WHAT HAPPENS NOW",
    "We read your answers properly rather than skimming them, and come back with anything that needs a real conversation rather than a form box, plus the account access we need. Expect that within one business day. Build time is two to three weeks from there.",
    "",
    "Remembered something, or got one wrong? Reply to this email and say so. Nothing is locked in.",
    "",
    "Maximilian",
    "FootHold Systems",
    `${CONTACT_EMAIL} | ${CONTACT_PHONE}`,
    BUSINESS_ADDRESS,
  ].join("\n");

  return {
    subject: `We have everything for ${business}.`,
    html,
    text,
  };
}
