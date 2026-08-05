"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { isAdminAuthorised } from "@/lib/admin-auth";
import { refreshCampaignSnapshot } from "@/lib/campaign";
import { TRACKING_CONFIGURED, resetEmailClicks } from "@/lib/tracking";
import { CLICK_RESET_CONFIRMATION } from "./constants";

/**
 * Clears recorded clicks on the sequence's booking links.
 *
 * Authorised here rather than by the proxy. A Server Action is dispatched by an
 * id in the `Next-Action` header and does not have to arrive as a request to the
 * route it belongs to, so a matcher on `/admin` is not the boundary it looks
 * like — and this one deletes production rows.
 *
 * The typed confirmation is checked on the server too. In the browser it is a
 * speed bump for the operator; here it is the condition.
 */

export async function resetClickTracking(
  confirmation: string
): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  if (!isAdminAuthorised((await headers()).get("authorization"))) {
    return { ok: false, error: "Not authorised." };
  }
  if (!TRACKING_CONFIGURED) {
    return { ok: false, error: "No database configured." };
  }
  if (confirmation.trim().toUpperCase() !== CLICK_RESET_CONFIRMATION) {
    return {
      ok: false,
      error: `Type ${CLICK_RESET_CONFIRMATION} to confirm. Nothing was deleted.`,
    };
  }

  try {
    const removed = await resetEmailClicks();
    // No snapshot to invalidate: the stored snapshot holds sequence progress
    // from Resend, and clicks are read live from email_clicks on every load.
    // Revalidating the path is enough to show the reset immediately.
    revalidatePath("/admin/campaign");
    return { ok: true, removed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Recompute the stored snapshot on demand.
 *
 * The dashboard reads a snapshot refreshed on a schedule, so this is how you get
 * current figures without waiting for the next cron run. It is the slow path —
 * roughly 53 Resend requests — which is exactly why it is a button rather than
 * something every page load does.
 */
export async function refreshCampaignSnapshotAction(): Promise<
  { ok: true; fetchedAt: string } | { ok: false; error: string }
> {
  if (!isAdminAuthorised((await headers()).get("authorization"))) {
    return { ok: false, error: "Not authorised." };
  }

  try {
    const stats = await refreshCampaignSnapshot();
    revalidatePath("/admin/campaign");
    revalidatePath("/admin");
    return { ok: true, fetchedAt: stats.fetchedAt };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
