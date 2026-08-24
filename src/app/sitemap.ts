import type { MetadataRoute } from "next";

/**
 * sitemap.xml.
 *
 * Two public pages now that the site is a single sales page plus the privacy
 * policy it is legally required to carry. Listed by hand rather than derived —
 * there is no content collection to walk, and a generated sitemap over a
 * two-page site would be indirection standing in for a list.
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
      url: `${BASE}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
