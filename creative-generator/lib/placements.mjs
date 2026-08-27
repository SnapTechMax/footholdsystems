/**
 * Every Facebook / Meta placement that accepts a static image ad, grouped by
 * the canvas that serves it.
 *
 * Meta does not want one file per placement. It wants a small set of aspect
 * ratios and it crops or letterboxes into everything else, so five canvases
 * cover the entire surface. Rendering one file per placement name would give
 * you thirty identical PNGs and a worse upload experience.
 *
 * Shared by the browser renderer and the Node exporter, so no Node built-ins
 * in here.
 */

/**
 * Stories and Reels paint chrome over the top and bottom of a 9:16 file.
 * Reels is the greedier of the two, so its numbers are the ones used: anything
 * outside this band is at risk of sitting under a username or a CTA button.
 */
export const SAFE_ZONE_9x16 = { top: 250, bottom: 672 };

export const CANVASES = [
  {
    id: "1x1",
    label: "Square",
    ratio: "1:1",
    width: 1080,
    height: 1080,
    note: "The workhorse. If you only upload one file, upload this one.",
    placements: [
      "Facebook Feed",
      "Facebook Video Feeds",
      "Facebook Marketplace",
      "Facebook Search Results",
      "Facebook Business Explore",
      "Facebook Right Column",
      "Instagram Feed",
      "Instagram Profile Feed",
      "Instagram Explore",
      "Instagram Search Results",
      "Messenger Inbox",
      "Threads",
      "Audience Network Native & Banner",
      "Carousel card",
      "Collection cover",
    ],
  },
  {
    id: "4x5",
    label: "Vertical feed",
    ratio: "4:5",
    width: 1080,
    height: 1350,
    note: "Takes the most vertical space on a phone. Highest feed CTR of the five.",
    placements: [
      "Facebook Feed",
      "Facebook Video Feeds",
      "Instagram Feed",
      "Instagram Profile Feed",
      "Instagram Explore",
      "Threads",
    ],
  },
  {
    id: "9x16",
    label: "Full vertical",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    safeZone: SAFE_ZONE_9x16,
    note: "Stories, Reels and rewarded placements. Keep everything inside the safe band.",
    placements: [
      "Facebook Stories",
      "Facebook Reels",
      "Instagram Stories",
      "Instagram Reels",
      "Instagram Explore Home",
      "Messenger Stories",
      "Threads",
      "Audience Network Interstitial",
      "Audience Network Rewarded Video",
    ],
  },
  {
    id: "1.91x1",
    label: "Landscape link",
    ratio: "1.91:1",
    width: 1200,
    height: 628,
    note: "The link-preview shape. Right column and inbox placements fall back to it.",
    placements: [
      "Facebook Right Column",
      "Messenger Inbox",
      "Facebook Search Results",
      "Collection cover",
      "Audience Network Banner",
      "Link preview / og:image",
    ],
  },
  {
    id: "16x9",
    label: "Wide",
    ratio: "16:9",
    width: 1920,
    height: 1080,
    note: "In-stream and desktop-weighted placements. Lowest priority of the five.",
    placements: [
      "Facebook In-stream",
      "Facebook Video Feeds (desktop)",
      "Audience Network In-stream",
    ],
  },
];

/**
 * Meta's display limits, not its hard limits. Copy past these still uploads;
 * it just gets truncated behind "See more" or an ellipsis, which is the same
 * thing as not existing.
 */
export const COPY_LIMITS = {
  primaryText: { soft: 125, label: "Primary text", note: "Truncates at the See more line on mobile" },
  headline: { soft: 40, label: "Headline", note: "27 characters on some placements" },
  description: { soft: 30, label: "Description", note: "Right column and inbox only" },
};

export const FILE_RULES = {
  format: "PNG",
  maxBytes: 30 * 1024 * 1024,
  minWidth: 600,
};

/** Flat count of distinct placement names across every canvas. */
export function placementCount() {
  const seen = new Set();
  for (const c of CANVASES) for (const p of c.placements) seen.add(p);
  return seen.size;
}
