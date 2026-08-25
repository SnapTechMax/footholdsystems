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

/**
 * `sbo` is Local Services.
 *
 * The stored value keeps its original name while the label does not, because
 * every scan ever run carries 'sbo' in its `category` column and in the JSONB
 * report beside it. Renaming the value to match the label would mean migrating
 * live rows and rewriting stored reports to change a string nobody outside this
 * file ever sees. The label is the thing customers read; this is the key.
 */
export type BusinessCategory =
  | "sbo"
  | "digital"
  | "ecommerce"
  | "saas"
  | "app";

export const DEFAULT_CATEGORY: BusinessCategory = "sbo";

export interface CategoryOption {
  value: BusinessCategory;
  label: string;
  /** Shown under the label so nobody has to guess which one they are. */
  hint: string;
  /**
   * How the report refers to this kind of business in a sentence.
   *
   * Plural, so the summary line needs no article. "the set that applies to
   * online stores" works; "the set that applies to a eCommerce" was what the
   * label produced when it was dropped into that sentence directly, which is
   * what this field exists to stop.
   */
  reportNoun: string;
}

/**
 * Order matters: this is the order they appear in the dropdown, and it is
 * roughly most-common first. Most people running a scan from a cold ad are a
 * service business, and the first option is the one a hurried person picks.
 *
 * Local and Digital are split because the alternative was worse in a way we
 * watched happen: a web developer with no product API picked "SaaS", since it
 * was the only option that sounded like software, and got a report demanding an
 * OpenAPI spec, a developer portal and an MCP server. Every one of those was
 * irrelevant to him and every one of them counted against his score. Somebody
 * who sells services has to be able to say so without also claiming to sell an
 * API.
 */
export const CATEGORIES: CategoryOption[] = [
  {
    value: "sbo",
    label: "Local Services",
    hint: "Trades, clinics, restaurants, anyone serving a physical area",
    reportNoun: "local service businesses",
  },
  {
    value: "digital",
    label: "Digital Services",
    hint: "Agencies, web developers, designers, consultants — services delivered remotely",
    reportNoun: "digital services businesses",
  },
  {
    value: "ecommerce",
    label: "eCommerce",
    hint: "You sell physical or digital products online",
    reportNoun: "online stores",
  },
  {
    value: "saas",
    label: "SaaS or platform",
    hint: "Other businesses connect to you, or build on your API",
    reportNoun: "software platforms",
  },
  {
    value: "app",
    label: "App or software product",
    hint: "People use your product directly — nobody builds on top of it",
    reportNoun: "software products",
  },
];

export function isBusinessCategory(value: unknown): value is BusinessCategory {
  return (
    value === "sbo" ||
    value === "digital" ||
    value === "ecommerce" ||
    value === "saas" ||
    value === "app"
  );
}

export function categoryLabel(category: BusinessCategory): string {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

/** How the report names this kind of business mid-sentence. Plural. */
export function categoryNoun(category: BusinessCategory): string {
  return (
    CATEGORIES.find((c) => c.value === category)?.reportNoun ??
    "businesses like yours"
  );
}

/**
 * Checks that apply to every business with a website.
 *
 * Can it be found, can it be read, does it say anything a model can use, and
 * does the rest of the web corroborate it. Nothing here assumes an API, a
 * checkout, or a storefront.
 *
 * This is also the whole of the `sbo` and `digital` sets. A business that sells
 * services — whether it turns up at your house or works remotely — has no
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
  // See BASE_CHECKS: the services sets are the base set.
  sbo: [],

  /**
   * Deliberately identical to `sbo`, and worth saying why rather than leaving
   * two empty arrays looking like an oversight.
   *
   * Ora has no check that separates a business serving a postcode from one
   * serving a Zoom link. What decides whether either gets recommended is the
   * same list: can it be found by name, can a crawler read it, does it say
   * plainly what it sells and for whom, does anything outside its own website
   * corroborate that. Inventing a difference here would mean moving checks
   * between the two on vibes, and the report would be worse for it.
   *
   * The split earns its place at the top of the funnel, not in the scoring: it
   * gives a web developer somewhere honest to put himself, so he stops landing
   * in `saas` and being told to ship an API he does not have.
   */
  digital: [],

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
   * absurd and make the platform one honest: for a company other businesses are
   * meant to build on, having no OpenAPI spec and no MCP server genuinely is
   * why an agent cannot work with you, and it belongs at the top of the report
   * rather than filtered out.
   *
   * Note what `isCategoryExtra` does with these: an `na` counts as a failure
   * rather than an exclusion, so a platform with no API surface at all scores
   * badly instead of scoring well for having nothing to assess. That is correct
   * here and wrong for `app`, which is why the two are separate categories
   * rather than one with a softer rule.
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

  /**
   * Software people use, that nobody builds on.
   *
   * A consumer app, a desktop tool, a closed B2B product: still software, still
   * sold online, and deliberately without a public API. Before this category
   * existed the only honest-sounding option was `saas`, which scored them
   * against eleven checks measuring an API surface they had decided not to
   * build — an OpenAPI spec, a developer portal, SDKs, OAuth. On one live site
   * that was a twenty-one point penalty for a product working exactly as
   * intended. Not having an API is a choice here, not a finding.
   *
   * So the developer surface is dropped and two things are kept, both of which
   * hold whether or not anyone integrates with you:
   *
   *   webmcp             — a browser agent operating your app has no declared
   *                        actions and has to guess at your interface. This
   *                        asks you to describe pages you already ship, not to
   *                        open an API. Ora scores it `required` at 2 points,
   *                        so it is a real but small finding.
   *   chatgpt-app-listed — a `bonus` check, so it can never drag the score
   *                        down. Being inside the assistant rather than a name
   *                        it mentions matters more for a product than for
   *                        anything else on this list, and the directory is not
   *                        crowded yet.
   */
  app: ["webmcp", "chatgpt-app-listed"],
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
