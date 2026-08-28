import { siteUrl } from "@/lib/scan/pricing";

/**
 * Where a customer signs.
 *
 * The agreement itself is not in this repository — it is drafted and hosted
 * separately, and whether it ends up as a DocuSign envelope, a PDF, or a page
 * on this site is not something the intake form should have an opinion about.
 * So it is one environment variable, read in one place, and the two surfaces
 * that show it (the thank-you page and the confirmation email) both go through
 * here.
 *
 * FAILS SOFT, LOUDLY. With BUILD_CONTRACT_URL unset the customer is told the
 * agreement follows by email rather than shown a dead link, and the admin
 * notification says the variable is missing so somebody knows to send it by
 * hand. A broken link on the page where a $1,497 customer is trying to sign is
 * worse than an honest sentence saying it is coming.
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
