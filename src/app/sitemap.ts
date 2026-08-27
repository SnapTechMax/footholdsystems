import type { MetadataRoute } from "next";

/**
 * sitemap.xml.
 *
 * Four public pages: the sales page, the privacy policy it is legally required
 * to carry, and the pricing and contact pages added after the 2026-08-27
 * agent-readiness scan — pricing because an assistant asked what this costs
 * needs somewhere to read it from, contact because it is one of the three
 * trust-anchor pages a model fetches to decide a business is real.
 *
 * Listed by hand rather than derived — there is no content collection to walk,
 * and a generated sitemap over four pages would be indirection standing in for
 * a list.
 *
 * `/admin` is deliberately absent. A sitemap is a request to index, and it
 * should not be.
 *
 * The host is www, matching `metadataBase` in the layout and the canonical tags.
 * The apex 308s to it, and a sitemap that lists the redirecting host asks every
 * crawler to spend a hop it need not.
 */
const BASE = "https://www.footholdsystems.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      // The sales page, and the only page worth ranking. Worth ranking in the
      // ordinary sense and also in the sense this whole business is about:
      // it is the page a model reads to decide what FootHold AEO is.
      url: `${BASE}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      // Reference, not a second funnel entrance — see the page's own note. Ranked
      // above privacy because "how much does it cost" is a question people and
      // models both actually ask.
      url: `${BASE}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE}/contact`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${BASE}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
