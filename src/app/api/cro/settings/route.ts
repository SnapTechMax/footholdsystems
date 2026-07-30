import { NextRequest, NextResponse } from "next/server";
import {
  DATABASE_CONFIGURED,
  DATABASE_HINT,
  getSettings,
  initSchema,
  saveSettings,
} from "@/lib/cro/db";
import type { Settings } from "@/lib/cro/types";

export const dynamic = "force-dynamic";

/** Reject nonsense before it reaches the engine and quietly breaks a run. */
function sanitise(input: Partial<Settings>): Partial<Settings> {
  const out: Partial<Settings> = {};

  if (typeof input.enabled === "boolean") out.enabled = input.enabled;

  if (typeof input.intervalHours === "number" && Number.isFinite(input.intervalHours)) {
    // Clarity allows 10 calls a day, so anything under ~2.4h is unusable anyway.
    out.intervalHours = Math.min(24 * 30, Math.max(3, Math.round(input.intervalHours)));
  }

  if (input.conversionSource === "meta" || input.conversionSource === "internal") {
    out.conversionSource = input.conversionSource;
  }

  if (typeof input.pagePath === "string" && input.pagePath.startsWith("/")) {
    out.pagePath = input.pagePath.slice(0, 200);
  }

  if (typeof input.minImpressionsPerArm === "number") {
    // A floor of 100 stops the UI being set somewhere that guarantees noise.
    out.minImpressionsPerArm = Math.min(
      100_000,
      Math.max(100, Math.round(input.minImpressionsPerArm))
    );
  }

  if (typeof input.significanceLevel === "number") {
    out.significanceLevel = Math.min(0.2, Math.max(0.01, input.significanceLevel));
  }

  if (typeof input.rollbackDropPct === "number") {
    out.rollbackDropPct = Math.min(90, Math.max(10, Math.round(input.rollbackDropPct)));
  }

  return out;
}

export async function GET() {
  if (!DATABASE_CONFIGURED) {
    return NextResponse.json({ ok: false, error: DATABASE_HINT }, { status: 503 });
  }
  await initSchema();
  return NextResponse.json({ ok: true, settings: await getSettings() });
}

export async function POST(request: NextRequest) {
  if (!DATABASE_CONFIGURED) {
    return NextResponse.json({ ok: false, error: DATABASE_HINT }, { status: 503 });
  }
  try {
    await initSchema();
    const body = (await request.json()) as Partial<Settings>;
    const settings = await saveSettings(sanitise(body));
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
