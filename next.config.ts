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

/**
 * `Vary: Accept`, set at the routing layer rather than on the response.
 *
 * markdown-negotiation-vary wants it on anything negotiated by Accept, and
 * without it a shared cache is free to hand the HTML variant to an agent that
 * asked for markdown — whichever landed in the cache first.
 *
 * It has to be here because everywhere closer to the response is overwritten.
 * lib/agent-response.ts sets it and that works under `next dev`; on Vercel the
 * markdown routes are prerendered and served from the edge cache, which
 * replaces Vary with Next's own rsc value. Setting it from the proxy on
 * NextResponse.next() is discarded too. This layer is the one that demonstrably
 * reaches production — it is how the Link headers below get there.
 *
 * The value stays on the responses in agent-response.ts as well. Two places is
 * usually a smell; here it is the difference between correct behaviour locally
 * and correct behaviour deployed, and they cannot disagree because both say
 * exactly one thing.
 */
const VARY_ACCEPT = { key: "Vary", value: "Accept" };

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
        headers: [{ key: "Link", value: HOME_LINK_HEADER }, VARY_ACCEPT],
      },
      {
        source: "/pricing",
        headers: [
          {
            key: "Link",
            value: `${LINK_HEADER}, </pricing.md>; rel="alternate"; type="text/markdown"`,
          },
          VARY_ACCEPT,
        ],
      },
      {
        // The markdown documents themselves, including the ones the proxy
        // rewrites to — a rewritten request is served from the target's cache
        // entry, so this is the rule that reaches a negotiated "/".
        source: "/:doc(index\\.md|pricing\\.md|llms\\.txt)",
        headers: [VARY_ACCEPT],
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
