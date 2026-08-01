/**
 * Where consent has to be a free choice.
 *
 * GDPR Article 7(4) treats consent as not freely given when a service is
 * conditional on agreeing to processing that isn't necessary for it. Gating the
 * guide behind the marketing tick is lawful under CAN-SPAM and normal practice
 * in the US; in the EU, UK and the rest of the EEA it produces consent that
 * isn't valid however it's worded.
 *
 * So the tick is required by default and optional for visitors from these
 * countries. They still get the guide either way; they just don't get enrolled
 * unless they choose to be.
 */

/** EU 27, plus the UK, plus the non-EU EEA states, plus Switzerland. */
const CONSENT_MUST_BE_OPTIONAL = new Set([
  // EU 27
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  // UK GDPR
  "GB",
  // EEA beyond the EU
  "IS", "LI", "NO",
  // Not EEA, but its FADP follows GDPR closely enough to treat the same way
  "CH",
]);

/** Vercel sets this at the edge on every request. */
export const GEO_HEADER = "x-vercel-ip-country";

/**
 * Whether the marketing tick may be required for this visitor.
 *
 * Unknown country is treated as required, matching the US default. Getting that
 * wrong in one direction gates the guide for someone it needn't have; in the
 * other it collects consent that isn't valid. The first is a conversion cost,
 * the second is a compliance one.
 */
export function consentMayBeRequired(country: string | null | undefined): boolean {
  if (!country) return true;
  return !CONSENT_MUST_BE_OPTIONAL.has(country.trim().toUpperCase());
}

/** Read the visitor's country from request headers. */
export function countryFromHeaders(headers: Headers): string | null {
  return headers.get(GEO_HEADER)?.trim().toUpperCase() || null;
}

export { CONSENT_MUST_BE_OPTIONAL };
