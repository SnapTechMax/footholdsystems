import "server-only";
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
}

export const RELEVANT_CHECKS: Record<string, CheckCopy> = {
  /* ── Can an AI find you at all? ─────────────────────────────────────────── */
  "brand-search-accuracy": {
    title: "Your own name doesn't bring up your website",
    consequence:
      "This is the one that matters most. When an assistant goes looking for you by name and your own site isn't what comes back, it has no way to confirm you're real, let alone recommend you. Everything else on this list is downstream of this.",
    fix: "Two jobs. First, make your homepage state plainly and in text who you are, what you do and where you do it: business name, category and service area in the title tag, the H1 and the first paragraph. Models match on the words that are actually there, not on what the design implies. Second, get that exact business name spelled identically across your Google Business Profile, your directory listings and your social profiles. Inconsistent naming is the single most common reason a brand search fails to resolve to the right site.",
  },
  "agentic-search-usecase": {
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
};

/** Ranking weight by tier. Required failures lead the report. */
export function tierWeight(tier: OraCheckTier | undefined): number {
  if (tier === "required") return 1.5;
  if (tier === "emerging") return 0.6;
  return 1;
}

export function isRelevant(checkId: string): boolean {
  return Object.hasOwn(RELEVANT_CHECKS, checkId);
}
