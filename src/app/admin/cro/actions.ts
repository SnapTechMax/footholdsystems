"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { isAdminAuthorised } from "@/lib/admin-auth";
import {
  DATABASE_CONFIGURED,
  initSchema,
  resetEngine,
  saveSettings,
} from "@/lib/cro/db";
import { RESET_CONFIRMATION } from "@/lib/cro/types";
import type { ResetCounts, Settings } from "@/lib/cro/types";

/**
 * Saves engine settings.
 *
 * These values decide when the site rewrites itself, and the reset below
 * destroys production data outright, so both check the admin password here
 * rather than relying on the proxy.
 *
 * That was the previous arrangement and it was not sound. A Server Action is
 * dispatched by an id in the `Next-Action` header and does not have to arrive as
 * a request to the route it was written for, so `matcher: ["/admin/:path*"]`
 * never was the boundary it appeared to be. Next's own guidance is that an
 * action authorises itself. The proxy still guards the pages; this guards the
 * actions.
 */

/**
 * The browser resends Basic credentials on every same-origin request once the
 * proxy has challenged for them, so the header is present on the action's POST
 * without the form having to carry anything.
 */
async function authorised(): Promise<boolean> {
  return isAdminAuthorised((await headers()).get("authorization"));
}

/** Clamp everything — these bounds are the last line before the engine acts. */
function sanitise(input: Partial<Settings>): Partial<Settings> {
  const out: Partial<Settings> = {};

  if (typeof input.enabled === "boolean") out.enabled = input.enabled;

  if (typeof input.intervalHours === "number" && Number.isFinite(input.intervalHours)) {
    // Clarity permits 10 calls a day, so anything under ~2.4h is unusable.
    out.intervalHours = Math.min(24 * 30, Math.max(3, Math.round(input.intervalHours)));
  }

  if (input.conversionSource === "meta" || input.conversionSource === "internal") {
    out.conversionSource = input.conversionSource;
  }

  if (typeof input.pagePath === "string" && input.pagePath.startsWith("/")) {
    out.pagePath = input.pagePath.slice(0, 200);
  }

  if (typeof input.minImpressionsPerArm === "number" && Number.isFinite(input.minImpressionsPerArm)) {
    // A floor of 100 stops this being set somewhere that guarantees noise.
    out.minImpressionsPerArm = Math.min(
      100_000,
      Math.max(100, Math.round(input.minImpressionsPerArm))
    );
  }

  if (typeof input.significanceLevel === "number" && Number.isFinite(input.significanceLevel)) {
    out.significanceLevel = Math.min(0.2, Math.max(0.01, input.significanceLevel));
  }

  if (typeof input.rollbackDropPct === "number" && Number.isFinite(input.rollbackDropPct)) {
    out.rollbackDropPct = Math.min(90, Math.max(10, Math.round(input.rollbackDropPct)));
  }

  return out;
}

/**
 * Wipe the engine's accumulated state.
 *
 * Behind the same gate as the settings form — it posts back to /admin/cro, which
 * the proxy guards — because this destroys production data with no undo.
 *
 * The typed confirmation is checked here rather than only in the browser. The
 * client check is a speed bump for the operator; this one is the actual
 * condition, since a Server Action is callable without going through the UI.
 */
export async function resetCroEngine(
  confirmation: string,
  options: { clearSettings: boolean }
): Promise<{ ok: true; counts: ResetCounts } | { ok: false; error: string }> {
  // Before anything else, and before the confirmation string — that is a speed
  // bump for the operator, not a credential.
  if (!(await authorised())) {
    return { ok: false, error: "Not authorised." };
  }
  if (!DATABASE_CONFIGURED) {
    return { ok: false, error: "No database configured." };
  }
  if (confirmation !== RESET_CONFIRMATION) {
    return {
      ok: false,
      error: `Type ${RESET_CONFIRMATION} to confirm. Nothing was deleted.`,
    };
  }
  try {
    await initSchema();
    const counts = await resetEngine(options);
    revalidatePath("/admin/cro");
    return { ok: true, counts };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updateSettings(
  patch: Partial<Settings>
): Promise<{ ok: true; settings: Settings } | { ok: false; error: string }> {
  if (!(await authorised())) {
    return { ok: false, error: "Not authorised." };
  }
  if (!DATABASE_CONFIGURED) {
    return { ok: false, error: "No database configured." };
  }
  try {
    await initSchema();
    const settings = await saveSettings(sanitise(patch));
    revalidatePath("/admin/cro");
    return { ok: true, settings };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
