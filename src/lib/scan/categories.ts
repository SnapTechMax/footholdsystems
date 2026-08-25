/**
 * Business categories, and which of Ora's checks apply to each.
 *
 * This exists because a single allowlist was wrong in both directions. A party
 * rental company was being marked down by Ora for not publishing an SDK or an
 * agent catalog, which is nonsense; a SaaS company scored on the local-business
 * set would be told it is in perfect shape while shipping no OpenAPI spec, no
 * MCP server and no docs, which is worse than nonsense because it is flattering.
 *
 * So the reader tells us what kind of business they are, and the scan is scored
 * against the checks that could plausibly apply to them.
 *
 * Client-safe: no server-only import, because the form needs the labels.
 */

export type BusinessCategory = "sbo" | "ecommerce" | "saas";

export const DEFAULT_CATEGORY: BusinessCategory = "sbo";

export interface CategoryOption {
  value: BusinessCategory;
  label: string;
  /** Shown under the label so nobody has to guess which one they are. */
  hint: string;
}

/**
 * Order matters: this is the order they appear in the dropdown, and it is
 * roughly most-common first. Most people running a scan from a cold ad are a
 * service business, and the first option is the one a hurried person picks.
 */
export const CATEGORIES: CategoryOption[] = [
  {
    value: "sbo",
    label: "Local or service business",
    hint: "Trades, clinics, agencies, restaurants, anyone serving an area",
  },
  {
    value: "ecommerce",
    label: "eCommerce",
    hint: "You sell physical or digital products online",
  },
  {
    value: "saas",
    label: "SaaS or software",
    hint: "You sell software, an app, or an API",
  },
];

export function isBusinessCategory(value: unknown): value is BusinessCategory {
  return value === "sbo" || value === "ecommerce" || value === "saas";
}

export function categoryLabel(category: BusinessCategory): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

/**
 * Checks that apply to every business with a website.
 *
 * Can it be found, can it be read, does it say anything a model can use, and
 * does the rest of the web corroborate it. Nothing here assumes an API, a
 * checkout, or a storefront.
 *
 * This is also the whole of the `sbo` set. A local service business has no
 * additions, because the agentic-commerce and developer-tooling checks Ora runs
 * genuinely do not apply to one. That is not a gap in the list; it is the
 * finding.
 */
const BASE_CHECKS = [
  // Can an AI find you at all?
  "brand-search-accuracy",
  "agentic-search-usecase",
  "wikipedia-presence",
  // Can a crawler read the site?
  "content-no-js",
  "bot-detection",
  "agent-crawler-reachability",
  "sitemap",
  "sitemap-lastmod",
  "robots-ai-policy-quality",
  "redirect-hygiene",
  "page-token-budget",
  "agent-friendly-404",
  "docs-auth-gate",
  // Does the site say anything a model can use?
  "json-ld",
  "json-ld-entity-linking",
  "org-schema-completeness",
  "schema-type-breadth",
  "metadata-completeness",
  "pricing-info",
  "trust-anchors",
  "agent-instruction",
  // The AI-native files.
  "agent-discovery-file",
  "llms-txt-exists",
  "llms-txt-formatting",
  "llms-txt-links-resolve",
] as const;

/**
 * What each category adds on top of the base set.
 *
 * Additive only. Nothing removes a base check, because the base set is the part
 * that decides whether a business gets recommended at all, and that question
 * does not stop mattering because you also happen to sell an API.
 */
const CATEGORY_EXTRAS: Record<BusinessCategory, readonly string[]> = {
  // See BASE_CHECKS: the local-business set is the base set.
  sbo: [],

  /**
   * Agentic commerce. Every one of these is a `bonus` check in Ora's scoring,
   * so they surface as opportunities and never drag the score down, which is
   * the right treatment for standards this young. They are here because an
   * assistant that can complete a purchase is the whole ballgame for a shop,
   * and being reachable that way is about to stop being exotic.
   */
  ecommerce: [
    "acp-support",
    "ucp-support",
    "ap2-support",
    "mpp-support",
    "x402-support",
    "chatgpt-app-listed",
  ],

  /**
   * Developer surface. These are the checks that made the local-business report
   * absurd and make the SaaS one honest: for a software company, having no
   * OpenAPI spec and no MCP server genuinely is why an agent cannot work with
   * you, and it belongs at the top of the report rather than filtered out.
   */
  saas: [
    "openapi-spec",
    "public-api",
    "public-api-docs",
    "developer-portal",
    "mcp-server",
    "mcp-registry-listed",
    "oauth-support",
    "json-error-responses",
    "api-error-model",
    "agentic-search-specific",
    "rest-sdk-packages",
    "webmcp",
    "ard-catalog",
  ],
};

/** The check ids scored and reported for a category. */
export function checksFor(category: BusinessCategory): Set<string> {
  return new Set<string>([...BASE_CHECKS, ...CATEGORY_EXTRAS[category]]);
}

/**
 * Whether a check came from the category's own list rather than the base set.
 *
 * This drives one rule in the scoring, and it is worth stating plainly. Ora
 * marks a check `na` when it could not assess it, and for the developer checks
 * that usually means "this site has no API surface at all". Excluding those is
 * right when we inferred the category, and wrong when the reader told us.
 *
 * If somebody selects SaaS and has no OpenAPI spec, no API and no MCP server,
 * Ora returns `na` for all of them and an exclusion rule would hand them a good
 * score for having nothing to assess. Having nothing is the finding. So `na` on
 * a check the declared category asked for counts as a failure, while `na` on a
 * base check stays excluded, because those genuinely can be inapplicable.
 */
export function isCategoryExtra(
  checkId: string,
  category: BusinessCategory
): boolean {
  return CATEGORY_EXTRAS[category].includes(checkId);
}
