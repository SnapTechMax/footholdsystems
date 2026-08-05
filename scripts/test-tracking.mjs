/**
 * Sends one real sequence email to yourself, so a click can be watched all the
 * way to a row in the database.
 *
 *   RESEND_API_KEY=re_xxx node scripts/test-tracking.mjs max@snaptechrepair.com
 *   RESEND_API_KEY=re_xxx node scripts/test-tracking.mjs max@... --step quotes
 *
 * The body is the actual copy from content/nurture-sequence.mjs, not a stand-in,
 * because the whole point is to exercise the real links: every one of them
 * carries `foothold-nurture-NN-key`, and that is what the click webhook resolves
 * back to a sequence step. A hand-written test email would prove nothing about
 * the attribution path.
 *
 * Two deliberate differences from an automation send:
 *
 *  - `{{{EMAIL}}}` is substituted here. Resend fills that from the contact
 *    record during an automation, and there is no contact behind a direct send,
 *    so it would otherwise arrive literally and /api/go/book would discard it.
 *  - Tags are attached. An automation's send_email step cannot carry them —
 *    it takes template, from, subject and reply_to and nothing else — but a
 *    direct send can, and having them on the test event shows the webhook is
 *    reading `data.tags` correctly if that path is ever needed.
 *
 * Neither difference touches the link, which is what is being tested.
 */

import { Resend } from "resend";
import { SEQUENCE } from "../content/nurture-sequence.mjs";

const args = process.argv.slice(2);
const to = args.find((a) => a.includes("@"));
const stepFlag = args.indexOf("--step");
const stepKey = stepFlag >= 0 ? args[stepFlag + 1] : "quotes";

if (!process.env.RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not set.");
  process.exit(1);
}
if (!to) {
  console.error("Pass the address to send to, e.g. node scripts/test-tracking.mjs you@example.com");
  process.exit(1);
}

const index = SEQUENCE.findIndex((e) => e.key === stepKey);
if (index < 0) {
  console.error(
    `No sequence step called "${stepKey}". Available:\n  ` +
      SEQUENCE.map((e) => e.key).join(", ")
  );
  process.exit(1);
}

const email = SEQUENCE[index];
// Read off the sequence rather than rebuilt from the key. The links carry
// `nurture-10-quotes` while the Resend template is named
// `foothold-nurture-10-quotes`, and reconstructing the wrong one of those here
// would print a campaign that appears nowhere in the email being sent.
const campaign = email.campaign;

// What the automation's merge tag would have produced.
const fill = (s) => s.replaceAll("{{{EMAIL}}}", encodeURIComponent(to));

const FROM =
  process.env.SEQUENCE_FROM || "Max at Foothold Systems <max@footholdsystems.com>";

const resend = new Resend(process.env.RESEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: FROM,
  to,
  replyTo: process.env.SEQUENCE_REPLY_TO || "max@footholdsystems.com",
  subject: `[test] ${email.subject}`,
  html: fill(email.plainHtml),
  text: fill(email.text),
  tags: [
    { name: "sequence_step", value: String(index + 1) },
    { name: "sequence_key", value: email.key },
  ],
});

if (error) {
  console.error(`\nsend failed: ${error.message ?? JSON.stringify(error)}\n`);
  process.exit(1);
}

console.log(`
  sent      ${email.subject}
  step      ${index + 1} of ${SEQUENCE.length}  (key: ${email.key})
  campaign  ${campaign}
  to        ${to}
  email_id  ${data.id}

  Now click the booking link in that email, then:

    psql "$DATABASE_URL" -c "SELECT event_type, email_key, recipient, link, occurred_at \\
      FROM email_events ORDER BY id DESC LIMIT 5;"

  email_key should read "${email.key}".
`);
