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
/**
 * Automation trigger. Must match EVENT_NAME in src/lib/subscribe.ts, which is
 * the only thing that sends it. If they drift, the automation simply never
 * fires and nothing reports that it did not.
 *
 * A different event from the guide sequence's `guide.downloaded`, on purpose:
 * the old automation is still listening to that one, so anybody mid-way through
 * the guide flow carries on undisturbed while new scan requesters land here.
 */
const TRIGGER_EVENT = "scan.requested";

// Which HTML shell to push.
//
// Plain is now the default: no wrapper, no coloured canvas, no masthead, no
// rule, and the CTA as an ordinary inline link rather than a padded button.
// Those five things are what separates a newsletter from a message a person
// wrote, and Gmail files bulk mail on what it looks like rather than on who
// sent it. It is the only lever on tab placement that is actually in our hands.
//
// `SEQUENCE_STYLE=designed` puts the old shell back. Both are built on every
// run, so neither can rot while the other is in use.
const PLAIN_STYLE = process.env.SEQUENCE_STYLE !== "designed";
const bodyHtml = (email) => (PLAIN_STYLE ? email.plainHtml : email.html);

/**
 * Contact property that ends the run for someone who has already converted.
 *
 * Set in two places: the Whop webhook when a done-for-you purchase lands, and
 * the Calendly webhook when a call is booked. Both count, because with Whop
 * unconfigured the upgrade link falls back to the booking page, so a booking is
 * the same conversion arriving by the other door.
 *
 * Deliberately NOT the guide sequence's `booked` property. That one is still
 * doing its job for the old automation, and reusing it would mean a change to
 * one sequence's exit rule silently altering the other's.
 *
 * Resend contact properties are string or number only, so this holds "yes"/"no"
 * rather than a boolean.
 */
const CONVERTED_PROPERTY = process.env.SEQUENCE_CONVERTED_PROPERTY || "converted";

// Check that property before every send and end the run for anyone who has
// converted. Turning this off drops the checks and roughly a third of the
// steps, which is the fallback if the automation is ever rejected for size.
const SUPPRESS_AFTER_CONVERSION = process.env.SUPPRESS_AFTER_CONVERSION !== "0";

// A person, not a brand. These emails are signed by Max and several of them ask
// for a reply, so a noreply@ sender would be working against the copy. The
// domain is verified in Resend and publishes DMARC p=reject, which Resend
// satisfies through DKIM alignment.
const FROM =
  process.env.SEQUENCE_FROM || "Max at Foothold Systems <maximilian@footholdsystems.com>";
const REPLY_TO = process.env.SEQUENCE_REPLY_TO || "maximilian@footholdsystems.com";

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

  // Register the trigger event before anything references it.
  //
  // Resend treats events as first-class objects with their own endpoints, and
  // this script previously assumed one into existence — the automation declared
  // `guide.downloaded` as its trigger and lib/subscribe.ts sent it, but nothing
  // ever created it. That works today, so Resend evidently creates it on first
  // use, but it left the whole enrolment path resting on undocumented behaviour:
  // on a fresh account the first download is what would have discovered it.
  //
  // No schema is declared on purpose. One would document the payload nicely, but
  // it cannot be verified without sending against the live API, and a schema
  // that rejects a field would break enrolment — which currently works. The only
  // job here is to guarantee the event exists.
  if (!DRY) {
    const { error } = await resend.events.create({ name: TRIGGER_EVENT });
    // 409 is the expected state on any account that has enrolled someone.
    if (error && error.statusCode !== 409) {
      throw new Error(`trigger event ${TRIGGER_EVENT}: ${error.message}`);
    }
    console.log(
      `  trigger event ready: ${TRIGGER_EVENT}${error ? " (already existed)" : ""}`
    );
  }

  // The condition steps read that property, so it has to exist before the
  // automation referencing it does. Safe to re-run: an existing property is
  // treated as success.
  if (SUPPRESS_AFTER_CONVERSION && !DRY) {
    const { error } = await resend.contactProperties.create({
      key: CONVERTED_PROPERTY,
      type: "string",
      fallbackValue: "no",
    });
    // 409 means it already exists, which is the expected state on any re-run.
    // Matched on status rather than message text: the wording here is "There is
    // already a contact property with this key", which an "already exists" check
    // does not catch. Status codes are the contract; the prose is not.
    if (error && error.statusCode !== 409) {
      throw new Error(`contact property ${CONVERTED_PROPERTY}: ${error.message}`);
    }
    console.log(
      `  contact property ready: ${CONVERTED_PROPERTY}${error ? " (already existed)" : ""}\n`
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

  // trigger → delay → check converted → email → delay → check converted → ...
  //
  // The check sits before every send rather than at a few checkpoints because a
  // purchase can land at any point across the 38 days, and the whole purpose of
  // the sequence is to get one. Once it exists, every remaining email is
  // pitching something the reader has already bought, which is the fastest way
  // to turn a customer back into an unsubscribe.
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

    if (SUPPRESS_AFTER_CONVERSION) {
      steps.push({
        key: checkKey,
        type: "condition",
        config: {
          type: "rule",
          field: `contact.${CONVERTED_PROPERTY}`,
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
    if (SUPPRESS_AFTER_CONVERSION) {
      connections.push({ from: delayKey, to: checkKey });
      // Booked: no connection out of condition_met, so the run stops here.
      connections.push({ from: checkKey, to: sendKey, type: "condition_not_met" });
    } else {
      connections.push({ from: delayKey, to: sendKey });
    }
    previous = sendKey;
  });

  const automation = {
    // Dated, because this script creates a new automation on every run rather
    // than editing the live one, and three untitled copies in the dashboard is
    // how you end up enabling the wrong one.
    name: `FootHold AEO nurture (${new Date().toISOString().slice(0, 10)})`,
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
