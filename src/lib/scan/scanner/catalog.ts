import type { CheckTier } from "../types";

/**
 * The 44 checks the scanner runs, with the ids, weights and tiers each one
 * carries.
 *
 * GENERATED from Ora's catalog (GET https://ora.ai/api/checks, fetched
 * 2026-09-09) when the scan moved in-house, not written by hand, so a payload
 * from this scanner scores identically to one stored while Ora ran the scans:
 * same ids the allowlist in categories.ts keys on, same maxScore the fraction
 * is built from, same tier the grade cap counts, same bonus flag that keeps a
 * check from ever costing points.
 *
 * Only the 44 checks on the allowlist are here. Ora ran 125; the other 81
 * never reached a report, so running them would be requests spent on
 * findings nobody sees.
 *
 * Descriptions are kept because the stored raw payload carries them; the
 * report itself uses the plain-English copy in relevance.ts and never shows
 * these.
 */

export type LayerId = "discovery" | "accessibility" | "usability" | "payments";

export interface CheckDefinition {
  id: string;
  name: string;
  description: string;
  layer: LayerId;
  tier: CheckTier;
  maxScore: number;
  /** Bonus checks are excluded from the score denominator and never cost points. */
  bonus: boolean;
  specUrl?: string;
}

/** Ora's four layers, in the order its payload lists them. */
export const LAYERS: { id: LayerId; name: string; description: string }[] = [
  { id: "discovery", name: "Discovery", description: "Can an agent find and recommend you?" },
  { id: "accessibility", name: "Access", description: "Can it access your data and understand you?" },
  { id: "usability", name: "Usability", description: "Can it use you - operate, authenticate, integrate?" },
  { id: "payments", name: "Payments", description: "Can it pay you?" },
];

export const CHECKS: CheckDefinition[] = [
  /* ── Can an AI find you at all? ──────────────────────────────────────────── */
  {
    id: "brand-search-accuracy",
    name: "Brand name discoverability",
    description:
      "A plain search for your brand name should put your domain in the top results. If it does not, agents cannot reliably tell you apart from lookalikes and resellers.",
    layer: "discovery",
    tier: "required",
    maxScore: 3,
    bonus: false,
  },
  {
    id: "agentic-search-usecase",
    name: "Category share of voice",
    description:
      "When someone asks an AI for a tool that does what you do, do you come up? This measures your share of voice for the problem you solve, not just your name.",
    layer: "discovery",
    tier: "recommended",
    maxScore: 6,
    bonus: false,
  },
  {
    id: "wikipedia-presence",
    name: "Wikipedia / Wikidata entity presence",
    description:
      "A Wikipedia article and Wikidata entry that link to your domain. Wikipedia is the largest single source of citations in AI answers (~48% of ChatGPT citations), so presence there decides whether AIs can verify who you are.",
    layer: "discovery",
    tier: "recommended",
    maxScore: 4,
    bonus: true,
  },
  /* ── Can a crawler read the site? ────────────────────────────────────────── */
  {
    id: "content-no-js",
    name: "Content without JavaScript",
    description:
      "Most AI crawlers never run JavaScript. If your pages need it to show content, agents see a blank site. We fetch your pages with JavaScript off and check the content is still there.",
    layer: "accessibility",
    tier: "required",
    maxScore: 3,
    bonus: false,
  },
  {
    id: "bot-detection",
    name: "Not blocked by bot detection",
    description:
      "Your bot protection may be turning away the visitors you want. We check whether AI agents can reach your site without being blocked.",
    layer: "accessibility",
    tier: "required",
    maxScore: 2,
    bonus: false,
  },
  {
    id: "agent-crawler-reachability",
    name: "Agent crawler reachability",
    description:
      "Whether the homepage is reachable to the major AI crawler/agent User-Agents (ChatGPT-User, ClaudeBot, Google-Extended, ora-agent, DeepSeekBot). A site that blocks these UAs is invisible to those agents from step one.",
    layer: "accessibility",
    tier: "recommended",
    maxScore: 2,
    bonus: false,
  },
  {
    id: "sitemap",
    name: "Sitemap exists",
    description:
      "A map of every page you want found. Agents use your XML sitemap to discover content without crawling blind, so gaps here mean pages that never get read.",
    layer: "accessibility",
    tier: "required",
    maxScore: 2,
    bonus: false,
  },
  {
    id: "sitemap-lastmod",
    name: "Sitemap freshness (lastmod)",
    description:
      "Dates in your sitemap tell agents what changed and when, so they reread fresh pages instead of guessing. We check lastmod dates parse and the newest is recent.",
    layer: "accessibility",
    tier: "recommended",
    maxScore: 1,
    bonus: true,
    specUrl: "https://www.sitemaps.org/protocol.html",
  },
  {
    id: "robots-ai-policy-quality",
    name: "robots.txt AI crawler policy",
    description:
      "An explicit robots.txt policy for AI crawlers: allow the answer and search crawlers that cite you, decide deliberately about training-only crawlers. We look for tiered rules or Content Signals declarations.",
    layer: "discovery",
    tier: "required",
    maxScore: 2,
    bonus: false,
  },
  {
    id: "redirect-hygiene",
    name: "Redirect hygiene",
    description:
      "Pages reach real content without meta-refresh stubs, JavaScript-only redirects, or cross-domain hops that strand non-JS agents",
    layer: "accessibility",
    tier: "recommended",
    maxScore: 1,
    bonus: false,
    specUrl: "https://www.rfc-editor.org/rfc/rfc9110#name-redirection-3xx",
  },
  {
    id: "page-token-budget",
    name: "Page token budget",
    description:
      "Individual pages keep extracted text within an agent-readable budget (~25K tokens) so they fit a context window without truncation",
    layer: "accessibility",
    tier: "recommended",
    maxScore: 1,
    bonus: false,
  },
  {
    id: "agent-friendly-404",
    name: "Agent-friendly 404s",
    description:
      "Missing pages should say 404. Answering every path with a 200 and an app shell tells agents pages exist when they do not, poisoning everything they learn about your site.",
    layer: "usability",
    tier: "recommended",
    maxScore: 2,
    bonus: false,
    specUrl: "https://www.rfc-editor.org/rfc/rfc9110#name-404-not-found",
  },
  {
    id: "docs-auth-gate",
    name: "Content behind auth",
    description:
      "Sampled content pages are publicly readable - pages behind a login wall are invisible to agents",
    layer: "accessibility",
    tier: "recommended",
    maxScore: 2,
    bonus: false,
  },
  /* ── Does the site say anything a model can use? ─────────────────────────── */
  {
    id: "json-ld",
    name: "JSON-LD structured data",
    description:
      "Structured data that states in machine terms what you are: a product, a company, a person. Without it, every AI describing you is guessing from prose. We grade the completeness of your homepage JSON-LD.",
    layer: "accessibility",
    tier: "required",
    maxScore: 4,
    bonus: false,
  },
  {
    id: "json-ld-entity-linking",
    name: "JSON-LD entity linking (sameAs)",
    description:
      "sameAs links from your structured data to your official profiles (GitHub, LinkedIn, app stores). They let AIs confirm that every mention of you is actually you.",
    layer: "accessibility",
    tier: "recommended",
    maxScore: 2,
    bonus: false,
  },
  {
    id: "org-schema-completeness",
    name: "Organization schema completeness",
    description:
      "Company details (contact, address) in your structured data. AIs use them to verify you are a real business before recommending you.",
    layer: "accessibility",
    tier: "recommended",
    maxScore: 2,
    bonus: false,
  },
  {
    id: "schema-type-breadth",
    name: "Schema type breadth",
    description:
      "The more schema.org types you publish (FAQs, products, articles, events), the more kinds of questions an AI can answer about you with confidence.",
    layer: "accessibility",
    tier: "recommended",
    maxScore: 2,
    bonus: false,
  },
  {
    id: "metadata-completeness",
    name: "Metadata completeness",
    description:
      "The basics AIs use to identify a page: canonical URL, language, and Open Graph image and type. Missing pieces mean mangled citations and wrong previews.",
    layer: "accessibility",
    tier: "required",
    maxScore: 2,
    bonus: false,
  },
  {
    id: "pricing-info",
    name: "Pricing info accessible",
    description:
      "If an agent cannot find your prices, it cannot recommend you for a purchase. We check that pricing is discoverable and readable on your site.",
    layer: "accessibility",
    tier: "required",
    maxScore: 3,
    bonus: false,
  },
  {
    id: "trust-anchors",
    name: "Trust anchor pages",
    description:
      "About, contact, and privacy pages with real content. Agents check these to verify you are legitimate before recommending you, the way a careful person would.",
    layer: "accessibility",
    tier: "required",
    maxScore: 2,
    bonus: false,
  },
  {
    id: "agent-instruction",
    name: "Agent instruction / when-to-use",
    description:
      "Explicit guidance on when to use your product, written where agents will read it. An agent choosing between ten tools picks the one that says what it is for.",
    layer: "accessibility",
    tier: "required",
    maxScore: 3,
    bonus: false,
  },
  /* ── The AI-native files ─────────────────────────────────────────────────── */
  {
    id: "agent-discovery-file",
    name: "Agent discovery file",
    description:
      "A dedicated endpoint that tells arriving agents what you are and where to start, like a front desk for automated visitors.",
    layer: "accessibility",
    tier: "required",
    maxScore: 2,
    bonus: false,
  },
  {
    id: "llms-txt-exists",
    name: "llms.txt exists",
    description:
      "llms.txt is your site's guide for AI readers: what you do and where the important pages are. We check for /llms.txt or /.well-known/llms.txt.",
    layer: "accessibility",
    tier: "required",
    maxScore: 1,
    bonus: false,
  },
  {
    id: "llms-txt-formatting",
    name: "llms.txt formatting",
    description:
      "An llms.txt only helps if agents can parse it. We check the format: a heading up top, markdown links, and enough substance to navigate by.",
    layer: "accessibility",
    tier: "recommended",
    maxScore: 2,
    bonus: false,
  },
  {
    id: "llms-txt-links-resolve",
    name: "llms.txt links resolve",
    description:
      "The markdown links an llms.txt declares actually resolve - broken links strand agents that follow the index",
    layer: "accessibility",
    tier: "recommended",
    maxScore: 2,
    bonus: false,
    specUrl: "https://llmstxt.org",
  },
  {
    id: "ard-catalog",
    name: "ARD discovery",
    description:
      "One catalog that tells agents everything you offer them: MCP servers, APIs, agents, and skills. Without it, every agent has to hunt for your capabilities page by page. We look for an Agentic Resource Discovery catalog at /.well-known/ard.json (the ARD v0.91 canonical path), falling back to the predecessor /.well-known/ai-catalog.json, which the spec keeps as an equivalent source. Weighted at 1 point while ecosystem adoption is early (2026-08 audit; was 3).",
    layer: "discovery",
    tier: "required",
    maxScore: 1,
    bonus: false,
    specUrl: "https://agenticresourcediscovery.org/",
  },
  /* ── eCommerce extras: agentic commerce, all bonus ───────────────────────── */
  {
    id: "acp-support",
    name: "ACP - Agentic Commerce Protocol",
    description:
      "A live Agentic Commerce Protocol checkout endpoint (/checkout_sessions), the flow behind agent-driven purchases in ChatGPT. Supporting any one payment protocol is enough, so this reads N/A when another is detected. Optional for non-commerce sites.",
    layer: "payments",
    tier: "required",
    maxScore: 3,
    bonus: true,
  },
  {
    id: "ucp-support",
    name: "UCP - Universal Commerce Protocol",
    description:
      "A Universal Commerce Protocol profile at /.well-known/ucp, telling shopping agents how to transact with you. Supporting any one payment protocol is enough, so this reads N/A when another is detected. Optional for non-commerce sites.",
    layer: "payments",
    tier: "required",
    maxScore: 3,
    bonus: true,
  },
  {
    id: "ap2-support",
    name: "AP2 - Agent Payments Protocol",
    description:
      "Google's Agent Payments Protocol: signed mandates that prove a human authorized the purchase, backed by Mastercard, Visa, PayPal and Amex. Supporting any one payment protocol is enough, so this reads N/A when another is detected. Optional for non-commerce sites.",
    layer: "payments",
    tier: "recommended",
    maxScore: 3,
    bonus: true,
    specUrl: "https://ap2-protocol.org/",
  },
  {
    id: "mpp-support",
    name: "MPP payment protocol",
    description:
      "Machine Payments Protocol lets an agent pay you over plain HTTP. Supporting any one payment protocol is enough, so this reads N/A when another is detected. Optional for non-commerce sites.",
    layer: "payments",
    tier: "required",
    maxScore: 2,
    bonus: true,
  },
  {
    id: "x402-support",
    name: "x402 payment protocol",
    description:
      "x402 lets an agent pay per request over plain HTTP micropayments. Supporting any one payment protocol is enough, so this reads N/A when another is detected. Optional for non-commerce sites.",
    layer: "payments",
    tier: "required",
    maxScore: 2,
    bonus: true,
  },
  {
    id: "chatgpt-app-listed",
    name: "ChatGPT app listed",
    description:
      "Listed in the ChatGPT app directory, where hundreds of millions of users can pull your product into a conversation by name. Upside-only: the directory is curated and gated, so absence never costs points.",
    layer: "discovery",
    tier: "recommended",
    maxScore: 2,
    bonus: true,
  },
  /* ── SaaS extras: the developer surface ──────────────────────────────────── */
  {
    id: "openapi-spec",
    name: "OpenAPI spec published",
    description:
      "An OpenAPI spec is your API in a form machines can read. Agents use it to integrate without a human studying the docs, so it is one of the highest-leverage files you can publish.",
    layer: "accessibility",
    tier: "required",
    maxScore: 7,
    bonus: false,
  },
  {
    id: "public-api",
    name: "Public API with reachable endpoints",
    description:
      "The foundation of agent access: an API that agents can actually call. We check for documentation and at least one endpoint that responds.",
    layer: "usability",
    tier: "required",
    maxScore: 7,
    bonus: false,
  },
  {
    id: "public-api-docs",
    name: "Public API/docs linked from homepage",
    description:
      "Your API docs, linked straight from your homepage. If an agent has to search for your documentation, most will not. Only docs you own count.",
    layer: "accessibility",
    tier: "required",
    maxScore: 3,
    bonus: false,
  },
  {
    id: "developer-portal",
    name: "Developer portal",
    description:
      "A place to sign up, get keys, and manage an integration without emailing anyone. Self-serve is the difference between integrating today and never.",
    layer: "accessibility",
    tier: "recommended",
    maxScore: 6,
    bonus: false,
  },
  {
    id: "mcp-server",
    name: "MCP server / manifest",
    description:
      "MCP is how agents plug directly into your product, the way apps plug into an app store. We check for a Model Context Protocol server or manifest.",
    layer: "usability",
    tier: "required",
    maxScore: 6,
    bonus: false,
  },
  {
    id: "mcp-registry-listed",
    name: "Listed in MCP registries",
    description:
      "Agents find MCP servers through registries the way people find apps through app stores. We check the major ones (Smithery, mcp.so) for an entry verified against your domain.",
    layer: "discovery",
    tier: "recommended",
    maxScore: 1,
    bonus: false,
  },
  {
    id: "oauth-support",
    name: "OAuth 2.0 support",
    description:
      "Agents need a standard way to sign in. We check for OAuth 2.0, or an explicitly open API that needs no keys at all.",
    layer: "usability",
    tier: "required",
    maxScore: 5,
    bonus: false,
  },
  {
    id: "json-error-responses",
    name: "JSON error responses",
    description:
      "When something breaks, agents need a structured JSON error, not an HTML error page. One is recoverable, the other is a dead end.",
    layer: "usability",
    tier: "required",
    maxScore: 4,
    bonus: false,
  },
  {
    id: "api-error-model",
    name: "REST typed error model",
    description:
      "A typed error schema in your OpenAPI spec, so agents know every failure shape in advance and can handle each one deliberately.",
    layer: "usability",
    tier: "recommended",
    maxScore: 3,
    bonus: false,
  },
  {
    id: "agentic-search-specific",
    name: "Developer resource discoverability",
    description:
      "Can an agent that knows your name find your developer resources by searching: API docs, OpenAPI spec, MCP server, auth docs? If not, only people who already have the exact URLs can build on you. Any one recognized resource type earns full marks. Weighted at 3 points while search-result categorisation is noisy (2026-08 audit; was 6, requiring 2 types).",
    layer: "discovery",
    tier: "recommended",
    maxScore: 3,
    bonus: false,
  },
  {
    id: "rest-sdk-packages",
    name: "Multi-language SDK packages",
    description:
      "Official SDKs across ecosystems (npm, PyPI, Go). Each one is an integration an agent does not have to hand-roll, in the language it is already working in.",
    layer: "usability",
    tier: "recommended",
    maxScore: 3,
    bonus: false,
  },
  {
    id: "webmcp",
    name: "WebMCP support",
    description:
      "WebMCP (a W3C draft) exposes tools to agents right on your web pages, no separate server needed. Chrome and the ChatGPT desktop browser now discover and call these tools, so agents browsing your site can act, not just read.",
    layer: "usability",
    tier: "required",
    maxScore: 5,
    bonus: false,
  },
];

export const CHECK_BY_ID: ReadonlyMap<string, CheckDefinition> = new Map(
  CHECKS.map((c) => [c.id, c])
);
