import type { MetadataRoute } from "next";

/**
 * robots.txt, which was returning a 404.
 *
 * Not decoration for an ad-funded site. A missing robots.txt is not fatal — a
 * crawler that gets a 404 assumes everything is allowed — but it means the two
 * routes that should never be indexed are relying on nothing but a meta tag, and
 * `/admin` does not carry one.
 *
 * `/guide/thanks` already sets `robots: { index: false }` in its metadata. It is
 * repeated here because the two mechanisms fail differently: the meta tag is only
 * seen by a crawler that fetches the page, which is exactly what should not be
 * happening to a page that sits behind a conversion.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Password-gated, and the 401 alone is not a reason to invite crawling.
        "/admin",
        // Funnel-internal. Indexing it puts a thank-you page in search results
        // for people who never downloaded anything.
        "/guide/thanks",
        // Redirect endpoints, not pages. Crawling these would write click rows
        // for visits nobody made.
        "/api/",
      ],
    },
    sitemap: "https://www.footholdsystems.com/sitemap.xml",
    host: "https://www.footholdsystems.com",
  };
}
