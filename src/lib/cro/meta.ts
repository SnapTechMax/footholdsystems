import type { ExperimentTotals, VariantKey } from "./types";

/**
 * Meta (Facebook) Pixel conversion counts, per variant.
 *
 * Reads `Lead` events back through the Graph API's ads-pixel stats endpoint,
 * aggregated by a `variant` custom-data field.
 *
 * NOTHING CURRENTLY SENDS THAT FIELD. The component that did was the guide
 * lead-magnet form, retired along with /guide, and the scan form — the only
 * live lead capture — is not part of an experiment. So this returns figures for
 * historical experiments and nothing for new ones until a public page assigns
 * variants again.
 *
 * Two things to keep in mind when reading these numbers:
 *
 *  1. They undercount. Ad blockers and browser tracking prevention stop the
 *     pixel firing for a meaningful share of visitors — commonly 15-30%, and
 *     not necessarily evenly across variants. Server-side counts recorded in
 *     cro_events see every submission and are kept alongside as a cross-check.
 *  2. They lag. Meta's aggregation is not immediate, so a conversion that just
 *     happened may not appear for a while.
 *
 * Requires META_ACCESS_TOKEN (a token with `ads_read` on the pixel's Business
 * Manager) and META_PIXEL_ID.
 */

const GRAPH_VERSION = "v21.0";

export const META_CONFIGURED = () =>
  Boolean(process.env.META_ACCESS_TOKEN && process.env.META_PIXEL_ID);

export class MetaError extends Error {}

interface PixelStatsRow {
  value?: string;
  count?: number;
  aggregation?: string;
  data?: { value?: string; count?: number }[];
}

/**
 * Conversions per variant over a window, keyed by the `variant` custom field.
 * Returns null when Meta isn't configured, so callers can fall back cleanly.
 */
export async function fetchMetaConversions(
  sinceUnix: number,
  eventName = "Lead"
): Promise<Record<VariantKey, number> | null> {
  const token = process.env.META_ACCESS_TOKEN;
  const pixelId = process.env.META_PIXEL_ID;
  if (!token || !pixelId) return null;

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/stats`);
  url.searchParams.set("aggregation", "custom_data_field");
  url.searchParams.set("event", eventName);
  url.searchParams.set("start_time", String(sinceUnix));
  url.searchParams.set("access_token", token);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new MetaError(`Meta pixel stats returned ${response.status}: ${detail}`);
  }

  const body = (await response.json()) as { data?: PixelStatsRow[] };
  const counts: Record<VariantKey, number> = { a: 0, b: 0 };

  // The payload nests differently depending on the aggregation, so walk both
  // shapes rather than assuming one.
  const visit = (rows: PixelStatsRow[] | undefined) => {
    for (const row of rows ?? []) {
      const label = String(row.value ?? "").toLowerCase();
      const count = Number(row.count ?? 0);
      if (label === "a" || label.endsWith(":a")) counts.a += count;
      if (label === "b" || label.endsWith(":b")) counts.b += count;
      visit(row.data);
    }
  };
  visit(body.data);

  return counts;
}

/**
 * Merge Meta's conversion counts over our own impression counts.
 *
 * Impressions always come from our own records: the pixel has no reliable
 * notion of "saw this variant", and mixing a blocked-pixel numerator with a
 * server-side denominator would understate the rate rather than break it.
 */
export function withMetaConversions(
  internal: ExperimentTotals,
  metaConversions: Record<VariantKey, number>
): ExperimentTotals {
  return {
    a: { impressions: internal.a.impressions, conversions: metaConversions.a },
    b: { impressions: internal.b.impressions, conversions: metaConversions.b },
  };
}
