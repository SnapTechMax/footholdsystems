/**
 * Renders the nurture sequence into a build sheet for MailerLite.
 *
 *   node scripts/build-sequence-sheet.mjs
 *
 * MailerLite's API cannot create automation steps or email content, so the
 * sequence has to be assembled by hand in their builder. This produces a single
 * page laying each email out in the order the builder asks for it, with the body
 * in both plain text and HTML so either paste route works.
 *
 * Writes content/mailerlite-build-sheet.html.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { SEQUENCE, BOOKING_URL } from "../content/nurture-sequence.mjs";

/**
 * Rewrite Resend's template syntax to MailerLite's.
 *
 * The copy was written for Resend, which uses {{{FIRST_NAME}}}. MailerLite uses
 * {$name}, and `name` is one of its default fields, which is the field the site
 * already sends. Pasting the Resend form would render the literal braces to
 * every subscriber.
 */
function toMailerLite(text) {
  return text.replace(/\{\{\{FIRST_NAME\}\}\}/g, "{$name}");
}

/** Strip the HTML paragraph wrappers back to readable lines. */
function toPlainText(bodyHtml) {
  return bodyHtml
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*<p[^>]*>/, "")
        .replace(/<\/p>\s*$/, "")
        .replace(/<em>(.*?)<\/em>/g, "$1")
        .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, "$2 ($1)")
        .replace(/&mdash;/g, "-")
        .replace(/&middot;/g, "·")
        .replace(/&rarr;/g, "→")
        .replace(/&amp;/g, "&")
        .trim()
    )
    .filter(Boolean)
    .join("\n\n");
}

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let day = 0;
const cards = SEQUENCE.map((email, index) => {
  day += parseInt(email.delay, 10);
  const n = String(index + 1).padStart(2, "0");
  const plain = toMailerLite(
    toPlainText(email.body) + "\n\n" + email.ask + "\n\nMax"
  );
  const bodyHtml = toMailerLite(email.body.replace(/^\s+/gm, "").trim());
  const cta = `${BOOKING_URL}?utm_source=footholdsystems&utm_medium=email&utm_campaign=${email.campaign}`;

  return `
<section class="card">
  <header>
    <span class="num">${n}</span>
    <span class="meta">Delay after previous step: <b>${email.delay}</b> &nbsp;·&nbsp; lands day ${day}</span>
  </header>

  <label>Subject line</label>
  <pre class="copy">${esc(email.subject)}</pre>

  <label>Body: plain text, paste into MailerLite's text block</label>
  <pre class="copy">${esc(plain)}</pre>

  <label>Button</label>
  <pre class="copy">${esc(email.cta)}</pre>
  <label>Button link</label>
  <pre class="copy small">${esc(cta)}</pre>

  <details>
    <summary>Body as HTML, if you prefer pasting into an HTML block</summary>
    <pre class="copy small">${esc(bodyHtml)}</pre>
  </details>
</section>`;
}).join("\n");

const html = `<title>MailerLite build sheet</title>
<style>
  body { background:#eae8e1; color:#1f1f1d; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; margin:0; padding:32px 16px; }
  .wrap { max-width:760px; margin:0 auto; }
  h1 { font-size:22px; margin:0 0 6px; }
  .lede { color:#57564f; font-size:14px; line-height:1.6; margin:0 0 28px; }
  .steps { background:#fff; border:1px solid #d4d1c6; border-radius:10px; padding:18px 22px; margin-bottom:28px; font-size:14px; line-height:1.7; }
  .steps.warn { border-color:#e0c46a; background:#fdf8e8; }
  .steps h2 { font-size:13px; text-transform:uppercase; letter-spacing:.12em; color:#7a786f; margin:0 0 10px; }
  .card { background:#fff; border:1px solid #d4d1c6; border-radius:10px; padding:18px 22px; margin-bottom:18px; }
  .card header { display:flex; align-items:baseline; gap:12px; border-bottom:1px solid #eae8e1; padding-bottom:10px; margin-bottom:14px; }
  .num { background:#1b1b1b; color:#f6be00; font-family:ui-monospace,monospace; font-size:13px; font-weight:700; padding:3px 9px; border-radius:5px; }
  .meta { color:#7a786f; font-size:13px; }
  label { display:block; font-family:ui-monospace,monospace; font-size:10px; text-transform:uppercase; letter-spacing:.14em; color:#7a786f; margin:14px 0 5px; }
  pre.copy { background:#f4f2ec; border:1px solid #e2dfd4; border-radius:6px; padding:11px 13px; margin:0; font-size:14px; line-height:1.6; white-space:pre-wrap; word-break:break-word; font-family:-apple-system,sans-serif; }
  pre.copy.small { font-family:ui-monospace,monospace; font-size:11.5px; color:#57564f; }
  details { margin-top:14px; }
  summary { cursor:pointer; font-size:12px; color:#7a786f; }
  details pre { margin-top:8px; }
</style>
<div class="wrap">
  <h1>MailerLite build sheet</h1>
  <p class="lede">22 emails over 38 days. MailerLite's API cannot create automation steps, so this is built by hand in their builder. Each card below is one step, in order.</p>

  <div class="steps">
    <h2>Before you start</h2>
    1. Automations → Create automation.<br>
    2. Trigger: <b>When subscriber joins a group</b> → <b>FootHold Systems Campaign 1</b>.<br>
    3. Add a <b>Condition</b> as the first step: field <code>booked</code> is <b>not</b> equal to <code>yes</code>. Route the "no" side out of the automation, so anyone who books stops receiving it.<br>
    4. Then for each card: add a <b>Delay</b> with the stated duration, followed by an <b>Email</b> with the subject and body given.<br>
    5. Repeat the condition before the later emails if you want tighter suppression. Once per few steps is usually enough.
  </div>

  <div class="steps warn">
    <h2>Two things that will bite otherwise</h2>
    <b>Set a fallback on {$name}.</b> The name field on the form is optional, so a good share of subscribers have none, and with no fallback they open to "Hi ,". When you insert the variable through MailerLite's picker it offers a fallback value: use <b>there</b>. The text below already uses MailerLite's syntax rather than the Resend form the copy was written in.<br><br>
    <b>Do not paste a footer or unsubscribe link.</b> MailerLite appends its own, and a second one is both ugly and confusing. The bodies below deliberately stop after the signature.
  </div>
${cards}
</div>`;

mkdirSync("content", { recursive: true });
writeFileSync("content/mailerlite-build-sheet.html", html);
console.log(
  `wrote content/mailerlite-build-sheet.html: ${SEQUENCE.length} emails, ${day} day sequence`
);
