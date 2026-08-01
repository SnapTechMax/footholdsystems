/**
 * Pushes the nurture sequence in email-sequence.mjs to Resend.
 *
 *   RESEND_API_KEY=re_xxx node scripts/create-email-sequence.mjs
 *
 * Creates and publishes one template per email — unpublished templates can't be
 * used in an Automation — then creates the Automation wiring them together with
 * delays. The automation is created DISABLED: nothing sends until it's been read
 * through in the dashboard and started.
 *
 * Pass --dry-run to print what would be created without calling the API.
 *
 * Note before re-running: an enabled Automation's steps cannot be edited in
 * Resend. Changing the sequence means duplicating it, editing the copy, then
 * switching over. This script creates a fresh set rather than updating an
 * existing one, so remove the old automation when you cut across.
 */

import { Resend } from "resend";
import { SEQUENCE } from "./email-sequence.mjs";

const DRY = process.argv.includes("--dry-run");
const TRIGGER_EVENT = "guide.downloaded";

// A person, not a brand. These emails are signed by Max and several of them ask
// for a reply, so a noreply@ sender would be working against the copy. The
// domain is verified in Resend and publishes DMARC p=reject, which Resend
// satisfies through DKIM alignment.
const FROM =
  process.env.SEQUENCE_FROM || "Max at Foothold Systems <max@footholdsystems.com>";
const REPLY_TO = process.env.SEQUENCE_REPLY_TO || "max@footholdsystems.com";

if (!process.env.RESEND_API_KEY && !DRY) {
  console.error(
    "RESEND_API_KEY is not set. Re-run with the key, or pass --dry-run."
  );
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_dry_run");

/** Surface Resend's structured errors rather than failing silently. */
function unwrap(label, { data, error }) {
  if (error) throw new Error(`${label}: ${error.message ?? JSON.stringify(error)}`);
  return data;
}

async function main() {
  console.log(
    `\n${SEQUENCE.length} emails, from ${FROM}, reply-to ${REPLY_TO}` +
      (DRY ? "  [dry run]" : "") +
      "\n"
  );

  const templateIds = [];

  for (const email of SEQUENCE) {
    if (DRY) {
      console.log(`  would create  ${email.name}`);
      console.log(`      after     ${email.delay}`);
      console.log(`      subject   ${email.subject}`);
      console.log(`      html      ${email.html.length} chars\n`);
      templateIds.push(`dry-${email.key}`);
      continue;
    }

    // create() is chainable, so the template is published in the same call.
    const created = unwrap(
      `template ${email.name}`,
      await resend.templates
        .create({
          name: email.name,
          subject: email.subject,
          from: FROM,
          replyTo: REPLY_TO,
          html: email.html,
          variables: [
            // The name field on the form is optional, so plenty of contacts
            // have none. "Hi ," as a first line is exactly the tell that makes
            // an email feel automated.
            { key: "FIRST_NAME", type: "string", fallbackValue: "there" },
          ],
        })
        .publish()
    );

    templateIds.push(created.id);
    console.log(`  created + published  ${email.name}  (${created.id})`);
  }

  // trigger → delay → email → delay → email → ...
  const steps = [
    { key: "start", type: "trigger", config: { eventName: TRIGGER_EVENT } },
  ];
  const connections = [];
  let previous = "start";

  SEQUENCE.forEach((email, index) => {
    const delayKey = `wait_${email.key}`;
    const sendKey = `send_${email.key}`;

    steps.push({
      key: delayKey,
      type: "delay",
      config: { duration: email.delay },
    });
    steps.push({
      key: sendKey,
      type: "send_email",
      config: {
        template: { id: templateIds[index] },
        from: FROM,
        subject: email.subject,
        replyTo: REPLY_TO,
      },
    });

    connections.push({ from: previous, to: delayKey });
    connections.push({ from: delayKey, to: sendKey });
    previous = sendKey;
  });

  const automation = {
    name: "5 Levels of AI — nurture",
    // Disabled on purpose: an automation is easy to create and awkward to unsend.
    status: "disabled",
    steps,
    connections,
  };

  if (DRY) {
    console.log(JSON.stringify(automation, null, 2));
    console.log("\nDry run — nothing was created.");
    return;
  }

  const created = unwrap("automation", await resend.automations.create(automation));
  console.log(`\n  automation created: ${created.id}`);
  console.log(`  trigger: ${TRIGGER_EVENT}`);
  console.log(
    "\nIt is DISABLED. Open Resend → Automations, read it through, then press Start.\n"
  );
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}\n`);
  process.exit(1);
});
