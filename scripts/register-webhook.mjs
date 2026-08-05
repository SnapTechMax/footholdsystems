/**
 * Subscribes the Resend webhook to the events /api/resend/webhook now handles.
 *
 *   RESEND_API_KEY=re_xxx node scripts/register-webhook.mjs           # show
 *   RESEND_API_KEY=re_xxx node scripts/register-webhook.mjs --apply   # set
 *
 * Read-only by default.
 *
 * This **updates the existing webhook rather than creating a second one**, which
 * is the whole reason it is a script instead of a line in the docs. A webhook is
 * already registered — RESEND_WEBHOOK_SECRET has been verifying delivery events
 * for a while — and adding a new one pointed at the same endpoint would mean two
 * subscriptions both sending `email.delivered`.
 *
 * That would not be caught downstream. `email_events` deduplicates on the Svix
 * message id, and two webhooks generate two different ids for the same event, so
 * every delivery, bounce and complaint would quietly count twice while looking
 * completely normal.
 *
 * Updating in place also keeps the signing secret, so RESEND_WEBHOOK_SECRET does
 * not change and nothing needs redeploying for it.
 */

import { Resend } from "resend";

const ENDPOINT =
  process.env.WEBHOOK_ENDPOINT ||
  "https://www.footholdsystems.com/api/resend/webhook";

// Exactly what the route handles. Anything else is answered with a 200 and
// ignored, so subscribing to more would only add traffic.
const WANTED = [
  "email.clicked",
  "email.opened",
  "email.delivered",
  "email.bounced",
  "email.complained",
];

const APPLY = process.argv.includes("--apply");

if (!process.env.RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not set.");
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

function unwrap(label, { data, error }) {
  if (error) throw new Error(`${label}: ${error.message ?? JSON.stringify(error)}`);
  return data;
}

/** Compare ignoring order, so a reordered list is not read as a difference. */
function sameEvents(a, b) {
  const x = [...(a ?? [])].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

async function main() {
  const list = unwrap("list webhooks", await resend.webhooks.list());
  const all = list?.data ?? [];

  // Matched on the endpoint, normalising the trailing slash so the same URL
  // written two ways is not treated as two endpoints.
  const norm = (u) => (u ?? "").replace(/\/+$/, "");
  const existing = all.filter((w) => norm(w.endpoint) === norm(ENDPOINT));

  console.log(`\n  ${all.length} webhook(s) on this account.`);
  for (const w of all) {
    const mine = norm(w.endpoint) === norm(ENDPOINT) ? " <- this endpoint" : "";
    console.log(`\n    ${w.endpoint}${mine}`);
    console.log(`      id      ${w.id}`);
    console.log(`      status  ${w.status}`);
    console.log(`      events  ${(w.events ?? []).join(", ") || "(none)"}`);
  }

  if (existing.length > 1) {
    console.log(
      `\n  ${existing.length} webhooks already point at this endpoint. That is the\n` +
        "  duplicate-counting case described at the top of this file — every\n" +
        "  delivery event is being recorded once per subscription. Remove all but\n" +
        "  one in the Resend dashboard, then re-run.\n"
    );
    process.exit(1);
  }

  const current = existing[0];

  if (current && sameEvents(current.events, WANTED)) {
    console.log(`\n  Already subscribed to all ${WANTED.length} events. Nothing to do.\n`);
    if (current.status !== "enabled") {
      console.log(`  Note: status is "${current.status}", so nothing is being delivered.\n`);
    }
    return;
  }

  if (!APPLY) {
    console.log("\n  Would " + (current ? "update" : "create") + ":");
    console.log(`    endpoint  ${ENDPOINT}`);
    console.log(`    events    ${WANTED.join(", ")}`);
    if (current) {
      const added = WANTED.filter((e) => !(current.events ?? []).includes(e));
      const removed = (current.events ?? []).filter((e) => !WANTED.includes(e));
      if (added.length) console.log(`    adding    ${added.join(", ")}`);
      if (removed.length) console.log(`    removing  ${removed.join(", ")}`);
    }
    console.log("\n  Read-only. Re-run with --apply to change it.\n");
    return;
  }

  if (current) {
    unwrap(
      "update webhook",
      await resend.webhooks.update(current.id, { events: WANTED, status: "enabled" })
    );
    console.log(
      `\n  Updated ${current.id}. Signing secret is unchanged, so\n` +
        "  RESEND_WEBHOOK_SECRET stays as it is and no redeploy is needed.\n"
    );
    return;
  }

  const created = unwrap(
    "create webhook",
    await resend.webhooks.create({ endpoint: ENDPOINT, events: WANTED })
  );
  console.log(`\n  Created ${created.id}.`);
  console.log(
    "\n  Set this as RESEND_WEBHOOK_SECRET in Vercel, then redeploy. Until it is\n" +
      "  set the endpoint returns 503 and rejects every event:\n"
  );
  console.log(`    ${created.signing_secret}\n`);
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
