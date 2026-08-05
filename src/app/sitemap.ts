import type { MetadataRoute } from "next";

/**
 * sitemap.xml, which was returning a 404 alongside robots.txt.
 *
 * Three public pages, listed by hand rather than derived. There is no content
 * collection to walk, and a generated sitemap over a four-page site would be
 * indirection standing in for a list.
 *
 * `/guide/thanks` and `/admin` are deliberately absent — a sitemap is a request
 * to index, and neither should be.
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
      url: `${BASE}/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      // The page paid traffic lands on, and the one worth ranking.
      url: `${BASE}/guide`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
