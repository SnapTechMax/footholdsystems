import "server-only";
import { checksFor, type BusinessCategory } from "./categories";
import type { OraCheckTier } from "./types";

/**
 * Which of Ora's checks belong in a report sold to a business owner.
 *
 * THIS IS THE MOST IMPORTANT FILE IN THE SCAN PIPELINE. Ora runs ~124 checks,
 * and the large majority of them score a site's readiness to be *operated* by
 * an AI agent: publish an OpenAPI spec, expose a REST API, run an MCP server,
 * implement OAuth 2.0, ship SDKs to npm and PyPI, support the x402 payment
 * protocol. Every one of those is a real finding for a SaaS company and utter
 * nonsense for a roofing contractor.
 *
 * Emailing a plumber a paid report that tells him to "build an MCP server
 * exposing your API as tools" is how you earn refunds, chargebacks and a
 * reputation. So the report is built from an explicit allowlist of the checks
 * that describe whether a *business* can be found, understood and recommended.
 *
 * ALLOWLIST, NOT DENYLIST, deliberately. Ora adds checks over time. A denylist
 * would silently start recommending whatever they ship next, which is exactly
 * the failure we are guarding against. An unknown check is excluded until
 * somebody looks at it and decides it belongs.
 *
 * The score we report is computed over this subset too — see report.ts. Showing
 * Ora's raw score would mean telling someone they are at 20/100 and then handing
 * them a fix list that cannot possibly move it, because most of the missing
 * points are behind work they will never do.
 */

export interface CheckCopy {
  /** Plain-English name. Ora's own names are written for engineers. */
  title: string;
  /** What it costs them, in business terms. FREE half of the report. */
  consequence: string;
  /**
   * Our fix instruction. PAID half.
   *
   * Written here rather than passed through from Ora because Ora's
   * recommendations assume a developer audience ("publish at
   * /.well-known/...", "declare OAuth scopes"). Where ours is absent the
   * report falls back to Ora's wording, which is correct but colder.
   */
  fix?: string;
  /**
   * Copy for a `warning` result, where one differs meaningfully from a `fail`.
   *
   * Ora distinguishes "we could not find this at all" from "this is partly
   * there", and collapsing the two produced a report that told a real customer
   * his business name did not bring up his website when Ora had actually said
   * it appeared at position four. Anything whose failure wording would be false
   * of a partial pass needs an entry here.
   */
  warning?: Partial<Pick<CheckCopy, "title" | "consequence" | "fix">>;
  /**
   * How the result was arrived at, for checks whose answer depends on how you
   * ask.
   *
   * Rendered as its own block rather than as a trailing sentence, because the
   * trailing sentence is where people stop reading. Anything measured by
   * running a search needs one: the reader will check it in their own browser,
   * see a different answer, and conclude the whole report is wrong. Which is
   * what happened.
   */
  caveat?: string;
}

/**
 * Shared caveat for every check whose result comes from running a search.
 *
 * One constant rather than three copies, so the explanation cannot drift
 * between the checks that need it.
 */
const COLD_SEARCH_CAVEAT =
  "How this was measured: a cold search. No login, no history, no location, no personalisation. That is how a model looks you up when a stranger asks about you. Search your own name in your own browser and you will very likely see yourself first, because your browser already knows who and where you are. Both results are real. This is the one an AI sees.";

export const CHECK_COPY: Record<string, CheckCopy> = {
  /* ── Can an AI find you at all? ─────────────────────────────────────────── */
  "brand-search-accuracy": {
    title: "An AI can't find your site from your business name",
    consequence:
      "This is the one that matters most. When something looks you up by name and your own site is not in the results at all, it has no way to confirm you are real, let alone recommend you. Everything else on this list is downstream of this.",
    caveat: COLD_SEARCH_CAVEAT,
    // The failure wording above is false of a site that does appear, just not
    // at the top, which is what Ora reports far more often than absence.
    warning: {
      title: "You are not the top result for your own name",
      consequence:
        "Your site does come up, but below other pages. Whatever outranks you is shaping the answer an assistant gives about your business, and being second-hand about yourself is a weak position to negotiate from.",
    },
    fix: "Two jobs. First, make your homepage state plainly and in text who you are, what you do and where you do it: business name, category and service area in the title tag, the H1 and the first paragraph. Models match on the words that are actually there, not on what the design implies. Second, get that exact business name spelled identically across your Google Business Profile, your directory listings and your social profiles. Inconsistent naming is the single most common reason a brand search fails to resolve to the right site.",
  },
  "agentic-search-usecase": {
    caveat: COLD_SEARCH_CAVEAT,
    title: "You don't come up for the thing you actually sell",
    consequence:
      "Being findable by name only helps people who already know you. This is whether you surface when somebody describes their problem instead of typing your name, which is how nearly every new customer arrives.",
    fix: "Write one page per service that answers the question a customer would actually ask, in their words, with the answer in the first two sentences. Not \"Our Services\", but \"How much does it cost to replace a rooftop HVAC unit in Riverside County?\" Put the specifics in the copy: the job, the area, the price band, the turnaround. That specificity is what a model matches against when somebody describes a situation rather than naming a company.",
  },
  "wikipedia-presence": {
    title: "No independent entity record anywhere",
    consequence:
      "Models lean on independent sources to decide whether a business is real and worth naming. With nothing outside your own website, you're a claim rather than a fact.",
    fix: "You almost certainly don't qualify for a Wikipedia article, and chasing one is a waste of your time. Wikidata is the achievable half: a structured entity record you can create, linked to your site, your Google Business Profile and your industry listings. Pair it with consistent presence on the directories that matter in your trade. The goal is corroboration from somewhere that isn't you.",
  },

  /* ── Can a crawler read the site? ───────────────────────────────────────── */
  "content-no-js": {
    title: "Your content needs JavaScript to appear",
    consequence:
      "Many AI crawlers don't run JavaScript. If the words only exist after the page boots, the crawler sees an empty shell and leaves with nothing to quote.",
    fix: "Server-render the content that matters: who you are, what you do, where, pricing, contact details. View your own page with JavaScript disabled: whatever survives is what a model gets. Anything that vanishes needs to move into the initial HTML.",
  },
  "bot-detection": {
    title: "Bot protection is blocking AI crawlers",
    consequence:
      "Your security tooling can't tell an AI assistant from a scraper, so it turns both away. You are invisible for the most defensible reason there is, and nobody tells you.",
    fix: "In Cloudflare (or whichever WAF you run), allow the assistant crawlers explicitly: GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended, Bingbot. These are documented, published user agents. Allowing them is not the same as allowing scrapers, and blocking them by default is the most common own-goal we find.",
  },
  "agent-crawler-reachability": {
    title: "AI crawlers can't reliably reach your pages",
    consequence:
      "Something between the request and your content, whether a redirect chain, a challenge page or a slow response, is costing you crawls you never see.",
    fix: "Test your key pages with the assistant user agents directly and watch for challenges, redirect chains and timeouts. Every hop is a chance to be dropped, and a crawler that gets a challenge page does not retry.",
  },
  "sitemap": {
    title: "No sitemap",
    consequence:
      "Crawlers have to guess what pages exist. Anything not linked from the homepage may as well not be published.",
    fix: "Publish sitemap.xml listing every page you want found, and reference it from robots.txt. Keep lastmod dates honest. A sitemap claiming everything changed today gets trusted less, not more.",
  },
  "robots-ai-policy-quality": {
    title: "robots.txt doesn't address AI crawlers",
    consequence:
      "You have no stated position on the crawlers that feed the assistants. Some default to cautious when a site is silent.",
    fix: "Name the AI user agents explicitly in robots.txt and allow the ones you want reading you. Being explicit is worth more than a permissive wildcard, because it is unambiguous to a crawler deciding whether it has permission.",
  },
  "redirect-hygiene": {
    title: "Messy redirects",
    consequence:
      "Every extra hop between the requested URL and the real page is a chance for a crawler to give up before it arrives.",
    fix: "Collapse redirect chains to a single hop. Pick one canonical host, www or apex but not both, and make everything else 308 straight to it rather than through it.",
  },
  "page-token-budget": {
    title: "Pages are too heavy to read whole",
    consequence:
      "A model reading your page has a budget. Spend it on navigation and boilerplate and the part that would have won you the recommendation never gets read.",
    fix: "Get the substance high on the page. Cut duplicated navigation, cookie walls and repeated boilerplate from the initial HTML so the first thing a model reads is the thing you want it to repeat.",
  },
  "agent-friendly-404": {
    title: "Broken pages return the wrong signal",
    consequence:
      "A missing page that answers as though it were fine teaches a crawler to distrust everything else it gets from you.",
    fix: "Return a real 404 status for missing pages, not a 200 with an apology on it. Soft 404s pollute the crawler's picture of which of your pages actually exist.",
  },

  /* ── Does the site say anything a model can use? ────────────────────────── */
  "json-ld": {
    title: "No structured data",
    consequence:
      "Structured data is the only part of your page that states facts unambiguously: who you are, what you sell, where you work, what it costs. Without it a model has to infer all of that from prose, and inference is where you get dropped in favour of a competitor who spelled it out.",
    fix: "Add JSON-LD to your homepage using the type that fits: LocalBusiness (or the specific subtype for your trade) for a service business, Organization otherwise. Populate name, description, url, telephone, address, areaServed, openingHours and sameAs. Add Service schema on each service page and FAQPage on anything question-shaped. This is the single highest-leverage technical change on this list.",
  },
  "json-ld-entity-linking": {
    title: "Your structured data doesn't link to anything else",
    consequence:
      "Nothing connects your website to your Google Business Profile, your directory listings or your social accounts. Each one looks like a different business.",
    fix: "Add a sameAs array to your Organization or LocalBusiness schema listing every profile you control: Google Business Profile, Facebook, LinkedIn, Yelp, industry directories, Wikidata if you have it. This is what collapses a dozen scattered mentions into one entity a model can be confident about.",
  },
  "org-schema-completeness": {
    title: "Your business details are incomplete",
    consequence:
      "Half-filled structured data answers some of a model's questions and leaves the rest open. Open questions are how you lose to the business that answered them.",
    fix: "Fill in every field that applies: legal name, logo, address, telephone, email, founding date, area served, opening hours, price range. Sparse schema is treated as weak evidence, not partial credit.",
  },
  "schema-type-breadth": {
    title: "Only one kind of structured data",
    consequence:
      "Different questions are answered by different schema types. One type means you only ever match one shape of question.",
    fix: "Layer the types that fit your business: Service for what you do, FAQPage for common questions, Review or AggregateRating for social proof, BreadcrumbList for structure, Product where you sell things. Each one is another question you can be the answer to.",
  },
  "metadata-completeness": {
    title: "Thin page metadata",
    consequence:
      "Titles and descriptions are the first thing read and often the only thing quoted. Generic ones give a model nothing worth repeating.",
    warning: {
      title: "Page metadata is nearly complete",
      consequence:
        "Most of the signals are there and one or two are not. A small gap, and the cheapest kind to close.",
    },
    fix: "Write a specific title and meta description for every page: the service, the area, the differentiator. No \"Home | Company Name\". Add Open Graph and canonical tags so the same page isn't read as several.",
  },
  "pricing-info": {
    title: "No pricing anywhere",
    consequence:
      "\"Call for a quote\" is a dead end for something trying to compare options. A model that can't tell whether you fit somebody's budget will recommend one that can.",
    fix: "Publish something: a starting price, a typical range, a per-unit rate, even a worked example. It does not have to be a rate card and it does not commit you to anything. A band beats silence, because silence removes you from every comparison.",
  },
  "trust-anchors": {
    title: "Missing trust pages",
    consequence:
      "About, contact, terms and privacy pages are how anything verifies a business is real. Missing them reads as thin, and thin reads as risky.",
    warning: {
      title: "Some trust pages are missing",
      consequence:
        "You have some of them. The ones that are absent are the ones anything verifying you would look for first, which is why a partial set counts for less than it feels like it should.",
    },
    fix: "Publish a real About page with the actual history and the people, a Contact page with a physical address and phone number in text (not in an image), plus privacy and terms. Boring pages, and they carry disproportionate weight in whether you get recommended.",
  },
  "agent-instruction": {
    title: "Nothing tells an AI when to recommend you",
    consequence:
      "Your site says what you do. It never says which situations you're the right call for, which is the actual question being asked.",
    fix: "Write the when-to-use case explicitly: who you're for, which problems, which area, what you don't do. \"We handle commercial rooftop units under 25 tons across Riverside County; we don't do residential.\" Naming what you don't do is not a weakness, it makes the match sharper.",
  },

  /* ── The AI-native files ────────────────────────────────────────────────── */
  "agent-discovery-file": {
    title: "No agent discovery file",
    consequence:
      "There's no single place an assistant can look to find out what your business is and what it offers.",
    fix: "Publish a discovery file summarising the business, the services, the service area and where to find the rest. It costs an afternoon and it is the file that gets read first.",
  },
  "llms-txt-exists": {
    title: "No llms.txt",
    consequence:
      "The emerging convention for telling a model what your site contains and which pages matter. Its absence is a missed shortcut rather than a penalty, but your competitors are starting to publish one.",
    fix: "Publish /llms.txt: a short markdown file with the business name, one-line description, and linked sections for your key pages with a sentence each. Keep it to what you'd tell somebody in thirty seconds.",
  },
  "llms-txt-formatting": {
    title: "llms.txt isn't formatted correctly",
    consequence: "A malformed file gets skipped, so the work is already done and earning nothing.",
    fix: "Follow the convention: H1 for the site name, a blockquote summary, then H2 sections with markdown link lists and a short description per link. No walls of prose.",
  },
  "llms-txt-links-resolve": {
    title: "llms.txt points at pages that don't load",
    consequence: "Broken links in the file meant to guide a model actively damage its confidence in the rest.",
    fix: "Check every link in llms.txt resolves with a 200 and re-check whenever pages move.",
  },
  "sitemap-lastmod": {
    title: "Sitemap doesn't say what changed when",
    consequence: "Crawlers can't tell fresh pages from stale ones, so they re-read everything or nothing.",
    fix: "Add accurate lastmod dates. Accurate is the operative word. A sitemap claiming every page changed today is treated as unreliable.",
  },
  "docs-auth-gate": {
    title: "Key content sits behind a login",
    consequence: "Anything gated is invisible. If your best material is behind a form, it isn't working for you here.",
    fix: "Move at least a substantial preview of gated material into the open. You can still capture the lead on the deeper version.",
  },
  /* ── eCommerce only. Agentic commerce protocols. ────────────────────────── */
  "acp-support": {
    title: "An AI cannot actually buy from you",
    consequence:
      "Assistants are starting to complete purchases, not just recommend them. A shop an agent can reach but not check out from gets replaced at the last step by one it can.",
    fix: "Agentic Commerce Protocol is the emerging standard for letting an assistant complete a purchase on a customer's behalf. Ask whoever runs your store platform whether they support it or have it on the roadmap. If you are on Shopify or a major host this is likely to arrive as a platform feature rather than something you build, and knowing to ask for it is most of the advantage right now.",
  },
  "ucp-support": {
    title: "No universal commerce endpoint",
    consequence:
      "Nothing tells an agent how to enquire about stock, price or delivery without a human loading your site.",
    fix: "Universal Commerce Protocol exposes catalogue, availability and pricing in a form an agent can query directly. Platform-level for most shops. Raise it with your host; it is a support ticket rather than a project.",
  },
  "ap2-support": {
    title: "No agent payment support",
    consequence:
      "The payment step is where an agent-led purchase ends if it cannot be automated.",
    fix: "Agent Payments Protocol handles authorising a payment made by an agent for a person. Your payment provider owns this, not you. Ask Stripe, Shopify Payments or whoever processes for you what their timeline is.",
  },
  "mpp-support": {
    title: "No machine payment protocol",
    consequence: "One more route by which an automated purchase cannot complete.",
    fix: "Another emerging machine-payment standard. Same answer as the others: your payment processor implements it. The useful move is asking all of them at once rather than one at a time.",
  },
  "x402-support": {
    title: "No x402 support",
    consequence: "Machine-to-machine payment over HTTP is not available on your site.",
    fix: "x402 revives the long-dormant HTTP 402 status for pay-per-request. Niche today and mostly relevant if you sell digital goods or API access. Worth knowing it exists rather than acting on it this quarter.",
  },
  "chatgpt-app-listed": {
    title: "Not listed as a ChatGPT app",
    consequence:
      "Being inside the assistant rather than a name it mentions is a different level of visibility, and the directory is not crowded yet.",
    fix: "Check OpenAI's current developer requirements and submit. For a shop the case is straightforward: browsing, availability and ordering. This is the single highest-ceiling item on an eCommerce list and it is the one almost nobody has done.",
  },

  /* ── SaaS only. The developer surface. ──────────────────────────────────── */
  "openapi-spec": {
    title: "No OpenAPI specification published",
    consequence:
      "This is the big one for a software company. An OpenAPI spec is how an agent learns what your API can do without a human reading your docs. Without it you are a product an assistant can describe but not operate.",
    fix: "Publish your OpenAPI spec at a stable, unauthenticated URL, conventionally /openapi.json. Generate it from your code rather than maintaining it by hand, so it cannot drift from the API it describes. Include auth, every endpoint, request and response schemas, and real examples. Link it from your docs homepage.",
  },
  "public-api": {
    title: "No reachable public API",
    consequence:
      "Agents integrate through APIs. A product that can only be driven through a web interface can be recommended, but it cannot be used, and increasingly those are the same question.",
    fix: "Expose a public REST or GraphQL API with at least the core actions a customer would want automated. It does not have to be your whole surface. Start with reading data and the two or three writes that matter most, documented and authenticated properly.",
  },
  "public-api-docs": {
    title: "API documentation is not discoverable",
    consequence:
      "You may well have docs. If they are not linked from your homepage at a predictable path, a crawler has no way to find them.",
    fix: "Put documentation at /docs, /api or /developers and link it from your main navigation in plain HTML. Predictable paths matter more than pretty ones here.",
  },
  "developer-portal": {
    title: "No developer portal",
    consequence:
      "Nowhere for a developer, or an agent acting for one, to get a key and start without talking to sales.",
    fix: "A portal is API keys, a quickstart, reference docs and ideally a sandbox, all self-serve. The self-serve part is what matters: a gate with a human behind it is a gate an agent cannot pass.",
  },
  "mcp-server": {
    title: "No MCP server",
    consequence:
      "Model Context Protocol is how an assistant uses a product as a set of tools rather than reading about it. For a software company in 2026 this is fast becoming the difference between being integrated and being described.",
    fix: "Build an MCP server exposing your core actions as named tools with clear descriptions and typed parameters. Use Streamable HTTP transport. Start with five or six tools that cover the jobs customers actually automate rather than mirroring your whole API. The tool descriptions are the part people underinvest in and they are what decides whether a model picks the right one.",
  },
  "mcp-registry-listed": {
    title: "Not listed in any MCP registry",
    consequence: "A server nobody can discover is a server nobody connects to.",
    fix: "Once the server exists, list it in the public MCP registries. Cheap, quick, and the discovery surface is small enough that being on it still stands out.",
  },
  "oauth-support": {
    title: "No OAuth 2.0",
    consequence:
      "Without a standard auth flow, an agent acting for a customer has no safe way to get access. The usual workaround is asking people to paste API keys around, which is the thing security teams block.",
    fix: "Implement OAuth 2.0 with PKCE and publish your authorization server metadata at /.well-known/oauth-authorization-server. Declare scopes that map to real permissions so an agent can request the narrow access it needs rather than everything.",
  },
  "json-error-responses": {
    title: "Errors come back as HTML",
    consequence:
      "An agent that gets an HTML error page cannot tell what went wrong or whether retrying would help, so it gives up and reports that your product did not work.",
    fix: "Return structured JSON on every error path with a stable machine-readable code, a human message, and where possible a hint at the resolution. Never an HTML page from an API route, including on 500s and rate limits.",
  },
  "api-error-model": {
    title: "No consistent error shape",
    consequence:
      "Errors that differ in shape between endpoints cannot be handled generically, which means every integration is bespoke.",
    fix: "Define one error envelope and use it everywhere. RFC 9457 problem details is a reasonable default and saves the argument. Document the full code list alongside the endpoints.",
  },
  "agentic-search-specific": {
    caveat: COLD_SEARCH_CAVEAT,
    title: "Your developer resources are not findable by name",
    consequence:
      "An agent searching for your API docs, your spec or your MCP server finds nothing relevant, so none of the work above gets used.",
    fix: "Publish at predictable paths and name them plainly: /docs, /openapi.json, /developers, /mcp. Reference them from your homepage and from llms.txt. Discoverability is a separate problem from existence and it is the one usually left undone.",
  },
  "rest-sdk-packages": {
    title: "No SDK packages",
    consequence:
      "An agent writing integration code reaches for a published client library first. With none, it writes raw HTTP calls and gets your API wrong more often.",
    fix: "Publish official clients to npm and PyPI at minimum, generated from your OpenAPI spec so they cannot drift. Two ecosystems done properly beats six half-maintained.",
  },
  "webmcp": {
    title: "No in-page tools for browser agents",
    consequence:
      "Agents working inside a browser have no declared actions on your pages, so they resort to guessing at your interface.",
    fix: "WebMCP is the draft standard for exposing in-page tools. Add toolname and tooldescription attributes to your key forms and actions. Early, and cheap enough that being early costs you very little.",
  },
  "ard-catalog": {
    title: "No agent resource catalog",
    consequence:
      "There is no single file telling an agent what you offer it, so each one has to discover your API, docs and MCP server separately or not at all.",
    fix: "Publish an Agentic Resource Discovery catalog at /.well-known/ai-catalog.json listing your MCP servers, APIs, agents and skills, each with an identifier, a display name and a working target. It is the index for everything else on this list.",
  },
};

/** Ranking weight by tier. Required failures lead the report. */
export function tierWeight(tier: OraCheckTier | undefined): number {
  if (tier === "required") return 1.5;
  if (tier === "emerging") return 0.6;
  return 1;
}

/**
 * Whether a check belongs in this category's report.
 *
 * Both conditions have to hold: the category has to claim the check, and we
 * have to have written copy for it. A check in a category list with no copy
 * would otherwise reach a customer as Ora's own engineer-facing wording, which
 * is the exact failure this file exists to prevent.
 */
export function isRelevant(
  checkId: string,
  category: BusinessCategory
): boolean {
  return checksFor(category).has(checkId) && Object.hasOwn(CHECK_COPY, checkId);
}
