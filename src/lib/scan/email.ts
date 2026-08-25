import "server-only";
import type { ScanReport } from "./types";
import {
  SOLUTIONS_PRICE,
  checkoutUrl,
  reportUrl,
  unsubscribeUrl,
} from "./pricing";
import { BUSINESS_ADDRESS } from "@/lib/site";

/**
 * The scan report email.
 *
 * Light background on purpose, despite the site being dark. Dark-background
 * HTML email renders inconsistently across clients and gets flagged more often
 * by spam filters; this is the one surface where matching the brand exactly is
 * worth less than arriving in the inbox and being readable in Outlook.
 *
 * Table-based layout and inline styles throughout, because that is still what
 * email clients support. No external CSS, no web fonts, no background images.
 *
 * The paywall is enforced by what this function is given, not by what it
 * renders: it takes the findings' `problem` and `consequence` and never touches
 * `fix`. Passing a full report here would put the paid half in an email, where
 * it can be forwarded and is impossible to claw back.
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

export interface ReportEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Subject line.
 *
 * Leads with the score and the domain. Both are specific to them, which is what
 * keeps this out of the "another marketing email" bucket — and the number is
 * the thing that makes someone open it.
 */
function subjectFor(report: ScanReport): string {
  if (report.findings.length === 0) {
    return `${report.domain} scored ${report.score}/100 for AI visibility, and there's nothing to fix`;
  }
  return `${report.domain} scored ${report.score}/100. Here's what AI can't see`;
}

export function buildReportEmail(args: {
  report: ScanReport;
  token: string;
  email: string;
}): ReportEmail {
  const { report, token, email } = args;
  const link = reportUrl(token);
  const pay = checkoutUrl(token, "solutions");
  const findings = report.findings;
  const hasFindings = findings.length > 0;

  const findingRows = findings
    .map(
      (f, i) => `
      <tr>
        <td style="padding:0 0 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid ${LINE};border-radius:8px;">
            <tr>
              <td style="padding:18px 20px;">
                <p style="margin:0 0 6px;font:700 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:${MUTED};">
                  Problem ${i + 1}${f.tier === "required" ? " &middot; Critical" : ""}
                </p>
                <p style="margin:0 0 10px;font:700 18px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                  ${escapeHtml(f.title)}
                </p>
                <p style="margin:0 0 10px;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                  <strong style="color:${INK};">What we found:</strong> ${escapeHtml(f.problem)}
                </p>
                <p style="margin:0;font:400 15px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                  ${escapeHtml(f.consequence)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 20px;background:#faf9f6;border-top:1px solid ${LINE};border-radius:0 0 8px 8px;">
                <p style="margin:0;font:400 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                  <strong style="color:${INK};">How to fix it:</strong>
                  <span style="color:#b0aca4;">&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;&#9608;</span>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");

  const payButton = pay
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
        <tr>
          <td style="background:${ACCENT};border-radius:8px;">
            <a href="${escapeHtml(pay)}" style="display:inline-block;padding:16px 30px;font:800 16px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};text-decoration:none;letter-spacing:.01em;">
              Unlock the fixes &mdash; ${SOLUTIONS_PRICE} &rarr;
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font:400 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
        Pay straight from this email. You get the full write-up immediately. No call, no upsell to sit through.
      </p>`
    : `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
        <tr>
          <td style="background:${ACCENT};border-radius:8px;">
            <a href="${escapeHtml(link)}" style="display:inline-block;padding:16px 30px;font:800 16px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};text-decoration:none;">
              Unlock the fixes &mdash; ${SOLUTIONS_PRICE} &rarr;
            </a>
          </td>
        </tr>
      </table>`;

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subjectFor(report))}</title></head>
<body style="margin:0;padding:0;background:#f2f0ea;">
  <!-- Preheader: the grey line next to the subject in most inboxes. Without one
       clients pull the first visible text, which here would be the logo alt. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(report.verdict)}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f2f0ea;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">

          <tr>
            <td style="padding:22px 28px;background:${INK};">
              <p style="margin:0;font:700 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#ffffff;">
                FootHold <span style="color:${ACCENT};">AEO</span>
              </p>
            </td>
          </tr>

          <!-- Score. The whole reason the email gets opened, so it goes first
               and it goes big. -->
          <tr>
            <td style="padding:34px 28px 8px;" align="center">
              <p style="margin:0 0 6px;font:700 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${MUTED};">
                AI visibility score
              </p>
              <p style="margin:0;font:800 68px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                ${report.score}<span style="font-size:26px;color:${MUTED};">/100</span>
              </p>
              <p style="margin:8px 0 0;font:700 15px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                ${escapeHtml(report.domain)} &middot; Grade ${escapeHtml(report.grade)}
              </p>
              <p style="margin:6px 0 0;font:400 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                Scored as: ${escapeHtml(report.categoryLabel)}
              </p>
              ${
                report.gradeCappedBecause
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0;"><tr><td style="padding:12px 16px;background:#fdf3f1;border-radius:8px;">
                <p style="margin:0;max-width:44ch;font:400 13px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};text-align:left;">
                  <strong style="color:${INK};">Held at ${escapeHtml(report.grade)} despite a score of ${report.score}.</strong>
                  ${escapeHtml(report.gradeCappedBecause)}
                </p>
              </td></tr></table>`
                  : ""
              }
            </td>
          </tr>

          <tr>
            <td style="padding:22px 28px 0;">
              <p style="margin:0 0 16px;font:700 20px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                ${escapeHtml(report.verdict)}
              </p>
              <p style="margin:0 0 18px;font:400 15px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                ${escapeHtml(report.summary)}
              </p>
            </td>
          </tr>

          ${
            hasFindings
              ? `
          <tr>
            <td style="padding:12px 28px 0;">
              <p style="margin:0 0 4px;font:700 12px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:${MUTED};">
                What's wrong
              </p>
              <p style="margin:0 0 20px;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                Worst first. Every one of these is fixable, and none of them require you to rebuild your website.
              </p>
            </td>
          </tr>
          <tr><td style="padding:0 28px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">${findingRows}</table></td></tr>

          <!-- The offer. -->
          <tr>
            <td style="padding:8px 28px 34px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#faf9f6;border:1px solid ${LINE};border-radius:10px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 12px;font:800 22px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                      You now know what's broken. Here's what it takes to fix it.
                    </p>
                    <p style="margin:0 0 12px;font:400 15px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                      The diagnosis above is free and it's yours to keep. The repair manual isn't.
                    </p>
                    <p style="margin:0 0 12px;font:400 15px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                      For ${SOLUTIONS_PRICE} you get the exact fix for every problem on this list: what to change, where, in what order, written so you or whoever runs your website can just do it. A checklist, in the order it should be done.
                    </p>
                    <p style="margin:0 0 20px;font:400 15px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${INK};">
                      ${SOLUTIONS_PRICE} is less than an hour of most people's billable time. The competitor who fixes this first stops sharing the answer with you.
                    </p>
                    ${payButton}
                    <p style="margin:0;font:400 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                      Or <a href="${escapeHtml(link)}" style="color:${INK};">read your full report online</a> first.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
              : `
          <tr>
            <td style="padding:8px 28px 34px;">
              <p style="margin:0 0 18px;font:400 15px/1.7 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                We have nothing to sell you today. If you want a second pair of eyes on the parts a scanner can't see, such as whether an AI actually recommends you over the competitor down the road, reply to this email.
              </p>
              <p style="margin:0;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${MUTED};">
                <a href="${escapeHtml(link)}" style="color:${INK};">Your full report</a>
              </p>
            </td>
          </tr>`
          }

          <tr>
            <td style="padding:20px 28px;border-top:1px solid ${LINE};">
              <p style="margin:0 0 8px;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#8b8880;">
                You're getting this because you requested a free AI visibility scan for ${escapeHtml(report.domain)} at footholdsystems.com.
              </p>
              <p style="margin:0 0 8px;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#8b8880;">
                FootHold Systems, ${escapeHtml(BUSINESS_ADDRESS)}
              </p>
              <p style="margin:0;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#8b8880;">
                <a href="${escapeHtml(unsubscribeUrl(email))}" style="color:#8b8880;">Unsubscribe</a>
                &middot; Not affiliated with OpenAI, Google, Microsoft, Perplexity or Anthropic.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  /**
   * Plain-text alternative.
   *
   * Not optional. A multipart email without one is a deliverability penalty,
   * and this is cold-ish mail to people who just handed over an address — the
   * one category where landing in spam kills the whole funnel.
   */
  const textFindings = findings
    .map(
      (f, i) =>
        `${i + 1}. ${f.title}${f.tier === "required" ? " (CRITICAL)" : ""}\n` +
        `   What we found: ${f.problem}\n` +
        `   ${f.consequence}\n` +
        `   How to fix it: [locked]`
    )
    .join("\n\n");

  const text = [
    `FOOTHOLD AEO: AI VISIBILITY SCAN`,
    ``,
    `${report.domain}`,
    `Score: ${report.score}/100 (grade ${report.grade})`,
    `Scored as: ${report.categoryLabel}`,
    report.gradeCappedBecause
      ? `Held at ${report.grade} despite a score of ${report.score}. ${report.gradeCappedBecause}`
      : "",
    ``,
    report.verdict,
    ``,
    report.summary,
    ``,
    hasFindings ? `WHAT'S WRONG (worst first)\n\n${textFindings}` : "",
    ``,
    hasFindings
      ? [
          `THE FIXES: ${SOLUTIONS_PRICE}`,
          ``,
          `The diagnosis above is free and yours to keep. The repair manual isn't.`,
          `For ${SOLUTIONS_PRICE} you get the exact fix for every problem listed: what to`,
          `change, where, and in what order. A checklist, in the order it should be done.`,
          ``,
          pay ? `Pay and unlock: ${pay}` : `Unlock: ${link}`,
          `Read your report online: ${link}`,
        ].join("\n")
      : `Your full report: ${link}`,
    ``,
    `—`,
    `You requested a free AI visibility scan for ${report.domain} at footholdsystems.com.`,
    `FootHold Systems, ${BUSINESS_ADDRESS}`,
    `Unsubscribe: ${unsubscribeUrl(email)}`,
    `Not affiliated with OpenAI, Google, Microsoft, Perplexity or Anthropic.`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject: subjectFor(report), html, text };
}
