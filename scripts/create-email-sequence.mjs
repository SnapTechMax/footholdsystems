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
import { SEQUENCE } from "../content/nurture-sequence.mjs";

const DRY = process.argv.includes("--dry-run");
const TRIGGER_EVENT = "guide.downloaded";

// Which HTML shell to push. `plain` selects the stripped-down one in
// content/nurture-sequence.mjs — no wrapper, no masthead, no rule, and the CTA
// as an inline link instead of a button — which is the shape that reads as
// personal mail rather than as a newsletter. Default is the existing design, so
// this changes nothing until it is asked for.
//
// Reverting is dropping the variable. Both shells are built on every run, so
// neither can rot while the other is in use.
const PLAIN_STYLE = process.env.SEQUENCE_STYLE === "plain";
const bodyHtml = (email) => (PLAIN_STYLE ? email.plainHtml : email.html);

// Contact property set by the Calendly webhook in app/api/calendly/webhook.
// Resend contact properties are string or number only, so this holds "yes"/"no"
// rather than a boolean.
const BOOKED_PROPERTY = "booked";

// Check that property before every send and end the run for anyone who has
// booked. Turning this off drops the checks and roughly a third of the steps,
// which is the fallback if the automation is ever rejected for size.
const SUPPRESS_AFTER_BOOKING = process.env.SUPPRESS_AFTER_BOOKING !== "0";

// A person, not a brand. These emails are signed by Max and several of them ask
// for a reply, so a noreply@ sender would be working against the copy. The
// domain is verified in Resend and publishes DMARC p=reject, which Resend
// satisfies through DKIM alignment.
const FROM =
  process.env.SEQUENCE_FROM || "Max at Foothold Systems <max@footholdsystems.com>";
const REPLY_TO = process.env.SEQUENCE_REPLY_TO || "max@footholdsystems.com";

const resend = new Resend(process.env.RESEND_API_KEY ?? "re_dry_run");

/** Surface Resend's structured errors rather than failing silently. */
function unwrap(label, { data, error }) {
  if (error) throw new Error(`${label}: ${error.message ?? JSON.stringify(error)}`);
  return data;
}

async function main() {
  // Checked here rather than at module scope. At module scope it fired on
  // import, so switch-sequence.mjs exited before it could report anything of
  // its own, which made this file impossible to reuse.
  if (!process.env.RESEND_API_KEY && !DRY) {
    throw new Error("RESEND_API_KEY is not set. Re-run with the key, or pass --dry-run.");
  }

  console.log(
    `\n${SEQUENCE.length} emails, from ${FROM}, reply-to ${REPLY_TO}` +
      `\nstyle: ${PLAIN_STYLE ? "plain (no button, no masthead)" : "designed (current)"}` +
      (DRY ? "  [dry run]" : "") +
      "\n"
  );

  // The condition steps read contact.booked, so the property has to exist before
  // the automation referencing it does. Safe to re-run: an existing property is
  // treated as success.
  if (SUPPRESS_AFTER_BOOKING && !DRY) {
    const { error } = await resend.contactProperties.create({
      key: BOOKED_PROPERTY,
      type: "string",
      fallbackValue: "no",
    });
    // 409 means it already exists, which is the expected state on any re-run.
    // Matched on status rather than message text: the wording here is "There is
    // already a contact property with this key", which an "already exists" check
    // does not catch. Status codes are the contract; the prose is not.
    if (error && error.statusCode !== 409) {
      throw new Error(`contact property ${BOOKED_PROPERTY}: ${error.message}`);
    }
    console.log(
      `  contact property ready: ${BOOKED_PROPERTY}${error ? " (already existed)" : ""}\n`
    );
  }

  const templateIds = [];

  for (const email of SEQUENCE) {
    if (DRY) {
      console.log(`  would create  ${email.name}`);
      console.log(`      after     ${email.delay}`);
      console.log(`      subject   ${email.subject}`);
      console.log(`      html      ${bodyHtml(email).length} chars`);
      console.log(`      text      ${email.text.length} chars\n`);
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
          html: bodyHtml(email),
          // The text/plain part, generated from the same source as the HTML.
          // Sending HTML alone is a long-standing spam signal, and this domain
          // publishes DMARC p=reject, so there is no room to spend on
          // reputation. Both parts carry the same tracked booking link.
          text: email.text,
          // No `variables` array. FIRST_NAME is reserved in Resend and comes
          // from the contact automatically, so declaring it is rejected with a
          // 422. That also means there is nowhere to set a fallback on it, so
          // the default lives at enrolment instead: lib/subscribe.ts stores
          // "there" when someone leaves the name field blank, which keeps the
          // greeting from opening "Hi ,".
        })
        .publish()
    );

    templateIds.push(created.id);
    console.log(`  created + published  ${email.name}  (${created.id})`);
  }

  // trigger → delay → check booked → email → delay → check booked → email → ...
  //
  // The check sits before every send rather than at a few checkpoints because a
  // booking can land at any point across the 38 days, and the whole purpose of
  // the sequence is to get that booking. Once it exists, every remaining email
  // is asking for something the reader has already done.
  //
  // The condition_met branch is left with no outgoing connection, which ends the
  // run for that contact.
  const steps = [
    { key: "start", type: "trigger", config: { eventName: TRIGGER_EVENT } },
  ];
  const connections = [];
  let previous = "start";

  SEQUENCE.forEach((email, index) => {
    const delayKey = `wait_${email.key}`;
    const checkKey = `check_${email.key}`;
    const sendKey = `send_${email.key}`;

    steps.push({
      key: delayKey,
      type: "delay",
      config: { duration: email.delay },
    });

    if (SUPPRESS_AFTER_BOOKING) {
      steps.push({
        key: checkKey,
        type: "condition",
        config: {
          type: "rule",
          field: `contact.${BOOKED_PROPERTY}`,
          operator: "eq",
          value: "yes",
        },
      });
    }

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
    if (SUPPRESS_AFTER_BOOKING) {
      connections.push({ from: delayKey, to: checkKey });
      // Booked: no connection out of condition_met, so the run stops here.
      connections.push({ from: checkKey, to: sendKey, type: "condition_not_met" });
    } else {
      connections.push({ from: delayKey, to: sendKey });
    }
    previous = sendKey;
  });

  const automation = {
    name: "5 Levels of AI nurture",
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
  return created.id;
}

// Exported so switch-sequence.mjs can build the replacement without a second
// copy of this logic drifting away from it.
export { main as createSequence, TRIGGER_EVENT };

// Only self-run when invoked directly, so importing this does not create 22
// templates as a side effect.
const invokedDirectly =
  process.argv[1] && import.meta.url === `file://${process.argv[1]}`;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`\nFailed: ${error.message}\n`);
    process.exit(1);
  });
}
