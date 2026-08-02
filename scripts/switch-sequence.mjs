/**
 * Replace the live nurture automation with a rebuilt one.
 *
 *   RESEND_API_KEY=re_xxx node scripts/switch-sequence.mjs            # inspect only
 *   RESEND_API_KEY=re_xxx node scripts/switch-sequence.mjs --confirm  # actually switch
 *
 * Resend will not let an enabled automation's steps be edited, so changing the
 * emails means building a second automation and cutting across. This does that
 * in one pass:
 *
 *   1. Finds the live automation and reads back every subject and delay.
 *   2. Compares them to what this repo would now generate, and prints the
 *      difference. **This is the point of the script.** The rebuild is meant to
 *      change the booking links and nothing else a reader would notice, so
 *      anything else showing up here is a mistake worth stopping for.
 *   3. Builds the replacement (22 templates plus the automation, disabled).
 *   4. Enables the new one, then disables the old one, in that order.
 *
 * Without --confirm it stops after step 2, having created nothing.
 *
 * Enable before disable is deliberate. Between the two calls both are briefly
 * live, which for an event-triggered automation means at worst one person
 * enrolling in both. The other order leaves a window where a download enrols
 * nobody, and a lead who silently receives nothing is worse than a lead who
 * receives one email twice.
 */

import { Resend } from "resend";
import { SEQUENCE } from "../content/nurture-sequence.mjs";
import { createSequence } from "./create-email-sequence.mjs";

const CONFIRM = process.argv.includes("--confirm");

if (!process.env.RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not set.");
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

function unwrap(label, { data, error }) {
  if (error) throw new Error(`${label}: ${error.message ?? JSON.stringify(error)}`);
  return data;
}

/** Subjects and delays as a reader would experience them, in order. */
function readerView(steps = []) {
  const out = [];
  for (const step of steps) {
    if (step.type === "send_email") {
      out.push({ kind: "email", subject: step.config?.subject ?? "(none)" });
    } else if (step.type === "delay") {
      out.push({ kind: "delay", duration: step.config?.duration ?? "(none)" });
    }
  }
  return out;
}

function describe(entry) {
  return entry.kind === "email" ? `email: ${entry.subject}` : `wait ${entry.duration}`;
}

async function main() {
  /* ── 1. what is live ─────────────────────────────────────────────────── */
  const list = unwrap("list automations", await resend.automations.list());
  const automations = list?.data ?? list ?? [];
  const live = automations.filter((a) => a.status === "enabled");

  console.log(`\n${automations.length} automation(s) in this account:`);
  for (const a of automations) {
    const flag = a.status === "enabled" ? " <- live" : "";
    console.log(`  ${a.id}  ${String(a.status).padEnd(9)} ${a.name}${flag}`);
  }

  if (live.length === 0) {
    console.log("\nNothing is enabled, so there is nothing to replace.");
    console.log("Run scripts/create-email-sequence.mjs and start it in the dashboard.\n");
    return;
  }
  if (live.length > 1) {
    throw new Error(
      `${live.length} automations are enabled at once. Sort that out in the dashboard first — ` +
        "this script will not guess which one to retire."
    );
  }

  const current = live[0];
  const detail = unwrap("get automation", await resend.automations.get(current.id));

  /* ── 2. compare it to what this repo would send now ──────────────────── */
  const before = readerView(detail.steps);
  const after = [];
  for (const email of SEQUENCE) {
    after.push({ kind: "delay", duration: email.delay });
    after.push({ kind: "email", subject: email.subject });
  }

  console.log(`\nComparing "${current.name}" (${current.id}) to this repo:\n`);

  const length = Math.max(before.length, after.length);
  let differences = 0;
  for (let i = 0; i < length; i++) {
    const a = before[i];
    const b = after[i];
    const left = a ? describe(a) : "(nothing)";
    const right = b ? describe(b) : "(nothing)";
    if (left !== right) {
      differences += 1;
      console.log(`  ${String(i + 1).padStart(3)}.  live: ${left}`);
      console.log(`        new:  ${right}`);
    }
  }

  if (differences === 0) {
    console.log("  No difference in subjects or delays — identical to a reader.");
    console.log("  Only the booking links change, which is the intent.\n");
  } else {
    console.log(
      `\n  ${differences} difference(s) above. Body copy is not compared, only ` +
        "subjects and cadence.\n"
    );
  }

  if (!CONFIRM) {
    console.log("Inspection only. Nothing was created or changed.");
    console.log("Re-run with --confirm to build the replacement and switch over.\n");
    return;
  }

  /* ── 3. build the replacement ────────────────────────────────────────── */
  console.log("Building the replacement...\n");
  const newId = await createSequence();
  if (!newId) throw new Error("the build did not return an automation id");

  /* ── 4. cut across ───────────────────────────────────────────────────── */
  console.log("Switching over...");
  unwrap("enable new", await resend.automations.update({ id: newId, status: "enabled" }));
  console.log(`  enabled  ${newId}`);
  unwrap(
    "disable old",
    await resend.automations.update({ id: current.id, status: "disabled" })
  );
  console.log(`  disabled ${current.id}`);

  console.log(`\nDone. Set RESEND_AUTOMATION_ID to ${newId} in Vercel and redeploy,`);
  console.log("or the campaign dashboard keeps reporting on the retired one.\n");
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}\n`);
  process.exit(1);
});
