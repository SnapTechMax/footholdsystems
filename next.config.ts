import type { NextConfig } from "next";

// Every filename the guide has ever been published under. The delivery email and
// the nurture sequence print the link as raw text, so a copy of every old name is
// sitting in somebody's inbox for good. They all land on the current file.
const RETIRED_GUIDE_PATHS = [
  "/downloads/foothold-5-levels-of-ai.pdf",
  "/downloads/Foothold-The-Five-Levels-of-AI-for-Small-Business.pdf",
];

const CURRENT_GUIDE_PATH =
  "/downloads/Foothold-The-5-Levels-of-AI-and-The-Prompts.pdf";

/**
 * RFC 8288 Link headers, advertising the machine-readable surfaces.
 *
 * The 2026-08-27 agent-readiness scan found none at all (link-headers-discovery,
 * 0/1). They matter for the client that never parses the HTML: a HEAD request,
 * or an agent that reads response headers before deciding whether the body is
 * worth downloading. Everything advertised here resolves — a Link header
 * pointing at a 404 is worse than a missing one, because it is a promise.
 */
const LINK_HEADER = [
  '</sitemap.xml>; rel="sitemap"',
  '</llms.txt>; rel="describedby"; type="text/plain"',
  '</.well-known/ard.json>; rel="service-desc"; type="application/json"',
  '</.well-known/agent-card.json>; rel="service-meta"; type="application/json"',
].join(", ");

/** The homepage adds its markdown twin. /pricing gets its own below. */
const HOME_LINK_HEADER = `${LINK_HEADER}, </index.md>; rel="alternate"; type="text/markdown"`;

const nextConfig: NextConfig = {
  async redirects() {
    return RETIRED_GUIDE_PATHS.map((source) => ({
      source,
      destination: CURRENT_GUIDE_PATH,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/",
        headers: [
          { key: "Link", value: HOME_LINK_HEADER },
        ],
      },
      {
        source: "/pricing",
        headers: [
          {
            key: "Link",
            value: `${LINK_HEADER}, </pricing.md>; rel="alternate"; type="text/markdown"`,
          },
        ],
      },
      {
        // Everything else public. No markdown alternate, because most pages do
        // not have one and advertising a twin that does not exist is the
        // failure this whole block is trying not to be.
        //
        // `.+` and not `.*`, and `pricing` excluded, because every matching rule
        // is applied and the last one to set a key wins — with `.*` this rule
        // also matched "/" and quietly stripped the markdown alternate off the
        // two pages that actually have one.
        source: "/:path((?!api/|_next/|pricing$).+)",
        headers: [{ key: "Link", value: LINK_HEADER }],
      },
    ];
  },
};

export default nextConfig;
