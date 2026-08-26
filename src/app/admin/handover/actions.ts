"use server";

import { headers } from "next/headers";
import { isAdminAuthorised } from "@/lib/admin-auth";
import {
  clearHandover,
  findLatestScanForDomain,
  getScanByToken,
  initScanSchema,
  isPaid,
  setHandover,
} from "@/lib/scan/db";
import { normaliseDomain } from "@/lib/scan/ora";
import { siteUrl } from "@/lib/scan/pricing";

/**
 * Publishes the handover page for a finished build.
 *
 * Authorised here rather than by the proxy. A Server Action is dispatched by an
 * id in the `Next-Action` header and does not have to arrive as a request to
 * the route it belongs to, so a matcher on `/admin` is not the boundary it
 * looks like. This one publishes a customer-facing page and offers the
 * retainer, so it checks the password itself.
 */

export type HandoverResult =
  | { ok: true; url: string; domain: string; warning?: string }
  | { ok: false; error: string };

export async function publishHandover(input: {
  lookup: string;
  secondDomain: string;
  notes: string;
  deliveredAt: string;
}): Promise<HandoverResult> {
  if (!isAdminAuthorised((await headers()).get("authorization"))) {
    return { ok: false, error: "Not authorised." };
  }

  const lookup = input.lookup.trim();
  if (!lookup) return { ok: false, error: "Enter a scan token or a domain." };

  const secondDomain = normaliseDomain(input.secondDomain);
  if (!secondDomain) {
    return {
      ok: false,
      error: `Could not read "${input.secondDomain}" as a domain. This is the machine readable site you built them.`,
    };
  }

  const notes = input.notes.trim();
  if (notes.length < 20) {
    return {
      ok: false,
      error: "Write what changed. The customer reads this, so a line or two at minimum.",
    };
  }

  const deliveredAt = input.deliveredAt.trim() || new Date().toISOString();
  if (Number.isNaN(new Date(deliveredAt).getTime())) {
    return { ok: false, error: "Delivered date is not a date." };
  }

  await initScanSchema();

  // A token is unambiguous; a domain gets the most recent completed scan for
  // it, which is what an admin means when they type one.
  const scan = lookup.includes(".")
    ? await findLatestScanForDomain(normaliseDomain(lookup) ?? lookup)
    : await getScanByToken(lookup);

  if (!scan) {
    return { ok: false, error: "No completed scan found for that token or domain." };
  }

  await setHandover(scan.id, { secondDomain, notes, deliveredAt });

  // Not a blocker, deliberately. The page is a thank-you for work that is
  // finished, and whether the payment went through Whop or was invoiced some
  // other way is not this page's business. But publishing a handover for
  // somebody with no build on record is worth saying out loud.
  const paid = await isPaid(scan.id, "done_for_you").catch(() => false);

  return {
    ok: true,
    domain: scan.domain,
    url: `${siteUrl()}/scan/${scan.token}/complete`,
    ...(paid
      ? {}
      : {
          warning:
            "This scan has no paid build on record. The page is published anyway, but check you have the right customer.",
        }),
  };
}

/** Takes the page back down. The URL 404s again. */
export async function unpublishHandover(
  lookup: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isAdminAuthorised((await headers()).get("authorization"))) {
    return { ok: false, error: "Not authorised." };
  }
  const trimmed = lookup.trim();
  if (!trimmed) return { ok: false, error: "Enter a scan token or a domain." };

  await initScanSchema();
  const scan = trimmed.includes(".")
    ? await findLatestScanForDomain(normaliseDomain(trimmed) ?? trimmed)
    : await getScanByToken(trimmed);

  if (!scan) return { ok: false, error: "No scan found for that token or domain." };

  await clearHandover(scan.id);
  return { ok: true };
}
