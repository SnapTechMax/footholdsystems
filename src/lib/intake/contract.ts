import { siteUrl } from "@/lib/scan/pricing";

/**
 * Where a customer signs.
 *
 * The agreement itself is not in this repository — it is drafted and hosted
 * separately, and whether it ends up as a DocuSign envelope, a PDF, or a page
 * on this site is not something the intake form should have an opinion about.
 * So it is one environment variable, read in one place.
 *
 * The agreement is signed BEFORE the intake form, so it is sent to the
 * customer by hand and the only surface that shows it is /admin/intake, for
 * reference. Nothing customer-facing depends on it.
 *
 * FAILS SOFT. With BUILD_CONTRACT_URL unset or malformed this returns null and
 * the admin page says so, rather than rendering a link to nowhere.
 */

export function contractUrl(): string | null {
  const raw = process.env.BUILD_CONTRACT_URL?.trim();
  if (!raw) return null;

  // A path is allowed, so the agreement can live on this site without anyone
  // having to remember to write the origin in front of it.
  if (raw.startsWith("/")) return `${siteUrl()}${raw}`;

  // Anything else has to be a real absolute URL over http(s). A misconfigured
  // value that is not one would render as a link to nowhere, which is the exact
  // failure this whole file exists to avoid.
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
