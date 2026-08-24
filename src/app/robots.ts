import type { MetadataRoute } from "next";

/**
 * robots.txt.
 *
 * Not decoration for an ad-funded site, and on this one it is slightly more
 * than housekeeping: the whole pitch is that AI crawlers should be able to read
 * and quote you, so the site had better be readable itself. Everything public
 * is allowed, deliberately, including to the assistant crawlers.
 *
 * Only the two things that are not pages are disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Password-gated, and the 401 alone is not a reason to invite crawling.
        "/admin",
        // Redirect endpoints, not pages. Crawling these would write click rows
        // for visits nobody made.
        "/api/",
      ],
    },
    sitemap: "https://www.footholdsystems.com/sitemap.xml",
    host: "https://www.footholdsystems.com",
  };
}
