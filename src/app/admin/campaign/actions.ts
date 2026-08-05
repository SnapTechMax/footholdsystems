"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { isAdminAuthorised } from "@/lib/admin-auth";
import { invalidateCampaignStats } from "@/lib/campaign";
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
    // The snapshot is held for a minute, so without this the page would show the
    // old counts straight after a reset and look as though nothing happened.
    invalidateCampaignStats();
    revalidatePath("/admin/campaign");
    return { ok: true, removed };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
