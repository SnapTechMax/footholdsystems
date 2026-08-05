/**
 * Renders both email shells side by side, so the choice is made by looking
 * rather than by reading a diff.
 *
 *   node scripts/preview-sequence.mjs                    # email 1
 *   node scripts/preview-sequence.mjs 14                 # email 14
 *   node scripts/preview-sequence.mjs 1 /tmp/out.html    # somewhere specific
 *
 * Writes a self-contained HTML file and prints its path. Nothing is sent and
 * nothing touches Resend.
 *
 * Each version renders in its own iframe. That isolation matters: an email body
 * is a fragment of inline-styled HTML that expects to be the whole document, and
 * dropping two of them into one page lets the surrounding stylesheet reach in
 * and make both look like neither.
 *
 * Merge tags are filled with sample values, because `Hi {{{FIRST_NAME}}},` tells
 * you nothing about how the greeting reads.
 */

import { writeFileSync } from "node:fs";
import { SEQUENCE } from "../content/nurture-sequence.mjs";

const position = Number(process.argv[2] ?? 1);
const outPath = process.argv[3] ?? "sequence-preview.html";

const email = SEQUENCE[position - 1];
if (!email) {
  console.error(
    `No email at position ${position}. The sequence has ${SEQUENCE.length}.`
  );
  process.exit(1);
}

/** Stand-ins for what Resend substitutes at send time. */
function fillMergeTags(html) {
  return html
    .replace(/\{\{\{FIRST_NAME\}\}\}/g, "Dave")
    .replace(/\{\{\{EMAIL\}\}\}/g, "dave@example.com")
    .replace(/\{\{\{RESEND_UNSUBSCRIBE_URL\}\}\}/g, "#unsubscribe");
}

/** Escape for an iframe srcdoc attribute. */
function forSrcdoc(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function panel(title, note, html) {
  return `      <section class="panel">
        <h2>${title}</h2>
        <p class="note">${note}</p>
        <iframe srcdoc="${forSrcdoc(fillMergeTags(html))}"></iframe>
      </section>`;
}

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Email ${position} — designed vs plain</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 24px; font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f4f2; color: #1f1f1d; }
  @media (prefers-color-scheme: dark) { body { background: #17171a; color: #e8e6e1; } }
  header { max-width: 1200px; margin: 0 auto 20px; }
  h1 { margin: 0 0 6px; font-size: 19px; }
  .subject { font-weight: 600; }
  .meta { margin: 0; opacity: 0.7; font-size: 13px; }
  .grid { display: grid; gap: 20px; max-width: 1200px; margin: 0 auto; grid-template-columns: 1fr; }
  @media (min-width: 900px) { .grid { grid-template-columns: 1fr 1fr; } }
  .panel { display: flex; flex-direction: column; min-width: 0; }
  h2 { margin: 0 0 4px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; }
  .note { margin: 0 0 10px; font-size: 12.5px; opacity: 0.72; min-height: 2.6em; }
  iframe { width: 100%; height: 620px; border: 1px solid rgba(128,128,128,0.35); border-radius: 6px; background: #fff; }
</style>
</head>
<body>
  <header>
    <h1>Email ${position} of ${SEQUENCE.length} &mdash; <span class="subject">${email.subject}</span></h1>
    <p class="meta">Sent on day ${
      SEQUENCE.slice(0, position).reduce((d, e) => d + parseInt(e.delay, 10), 0)
    } &middot; campaign <code>${email.campaign}</code> &middot; merge tags filled with sample values</p>
  </header>
  <div class="grid">
${panel(
  "Designed (current)",
  "Coloured canvas, fixed-width column, uppercase masthead, horizontal rule, and a padded button. This is what ships today.",
  email.html
)}
${panel(
  "Plain (SEQUENCE_STYLE=plain)",
  "No canvas, no column, no masthead, no rule. CTA is an ordinary inline link in the client's default styling. Address and unsubscribe stay — both are required.",
  email.plainHtml
)}
  </div>
</body>
</html>`;

writeFileSync(outPath, page);
console.log(`wrote ${outPath} — open it in a browser`);
