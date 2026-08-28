import "server-only";
import { BUSINESS_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/site";
import { contractUrl } from "./contract";
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

  const contract = contractUrl();

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

  /**
   * The missing-contract warning.
   *
   * The customer was just told the agreement follows by email, because there
   * was no link to give them. That is a promise somebody now has to keep by
   * hand, and it would be very easy not to notice.
   */
  const contractWarning = contract
    ? ""
    : `
      <tr>
        <td style="padding:0 0 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:2px solid #c8321e;border-radius:8px;background:#fdf2f0;">
            <tr>
              <td style="padding:16px 18px;">
                <p style="margin:0;font:700 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#8c2214;">
                  BUILD_CONTRACT_URL is not set, so they were given no link to sign.
                </p>
                <p style="margin:8px 0 0;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#8c2214;">
                  They have been told the agreement follows by email within one business day. Send it, then set the variable in Vercel so the next one is automatic.
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
                ${contractWarning}
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
 * Short. Its job is to confirm the answers arrived, hand over the agreement,
 * and say what happens next, in that order. Everything they just spent twenty
 * minutes typing is not repeated back at them: they wrote it, and a wall of
 * their own words is not a receipt.
 */
export function buildIntakeConfirmation(args: {
  answers: IntakeAnswers;
  contractUrl: string | null;
}): IntakeEmail {
  const { answers } = args;
  const business = answers.business_name?.trim() || "your business";
  const first = (answers.contact_name?.trim() || "").split(/\s+/)[0] || "";
  const contract = args.contractUrl;

  const signBlock = contract
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
        <tr>
          <td style="background:${ACCENT};border-radius:8px;">
            <a href="${escapeHtml(contract)}" style="display:inline-block;padding:16px 30px;font:800 16px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};text-decoration:none;">
              Read and sign the agreement &rarr;
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 26px;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
        Or paste this into your browser: ${escapeHtml(contract)}
      </p>`
    : `
      <p style="margin:0 0 26px;font:400 15px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
        The agreement comes over in a separate email within one business day.
        Nothing starts until it is signed, so keep an eye out for it.
      </p>`;

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
                part that usually takes the longest, and it is done.
              </p>
              <p style="margin:0 0 8px;font:700 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">
                One thing left
              </p>
              <p style="margin:0 0 18px;font:400 16px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                The agreement. It sets out what gets built, what it costs, what
                you own at the end, and what happens if you want out. Read it
                properly before you sign it.
              </p>
              ${signBlock}
              <p style="margin:0 0 8px;font:700 13px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">
                Then what
              </p>
              <p style="margin:0 0 18px;font:400 16px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                Once it is signed we read your answers properly and come back
                with anything that needs a real conversation rather than a form
                box, plus the account access we need. Build time is two to three
                weeks from that point.
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
    `Your answers for ${business} are in. That is the part that usually takes the longest, and it is done.`,
    "",
    "ONE THING LEFT",
    "The agreement. It sets out what gets built, what it costs, what you own at the end, and what happens if you want out. Read it properly before you sign it.",
    "",
    contract
      ? contract
      : "It comes over in a separate email within one business day. Nothing starts until it is signed.",
    "",
    "THEN WHAT",
    "Once it is signed we read your answers properly and come back with anything that needs a real conversation rather than a form box, plus the account access we need. Build time is two to three weeks from that point.",
    "",
    "Remembered something, or got one wrong? Reply to this email and say so. Nothing is locked in.",
    "",
    "Maximilian",
    "FootHold Systems",
    `${CONTACT_EMAIL} | ${CONTACT_PHONE}`,
    BUSINESS_ADDRESS,
  ].join("\n");

  return {
    subject: `We have everything for ${business}. One thing left to sign.`,
    html,
    text,
  };
}
