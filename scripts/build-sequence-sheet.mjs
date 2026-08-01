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
import { SEQUENCE, BOOKING_URL, BRAND_ADDRESS } from "../content/nurture-sequence.mjs";

/**
 * Rewrite Resend's template syntax to MailerLite's.
 *
 * The copy was written for Resend, which uses {{{FIRST_NAME}}}. MailerLite uses
 * {$name}, and `name` is one of its default fields, which is the field the site
 * already sends. Pasting the Resend form would render the literal braces to
 * every subscriber.
 */
function toMailerLite(text) {
  // The default() form matters: the name field on the form is optional, so a
  // real share of subscribers have none, and a bare {$name} opens the email
  // with "Hi ,". Baking the fallback in beats relying on it being set correctly
  // twenty-two times in the editor.
  return text.replace(/\{\{\{FIRST_NAME\}\}\}/g, "{$name|default('there')}");
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

/**
 * Font stacks, each with a real fallback first in mind.
 *
 * Gmail and Outlook strip @font-face, so Archivo, Source Serif and JetBrains
 * Mono will not load for most recipients. What actually renders is the second
 * name in each stack, so those are chosen to hold the site's character rather
 * than to be a generic default: Georgia carries the serif body, and a monospace
 * stack keeps the eyebrow labels looking like the site's.
 */
const SANS =
  "Archivo,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "'Source Serif 4',Georgia,'Times New Roman',serif";
const MONO =
  "'JetBrains Mono',ui-monospace,'SF Mono',Menlo,Consolas,'Courier New',monospace";

const CREAM = "#eae8e1";
const INK = "#1b1b1b";
const YELLOW = "#f6be00";
const BODY_TEXT = "#1f1f1d";

/**
 * One paste per email: body, ask, signature and button, ready for MailerLite's
 * HTML block.
 *
 * No page wrapper, since MailerLite's template supplies that, but the block does
 * carry its own address line and unsubscribe link. MailerLite's default footer
 * must be turned off or every email ships with two of each.
 *
 * Styles are inline and the button is a table rather than a padded anchor.
 * Outlook ignores padding on an <a>, which collapses the button to bare text
 * for a chunk of business recipients, and this audience is all business
 * recipients.
 */
function toEmailHtml(email, ctaUrl) {
  const paras = email.body
    .split("\n")
    .map((line) => line.replace(/^\s*<p[^>]*>/, "").replace(/<\/p>\s*$/, "").trim())
    .filter(Boolean)
    .concat([email.ask])
    .map(
      (text) =>
        `        <p style="margin:0 0 17px;font-family:${SERIF};font-size:17px;line-height:1.62;color:${BODY_TEXT};">${text}</p>`
    )
    .join("\n");

  // Table with bgcolor rather than a padded anchor: Outlook ignores padding on
  // an <a> and collapses the button into bare underlined text.
  const button = `        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;">
          <tr>
            <td align="center" bgcolor="${INK}" style="border-radius:8px;">
              <a href="${ctaUrl}" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:15px;font-weight:700;color:#f2efe6;text-decoration:none;border-radius:8px;">${email.cta} &rarr;</a>
            </td>
          </tr>
        </table>`;

  // Layout is tables and bgcolor throughout, because Outlook does not render
  // background colour on a div.
  return toMailerLite(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};">
  <tr>
    <td bgcolor="${INK}" style="padding:22px 30px 20px;">
      <p style="margin:0;font-family:${MONO};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${YELLOW};">Foothold Systems</p>
      <h1 style="margin:11px 0 0;font-family:${SANS};font-size:25px;line-height:1.15;font-weight:800;letter-spacing:-0.01em;color:#f2efe6;">${email.subject}</h1>
    </td>
  </tr>
  <tr>
    <td bgcolor="${YELLOW}" style="height:5px;line-height:5px;font-size:0;">&nbsp;</td>
  </tr>
  <tr>
    <td bgcolor="${CREAM}" style="padding:28px 30px 24px;">
${paras}
${button}
        <p style="margin:20px 0 0;font-family:${SERIF};font-size:17px;line-height:1.62;color:${BODY_TEXT};">Max</p>
    </td>
  </tr>
  <tr>
    <td bgcolor="${CREAM}" style="padding:0 30px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="border-top:1px solid #d4d1c6;font-size:0;line-height:0;padding:0 0 15px;">&nbsp;</td></tr>
        <tr>
          <td style="font-family:${MONO};font-size:11px;line-height:1.7;color:#7a786f;">
            Foothold Systems &middot; ${BRAND_ADDRESS}<br>
            <a href="{$unsubscribe}" style="color:#7a786f;text-decoration:underline;">Unsubscribe</a>. One click, no hard feelings.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`);
}

let day = 0;
const cards = SEQUENCE.map((email, index) => {
  day += parseInt(email.delay, 10);
  const n = String(index + 1).padStart(2, "0");
  const plain = toMailerLite(
    toPlainText(email.body) + "\n\n" + email.ask + "\n\nMax"
  );
  const cta = `${BOOKING_URL}?utm_source=footholdsystems&utm_medium=email&utm_campaign=${email.campaign}`;
  const emailHtml = toEmailHtml(email, cta);

  return `
<section class="card">
  <header>
    <span class="num">${n}</span>
    <span class="meta">Delay before this email: <b>${email.delay}</b> &nbsp;·&nbsp; lands day ${day}</span>
  </header>

  <label>Subject line</label>
  <pre class="copy" id="s${n}">${esc(email.subject)}</pre>
  <button class="cp" data-target="s${n}">Copy subject</button>

  <label>HTML: paste into MailerLite's HTML block</label>
  <pre class="copy small" id="h${n}">${esc(emailHtml)}</pre>
  <button class="cp" data-target="h${n}">Copy HTML</button>

  <details>
    <summary>Plain text version, if you would rather type it into a text block</summary>
    <pre class="copy">${esc(plain)}</pre>
    <label>Button link</label>
    <pre class="copy small">${esc(cta)}</pre>
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
  button.cp { margin-top:7px; background:#1b1b1b; color:#f6be00; border:0; border-radius:5px; padding:6px 13px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; }
  button.cp:hover { background:#2c2c29; }
  button.cp.done { background:#2f6f4f; color:#fff; }
</style>
<div class="wrap">
  <h1>MailerLite build sheet</h1>
  <p class="lede">22 emails over 38 days. MailerLite's API cannot create automation steps, so this is built by hand in their builder. Each card below is one step, in order.</p>

  <div class="steps">
    <h2>Before you start</h2>
    1. Automations → Create automation.<br>
    2. Trigger: <b>When subscriber joins a group</b> → <b>FootHold Systems Campaign 1</b>.<br>
    3. Set the template background to <code>#eae8e1</code> so the blocks blend into one surface rather than sitting as a card on white.<br>
    4. Then for each card: add a <b>Delay</b> with the stated duration, followed by an <b>Email</b>. In the email, drop in an <b>HTML block</b> and paste the block given. Copy the subject line across too.<br>
    5. Once the chain works, add a <b>Condition</b> on <code>booked</code> equals <code>yes</code>, ending the Yes path so anyone who books stops receiving the rest. Build it after the emails, not before: an empty field compared the wrong way round routes everyone out and the automation silently sends nothing.
  </div>

  <div class="steps warn">
    <h2>Three things that will bite otherwise</h2>
    <b>Turn off MailerLite's own footer.</b> Each block below now ends with its own address line and unsubscribe link. If MailerLite's default footer is also switched on, every email goes out with two of each, which looks broken and muddies which unsubscribe is real. Remove or empty the footer block in the template.<br><br>
    <b>The name fallback is already handled.</b> The copy uses <code>{$name|default('there')}</code>, so a subscriber with no name reads "Hi there," rather than "Hi ,". Nothing to configure.<br><br>
    <b>Variables do not resolve in test sends.</b> MailerLite only substitutes <code>{$email}</code>, <code>{$name}</code> and <code>{$last_name}</code> in tests, so <code>{$unsubscribe}</code> will look dead when you preview. That is expected. Check it on a real send to yourself through the automation.
  </div>
${cards}
</div>
<script>
document.querySelectorAll('button.cp').forEach(function (b) {
  b.addEventListener('click', function () {
    var el = document.getElementById(b.dataset.target);
    navigator.clipboard.writeText(el.innerText).then(function () {
      var was = b.textContent;
      b.textContent = 'Copied';
      b.classList.add('done');
      setTimeout(function () { b.textContent = was; b.classList.remove('done'); }, 1200);
    });
  });
});
</script>`;

mkdirSync("content", { recursive: true });
writeFileSync("content/mailerlite-build-sheet.html", html);
console.log(
  `wrote content/mailerlite-build-sheet.html: ${SEQUENCE.length} emails, ${day} day sequence`
);
