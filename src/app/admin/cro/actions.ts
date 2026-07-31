"use server";

import { revalidatePath } from "next/cache";
import { DATABASE_CONFIGURED, initSchema, saveSettings } from "@/lib/cro/db";
import type { Settings } from "@/lib/cro/types";

/**
 * Saves engine settings.
 *
 * A Server Action rather than a public API route: it posts back to
 * /admin/cro, which the proxy already guards, so there is no second endpoint to
 * secure. These values decide when the site rewrites itself, so they must not be
 * writable by anyone who finds the URL.
 */

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

export async function updateSettings(
  patch: Partial<Settings>
): Promise<{ ok: true; settings: Settings } | { ok: false; error: string }> {
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
