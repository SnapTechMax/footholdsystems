/**
 * Turns on click and open tracking for footholdsystems.com and points them at a
 * custom tracking subdomain.
 *
 *   RESEND_API_KEY=re_xxx node scripts/configure-tracking.mjs            # show
 *   RESEND_API_KEY=re_xxx node scripts/configure-tracking.mjs --apply    # set
 *   RESEND_API_KEY=re_xxx node scripts/configure-tracking.mjs --verify   # check
 *
 * Read-only by default. `--apply` is the only mode that writes, and it prints
 * the DNS record to add afterwards; `--verify` asks Resend to re-check DNS and
 * reports whether the tracking record has gone green.
 *
 * Why a custom subdomain rather than Resend's shared one: click tracking works
 * by rewriting every link in the message to point at the ESP, so without this
 * the reader hovers a link in a mail from max@footholdsystems.com and sees a
 * resend.com URL. That mismatch is a phishing shape, it is scored as one, and it
 * is the whole deliverability cost of click tracking. Pointing the rewrite at
 * track.footholdsystems.com keeps the registrable domain the same as the From
 * address and under the same DMARC policy, so the link stops looking borrowed.
 *
 * One warning worth reading before --apply: Resend's docs are explicit that a
 * tracking subdomain, once set, can be *changed* but never removed. Picking one
 * is close to permanent, so it is passed as a constant here rather than a flag.
 */

import { Resend } from "resend";

const DOMAIN = process.env.TRACKING_DOMAIN || "footholdsystems.com";
const SUBDOMAIN = process.env.TRACKING_SUBDOMAIN || "track";

const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");

if (!process.env.RESEND_API_KEY) {
  console.error("RESEND_API_KEY is not set.");
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);

function unwrap(label, { data, error }) {
  if (error) throw new Error(`${label}: ${error.message ?? JSON.stringify(error)}`);
  return data;
}

/** Resend's DNS table, printed as one. */
function printRecords(records) {
  const tracking = records.filter((r) => r.record === "Tracking");
  if (tracking.length === 0) {
    console.log(
      "\n  No Tracking record returned yet. Resend adds it once a tracking\n" +
        "  subdomain is set — re-run with --apply first.\n"
    );
    return;
  }

  console.log("\n  DNS record to add:\n");
  for (const r of tracking) {
    // Resend returns the name as a FQDN. Cloudflare — and most registrars —
    // append the zone to whatever is typed in the name field, so pasting the
    // FQDN there silently creates track.footholdsystems.com.footholdsystems.com,
    // which resolves for nobody and looks correct in the dashboard. Both forms
    // are printed rather than guessing which one the provider wants.
    const host = r.name.endsWith(`.${DOMAIN}`)
      ? r.name.slice(0, -(DOMAIN.length + 1))
      : r.name;

    console.log(`    Type    ${r.type}`);
    console.log(`    Name    ${host}          <- Cloudflare, most registrars`);
    console.log(`            ${r.name}   <- providers wanting the full name`);
    console.log(`    Value   ${r.value}`);
    console.log(`    TTL     ${r.ttl ?? "Auto"}`);
    console.log(`    Proxy   DNS only (grey cloud) — see below`);
    console.log(`    Status  ${r.status}`);
    if (r.priority != null) console.log(`    Priority ${r.priority}`);
    console.log("");
  }

  console.log(
    "  On Cloudflare the record must be DNS only, not proxied. An orange-cloud\n" +
      "  record answers with Cloudflare's own IPs, so Resend cannot complete the\n" +
      "  domain-control check for the TLS certificate and the subdomain never\n" +
      "  verifies — with a CNAME that reads as perfectly correct.\n"
  );

  if (tracking.length > 1) {
    console.log(
      "  Two Tracking records means the subdomain was changed at some point.\n" +
        "  The previous one stays live until the new one verifies, so add the\n" +
        "  record whose status is not yet verified and leave the other alone\n" +
        "  until it is.\n"
    );
  }

  // Not something Resend's docs call out, but a tracking subdomain needs a TLS
  // certificate, and CAA is the standard way to accidentally forbid one. Only
  // reported if Resend actually returns such records.
  const caa = records.filter((r) => r.type === "CAA");
  if (caa.length > 0) {
    console.log("  CAA records are present on this domain. A certificate has to be");
    console.log("  issued for the tracking subdomain, so these must permit the CA:\n");
    for (const r of caa) {
      console.log(`    ${r.type}  ${r.name}  ${r.value}`);
    }
    console.log("");
  }
}

function printState(domain) {
  console.log(`\n  ${domain.name}  (${domain.id})`);
  console.log(`    domain status       ${domain.status}`);
  console.log(`    click_tracking      ${domain.click_tracking}`);
  console.log(`    open_tracking       ${domain.open_tracking}`);
  console.log(`    tracking_subdomain  ${domain.tracking_subdomain ?? "(none)"}`);
}

async function main() {
  const list = unwrap("list domains", await resend.domains.list());
  const domain = (list?.data ?? []).find((d) => d.name === DOMAIN);

  if (!domain) {
    const names = (list?.data ?? []).map((d) => d.name).join(", ") || "none";
    throw new Error(`${DOMAIN} is not on this account. Domains found: ${names}`);
  }

  let current = unwrap("get domain", await resend.domains.get(domain.id));
  printState(current);

  if (APPLY) {
    // Sent in one PATCH. The docs note that click and open tracking each require
    // a configured tracking subdomain, so setting them in separate calls risks
    // the flags being rejected before the subdomain they depend on exists.
    unwrap(
      "update domain",
      await resend.domains.update({
        id: domain.id,
        clickTracking: true,
        openTracking: true,
        trackingSubdomain: SUBDOMAIN,
      })
    );
    console.log(
      `\n  Applied: click_tracking=true, open_tracking=true, ` +
        `tracking_subdomain=${SUBDOMAIN}`
    );

    // update() returns only { object, id }, so the records come from a re-read.
    current = unwrap("get domain", await resend.domains.get(domain.id));
    printState(current);
  }

  if (VERIFY) {
    unwrap("verify domain", await resend.domains.verify(domain.id));
    console.log("\n  Verification requested. Re-reading...");
    // DNS has to have propagated for this to say anything useful; a check run
    // seconds after the record was added will report not_started and that is
    // not a failure, just an early look.
    await new Promise((r) => setTimeout(r, 3000));
    current = unwrap("get domain", await resend.domains.get(domain.id));
    printState(current);
  }

  printRecords(current.records ?? []);

  const tracking = (current.records ?? []).filter((r) => r.record === "Tracking");
  const live = tracking.some((r) => r.status === "verified");

  if (live) {
    console.log(`  ${SUBDOMAIN}.${DOMAIN} is verified. Tracked links use it now.\n`);
  } else if (tracking.length > 0) {
    console.log(
      `  ${SUBDOMAIN}.${DOMAIN} is not verified yet. Add the CNAME above, wait\n` +
        "  for it to propagate, then re-run with --verify.\n"
    );
  }

  if (!APPLY && !VERIFY) {
    console.log("  Read-only. Re-run with --apply to change anything.\n");
  }
}

main().catch((error) => {
  console.error(`\n${error.message}\n`);
  process.exit(1);
});
