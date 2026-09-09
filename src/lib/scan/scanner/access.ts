import { bareHost, onDomain, resolveUrl, sameSite } from "./http";
import { has, isHtml, looksBlocked, nodeTypes, parseHtml, stringsIn } from "./html";
import { IDENTITY_TYPES, isOrganizationType, type LoadedPage, type Site } from "./site";
import { fail, na, pass, warn, type CheckFn } from "./check";
import { approxTokens, daysAgo, mapLimit, percent, plural } from "./util";

/**
 * The Access layer: can a crawler read the site, and does the site say
 * anything a model can use?
 *
 * This is where most of a service business's score lives. Nothing here
 * needs a search engine or a third party — every question is answered by
 * fetching the site's own pages and reading what came back, which is also
 * what the crawlers being modelled do.
 */

/* ── shared: the AI user-agent probes ───────────────────────────────────── */

/**
 * The assistant crawlers, with the User-Agent strings they actually send.
 *
 * Bot detection keys on these exact strings, so a made-up one would measure
 * how the site treats an unknown bot rather than how it treats ChatGPT.
 */
const AGENT_UAS: [string, string][] = [
  ["GPTBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot"],
  ["ChatGPT-User", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot"],
  ["ClaudeBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)"],
  ["PerplexityBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)"],
  ["Google-Extended", "Mozilla/5.0 (compatible; Google-Extended/1.0; +https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers)"],
  ["DeepSeekBot", "Mozilla/5.0 (compatible; DeepSeekBot/1.0; +https://www.deepseek.com)"],
];

interface UaProbe {
  name: string;
  reachable: boolean;
  status: number;
}

function uaProbes(site: Site): Promise<UaProbe[]> {
  return site.once("uaProbes", () =>
    mapLimit(AGENT_UAS, 3, async ([name, userAgent]) => {
      const result = await site.probe(site.home.finalUrl, { userAgent });
      return { name, status: result.status, reachable: result.status === 200 && !looksBlocked(result) };
    })
  );
}

/* ── content-no-js ──────────────────────────────────────────────────────── */

const contentNoJs: CheckFn = async (site) => {
  const { page, home } = site;
  const chars = page.text.length;
  // Ora's ratio is text over markup with scripts and styles left out of the
  // markup. Measured against seven of its own reports that definition lands
  // within a point of its numbers; text over raw HTML runs a third of them.
  const markup = home.body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").length;
  const ratio = markup > 0 ? chars / markup : 0;
  const ratioText = `${(ratio * 100).toFixed(1)}% content ratio`;

  if (looksBlocked(home)) return fail(`Homepage answered with a bot-protection page (HTTP ${home.status}) - no content is readable without JavaScript`);
  if (chars < 500) {
    return fail(
      `Only ${chars} chars of text in the raw HTML${page.scriptSrcs.length > 0 ? ` alongside ${plural(page.scriptSrcs.length, "script bundle")}` : ""} - content appears to require JavaScript to render`
    );
  }

  const headings = page.headings;
  const h1s = headings.filter((h) => h.level === 1).length;
  const h2s = headings.filter((h) => h.level === 2).length;
  const h3s = headings.filter((h) => h.level === 3).length;
  if (h1s === 0) return warn(1, `${chars} chars but no H1 heading - agents cannot tell what the page is about`);

  const first = headings[0];
  const problems: string[] = [];
  if (first && first.level !== 1) problems.push(`first content heading is H${first.level}, not H1`);
  let deepest = 0;
  for (const h of headings) {
    if (h.level > deepest + 1 && deepest > 0) {
      problems.push(`heading hierarchy skips H${deepest} to H${h.level}`);
      break;
    }
    deepest = Math.max(deepest, h.level);
  }
  if (ratio < 0.05) problems.push(`${ratioText} is below the 5% target`);
  if (problems.length > 0) return warn(2, `${chars} chars with H1, but ${problems.join("; ")}`);
  if (h2s === 0 && h3s === 0) return pass(2, `${chars} chars with H1 but flat heading structure`);
  return pass(3, `${chars} chars, semantic headings (${h1s} H1 + ${h2s} H2s + ${h3s} H3s), ${ratioText}`);
};

/* ── bot-detection ──────────────────────────────────────────────────────── */

const botDetection: CheckFn = async (site) => {
  const probes = await uaProbes(site);
  const blocked = probes.filter((p) => !p.reachable);
  if (blocked.length === 0) return pass(2, `Site accessible to ${probes.length} AI agent user-agents`);
  const list = blocked.map((p) => `${p.name} (HTTP ${p.status || "no response"})`).join(", ");
  if (blocked.length < probes.length) {
    return warn(1, `Blocked for ${blocked.length} of ${probes.length} AI agent user-agents: ${list}`);
  }
  return fail(`Blocked for all ${probes.length} AI agent user-agents: ${list}`);
};

/* ── agent-crawler-reachability ─────────────────────────────────────────── */

const agentCrawlerReachability: CheckFn = async (site) => {
  const probes = await uaProbes(site);
  const named = ["ChatGPT-User", "ClaudeBot", "Google-Extended", "DeepSeekBot"];
  const results = [
    ...named.map((n) => probes.find((p) => p.name === n)).filter((p): p is UaProbe => p !== undefined),
    { name: "FootHoldScan", status: site.home.status, reachable: site.home.status === 200 && !looksBlocked(site.home) },
  ];
  const summary = results.map((r) => `${r.name}: ${r.reachable ? "reachable" : "blocked"}`).join(", ");
  const unreachable = results.filter((r) => !r.reachable).length;
  if (unreachable === 0) return pass(2, `Reachable to all major AI crawlers - ${summary}`);
  if (unreachable < results.length) return warn(1, `Some AI crawlers cannot reach the homepage - ${summary}`);
  return fail(`No AI crawler can reach the homepage - ${summary}`);
};

/* ── sitemap ────────────────────────────────────────────────────────────── */

const sitemap: CheckFn = async (site) => {
  const info = await site.sitemap();
  if (!info) return fail("No sitemap found at /sitemap.xml or declared in robots.txt");
  if (info.isIndex) {
    return pass(
      2,
      `Valid sitemap found at ${info.url} with multiple sitemaps entries (${plural(info.childCount, "child sitemap")}, ${info.entries.length} URLs sampled)`
    );
  }
  return pass(2, `Valid sitemap found at ${info.url} with ${plural(info.entries.length, "entry", "entries")}`);
};

/* ── sitemap-lastmod ────────────────────────────────────────────────────── */

const sitemapLastmod: CheckFn = async (site) => {
  const info = await site.sitemap();
  if (!info) return na("No sitemap to check for lastmod dates");
  const total = info.entries.length;
  if (total === 0) return na("Sitemap has no URL entries to check");
  const dated = info.entries.filter((e) => e.lastmod);
  if (dated.length === 0) {
    return fail(
      `None of the ${total} sampled sitemap entries carries a lastmod date. Add <lastmod> (W3C datetime) so agents can prioritize fresh content.`
    );
  }
  const pct = percent(dated.length, total);
  let newest: Date | null = null;
  for (const e of dated) {
    const d = new Date(e.lastmod as string);
    if (!Number.isNaN(d.getTime()) && (!newest || d > newest)) newest = d;
  }
  if (pct < 50) {
    return warn(
      0,
      `Only ${pct}% of ${total} sampled sitemap entries carry a lastmod date - add it to the rest so agents can prioritize fresh content`
    );
  }
  if (!newest) return warn(0, `${pct}% of ${total} sampled sitemap entries carry a lastmod date but none parses as a W3C datetime`);
  const age = daysAgo(newest);
  if (age > 365) {
    return warn(0, `${pct}% of ${total} sampled sitemap entries carry lastmod, but the newest is ${age} days old - dates this stale read as an abandoned site`);
  }
  return pass(1, `${pct}% of ${total} sampled sitemap entries carry lastmod; newest is ${age} day(s) old`);
};

/* ── redirect-hygiene ───────────────────────────────────────────────────── */

const JS_REDIRECT = /(?:window\.|document\.)?location(?:\.href|\.replace|\.assign)?\s*(?:=|\()/;

const redirectHygiene: CheckFn = async (site) => {
  const pages: LoadedPage[] = [
    { url: site.home.url, result: site.home, page: site.page },
    ...(await site.contentPages()),
  ];
  const issues: string[] = [];
  for (const { url, result, page } of pages) {
    const path = new URL(url).pathname || "/";
    if (page.hasMetaRefresh) issues.push(`meta-refresh stub at ${path}`);
    else if (page.text.length < 200 && page.inlineScripts.some((s) => JS_REDIRECT.test(s))) {
      issues.push(`JavaScript-redirect stub at ${path}`);
    }
    const crossDomain = result.chain.find((hop) => !sameSite(hop.url, result.finalUrl));
    if (crossDomain) issues.push(`cross-domain hop from ${new URL(crossDomain.url).hostname} at ${path}`);
  }
  if (issues.length === 0) {
    return pass(1, `No meta-refresh stubs, JavaScript-redirect stubs, or cross-domain hops across ${plural(pages.length, "checked page")}`);
  }
  const homepageAffected = issues.some((i) => i.endsWith(" at /"));
  if (homepageAffected || issues.length > 1) return fail(`Redirect problems on ${plural(issues.length, "page")}: ${issues.join("; ")}`);
  return warn(0, `Redirect problem on 1 of ${pages.length} checked pages: ${issues[0]}`);
};

/* ── page-token-budget ──────────────────────────────────────────────────── */

const TOKEN_BUDGET_CHARS = 100_000;

const pageTokenBudget: CheckFn = async (site) => {
  const pages: LoadedPage[] = [
    { url: site.home.url, result: site.home, page: site.page },
    ...(await site.contentPages()),
  ];
  const sized = pages.map((p) => ({ url: p.url, chars: p.page.text.length }));
  const largest = sized.reduce((a, b) => (b.chars > a.chars ? b : a), sized[0]);
  const over = sized.filter((p) => p.chars > TOKEN_BUDGET_CHARS);
  const kTokens = (chars: number) => `~${Math.max(1, Math.round(approxTokens(" ".repeat(chars)) / 1000))}K tokens`;
  if (over.length === 0) {
    return pass(1, `All ${plural(sized.length, "measured page")} fit an agent context budget (largest ${kTokens(largest.chars)})`);
  }
  const list = over.map((p) => `${new URL(p.url).pathname} (${kTokens(p.chars)})`).join(", ");
  if (over.length === 1) return warn(0, `1 of ${sized.length} measured pages exceeds the ~25K-token budget: ${list}`);
  return fail(`${over.length} of ${sized.length} measured pages exceed the ~25K-token budget: ${list}`);
};

/* ── docs-auth-gate ─────────────────────────────────────────────────────── */

function isGated(loaded: LoadedPage): boolean {
  const { result, page } = loaded;
  if (result.status === 401 || result.status === 403) return true;
  if (looksBlocked(result)) return true;
  // A login form and not much else is a wall, whatever the status says.
  return /type=["']?password/i.test(page.html) && page.text.length < 800;
}

const docsAuthGate: CheckFn = async (site) => {
  const pages = await site.contentPages();
  if (pages.length === 0) return na("No content pages sampled");
  const gated = pages.filter(isGated);
  const substantive = pages.filter((p) => !isGated(p) && p.page.text.length >= 300).length;
  if (gated.length === 0) {
    return pass(2, `All ${plural(pages.length, "sampled page")} are publicly readable (${substantive} with substantive content)`);
  }
  const list = gated.map((p) => `${new URL(p.url).pathname} (HTTP ${p.result.status})`).join(", ");
  if (gated.length < pages.length) return warn(1, `${gated.length} of ${pages.length} sampled pages are behind a login or block: ${list}`);
  return fail(`All ${pages.length} sampled pages are behind a login or block: ${list}`);
};

/* ── json-ld ────────────────────────────────────────────────────────────── */

/** The first node that says what the site is, if any. */
function identityNode(site: Site): { node: Record<string, unknown>; type: string } | null {
  for (const node of site.page.jsonLd) {
    const type = nodeTypes(node).find((t) => isOrganizationType(t) || IDENTITY_TYPES.has(t));
    if (type) return { node, type };
  }
  return null;
}

const jsonLd: CheckFn = async (site) => {
  const blocks = site.page.jsonLdBlockCount;
  if (blocks === 0) return fail("No JSON-LD structured data found on the homepage");
  const blockText = `(${plural(blocks, "block")})`;
  const identity = identityNode(site);
  if (!identity) {
    return warn(
      1,
      `JSON-LD found ${blockText} but no identity type - use SoftwareApplication, Product, Organization, Person, or Article so agents can tell what this site is`
    );
  }
  const { node, type } = identity;
  const extrasFor: [string, string[]][] = [
    ["sameAs/logo/address", ["sameAs", "logo", "address"]],
    ["category/offers", ["applicationCategory", "category", "offers"]],
    ["author/datePublished", ["author", "datePublished"]],
    ["jobTitle/sameAs", ["jobTitle", "sameAs"]],
  ];
  const extras = extrasFor.find(([, keys]) => keys.some((k) => has(node, k)));
  const core = ["name", "description", "url"].filter((k) => has(node, k));
  if (core.length === 3 && extras) {
    return pass(4, `Rich JSON-LD identity: ${type} with name, description, url, and ${extras[0]} ${blockText}`);
  }
  if (core.length === 3) {
    return warn(3, `JSON-LD identity: ${type} with name, description, url but no sameAs, logo or address ${blockText} - agents can identify you but not verify you`);
  }
  const missing = ["name", "description", "url"].filter((k) => !has(node, k));
  return warn(has(node, "name") ? 2 : 1, `JSON-LD ${type} found ${blockText} but missing ${missing.join(", ")}`);
};

/* ── json-ld-entity-linking ─────────────────────────────────────────────── */

/**
 * The profiles Ora credits as disambiguating a brand.
 *
 * Measured, not assumed: two sites whose Organization schema linked to
 * Instagram, Facebook, Yelp and a Google Business Profile were both scored
 * "No sameAs entity linking" by Ora on the same day, while sites linking to
 * LinkedIn, GitHub, Wikipedia, Wikidata and Crunchbase were credited. Social
 * and map links are real corroboration, but they are not what this check
 * counts, and a scanner that counted them would tell a customer they had
 * passed a check Ora will fail them on.
 */
const AUTHORITY_HOSTS = [
  "wikipedia.org",
  "wikidata.org",
  "linkedin.com",
  "github.com",
  "crunchbase.com",
  "x.com",
  "twitter.com",
];

const jsonLdEntityLinking: CheckFn = async (site) => {
  if (site.page.jsonLdBlockCount === 0) return fail("No JSON-LD on the homepage, so no sameAs entity linking - agents cannot disambiguate your brand");
  const authority = new Set<string>();
  const other = new Set<string>();
  for (const node of site.page.jsonLd) {
    for (const url of stringsIn(node.sameAs)) {
      const host = bareHost(url);
      if (!host || onDomain(url, site.domain)) continue;
      const match = AUTHORITY_HOSTS.find((a) => host === a || host.endsWith(`.${a}`));
      if (match) authority.add(match);
      else other.add(host);
    }
  }
  const list = [...authority].join(", ");
  if (authority.size >= 2) return pass(2, `Strong entity linking via sameAs: ${list}`);
  if (authority.size === 1) return warn(1, `Entity linking to ${list} - add more authority profiles (Wikipedia, Wikidata, LinkedIn, GitHub)`);
  if (other.size > 0) {
    return fail(
      `sameAs links present (${[...other].join(", ")}) but none to an authority profile (Wikipedia, Wikidata, LinkedIn, GitHub, Crunchbase) - agents cannot disambiguate your brand`
    );
  }
  return fail("No sameAs entity linking in JSON-LD - agents cannot disambiguate your brand");
};

/* ── org-schema-completeness ────────────────────────────────────────────── */

const orgSchemaCompleteness: CheckFn = async (site) => {
  const org = site.page.jsonLd.find((n) => nodeTypes(n).some(isOrganizationType));
  if (!org) return fail("No Organization type found in JSON-LD");
  const contact = has(org, "contactPoint");
  const address = has(org, "address");
  if (contact && address) return pass(2, "Organization schema complete with contactPoint and address");
  const missing = [contact ? null : "contactPoint", address ? null : "address"].filter(Boolean).join(", ");
  const note = !contact && (has(org, "telephone") || has(org, "email")) ? " (telephone/email present, but not as a contactPoint)" : "";
  if (contact || address) return warn(1, `Organization schema found but missing: ${missing}${note}`);
  return fail(`Organization schema found but missing: ${missing}${note}`);
};

/* ── schema-type-breadth ────────────────────────────────────────────────── */

const BASIC_TYPES = new Set(["Organization", "Corporation", "WebSite", "WebPage", "ImageObject", "Thing"]);

const schemaTypeBreadth: CheckFn = async (site) => {
  if (site.page.jsonLdBlockCount === 0) return fail("No JSON-LD on the homepage - AI can only answer basic questions about this entity");
  const extended = [...new Set(site.page.jsonLd.flatMap(nodeTypes).filter((t) => !BASIC_TYPES.has(t)))];
  if (extended.length >= 2) return pass(2, `Rich schema vocabulary: ${extended.join(", ")}`);
  if (extended.length === 1) {
    return warn(1, `Some extended schema types found: ${extended[0]} - add FAQPage, Service, or AggregateRating for full coverage`);
  }
  return fail("No extended schema types found - AI can only answer basic questions about this entity");
};

/* ── metadata-completeness ──────────────────────────────────────────────── */

const metadataCompleteness: CheckFn = async (site) => {
  const { page } = site;
  const present: string[] = [];
  const missing: string[] = [];
  (page.canonical ? present : missing).push("canonical URL");
  (page.lang ? present : missing).push(page.lang ? `lang="${page.lang}"` : "<html lang>");
  (page.metas.get("og:image") ? present : missing).push("og:image");
  (page.metas.get("og:type") ? present : missing).push("og:type");
  if (missing.length === 0) return pass(2, `All metadata signals present: ${present.join(", ")}`);
  if (present.length >= 2) return warn(1, `Metadata present: ${present.join(", ")}; missing: ${missing.join(", ")}`);
  return fail(`Most metadata signals missing: ${missing.join(", ")}${present.length ? ` (present: ${present.join(", ")})` : ""}`);
};

/* ── pricing-info ───────────────────────────────────────────────────────── */

const PRICING_PATH = /\/(pricing|prices?|price-list|plans|rates|packages|costs?|fees)(\/|$)/i;
const PRICING_TEXT = /^(pricing|prices?|plans( (&|and) pricing)?|rates|packages|price list)$/i;
const COMMERCIAL_SIGNALS = /\b(pricing|prices?|quote|estimate|book now|order|buy|purchase|subscribe|plans?)\b|[$£€]\s?\d/i;

const pricingInfo: CheckFn = async (site) => {
  const offerNode = site.page.jsonLd.find(
    (n) => nodeTypes(n).some((t) => /^(Offer|AggregateOffer)$/.test(t)) || has(n, "offers") || has(n, "priceRange")
  );
  if (offerNode) return pass(3, "Pricing structured data (schema.org/Offer) found");

  const linked = site.internalLinks
    .filter((l) => PRICING_PATH.test(new URL(l.href).pathname) || PRICING_TEXT.test(l.text.trim()))
    .map((l) => l.href);
  const candidates = [...new Set([...linked, site.url("/pricing"), site.url("/prices"), site.url("/plans")])];
  for (const url of candidates.slice(0, 4)) {
    const result = await site.fetch(url);
    if (result.status !== 200 || !isHtml(result)) continue;
    const page = parseHtml(result.body, result.finalUrl || url);
    if (site.isHomepageClone(page)) continue;
    if (/[$£€]\s?\d|\b(price|pricing|per (hour|month|year)|\/mo\b|starting at|from \$)/i.test(page.text)) {
      return pass(3, `Pricing page found at ${new URL(url).pathname}`);
    }
  }
  if (site.hasCommerceSignals || COMMERCIAL_SIGNALS.test(site.page.text)) {
    return fail("No pricing page or pricing data found");
  }
  return na("No pricing page or pricing data found, and no commercial signals on the homepage");
};

/* ── trust-anchors ──────────────────────────────────────────────────────── */

const trustAnchors: CheckFn = async (site) => {
  const pages = await site.trustPages();
  const labels: [keyof typeof pages, string][] = [["about", "About"], ["contact", "Contact"], ["privacy", "Privacy"]];
  const verified = labels.filter(([k]) => pages[k] && (pages[k] as LoadedPage).page.text.length >= 500).map(([, l]) => l);
  const missing = labels.filter(([, l]) => !verified.includes(l)).map(([, l]) => l);
  if (missing.length === 0) return pass(2, `All trust anchor pages verified: ${verified.join(", ")}`);
  if (verified.length > 0) return warn(1, `Trust anchor pages verified: ${verified.join(", ")}; missing or too thin: ${missing.join(", ")}`);
  return fail("No About, Contact or Privacy page with real content found");
};

/* ── agent-instruction ──────────────────────────────────────────────────── */

const WHEN_TO_USE =
  /when to use|when (not )?to (use|reach|call|route|recommend)|use (this|it|us|them) (when|if|for)|use cases?|best (for|suited)|ideal for|do not use (for|when|if)|don'?t use (for|when|if)|reach for/i;

interface InstructionSource {
  label: string;
  text: string;
}

/** Every document an agent might read for guidance, in the order Ora prefers them. */
function instructionSources(site: Site): Promise<InstructionSource[]> {
  return site.once("instructionSources", async () => {
    const sources: InstructionSource[] = [];
    const llms = await site.llmsTxt();
    if (llms) sources.push({ label: "llms.txt", text: llms.body });
    const skills = await site.json("/.well-known/agent-skills/index.json");
    const skillList = (skills?.data as { skills?: unknown } | undefined)?.skills;
    if (Array.isArray(skillList)) {
      const text = skillList.map((s) => stringsIn((s as Record<string, unknown>)?.description).join(" ")).join("\n");
      sources.push({ label: "/.well-known/agent-skills/", text });
    }
    for (const path of ["/agents.md", "/agent.txt", "/.well-known/agent-card.json"]) {
      const file = await site.textFile(path, 50);
      if (file) sources.push({ label: path, text: file.body });
    }
    return sources;
  });
}

const agentInstruction: CheckFn = async (site) => {
  const sources = await instructionSources(site);
  if (sources.length === 0) return fail("No agent instruction file with when-to-use guidance found");
  const guided = sources.find((s) => WHEN_TO_USE.test(s.text));
  if (guided) {
    return pass(
      3,
      guided.label === "llms.txt"
        ? "When-to-use guidance found in llms.txt"
        : `Agent instruction with when-to-use guidance at ${guided.label}`
    );
  }
  return warn(2, `Agent instruction file at ${sources[0].label} but no explicit when-to-use guidance`);
};

/* ── agent-discovery-file ───────────────────────────────────────────────── */

const agentDiscoveryFile: CheckFn = async (site) => {
  const index = await site.json("/.well-known/agent-skills/index.json");
  if (index) {
    const skills = (index.data as { skills?: unknown }).skills;
    const valid = Array.isArray(skills)
      ? skills.filter((s) => {
          const skill = (s ?? {}) as Record<string, unknown>;
          return typeof skill.name === "string" && typeof skill.description === "string";
        })
      : [];
    if (valid.length > 0) {
      return pass(2, `Agent Skills index (agentskills.io) found at /.well-known/agent-skills/index.json with ${plural(valid.length, "skill")}`);
    }
    return warn(1, "/.well-known/agent-skills/index.json exists but lists no skill with both a name and a description");
  }
  for (const path of ["/agents.md", "/agent.txt", "/.well-known/agent-card.json", "/.well-known/agent.json"]) {
    const file = await site.textFile(path, 100);
    if (file) return pass(2, `Agent discovery file found at ${path}`);
  }
  return fail("No agent discovery file found");
};

/* ── llms.txt ───────────────────────────────────────────────────────────── */

const MARKDOWN_LINK = /\[([^\]]*)\]\(\s*(<?)((?:https?:\/\/|\/)[^\s)>]+)\2?\s*\)/g;

const llmsTxtExists: CheckFn = async (site) => {
  const llms = await site.llmsTxt();
  if (!llms) return fail("No llms.txt found at /llms.txt or /.well-known/llms.txt (or the path returned HTML)");
  const body = llms.body.trim();
  const withoutHeadings = body.replace(/^#.*$/gm, "").trim();
  if (body.length < 100 || withoutHeadings.length < 40) {
    return fail(`llms.txt at ${llms.finalUrl} is a placeholder (${body.length} characters) - at least 100 characters of real content earn credit`);
  }
  return pass(1, `Found the llms.txt at ${llms.finalUrl}.`);
};

const llmsTxtFormatting: CheckFn = async (site) => {
  const llms = await site.llmsTxt();
  if (!llms) return fail("No llms.txt to check the formatting of");
  const body = llms.body;
  const heading = /^\s*#\s*\S/.test(body);
  const links = [...body.matchAll(MARKDOWN_LINK)].length;
  const lines = body.split(/\r?\n/).length;
  const chars = body.length;
  if (!heading && links === 0) return fail("The llms.txt has no markdown heading and no markdown links - it reads as prose, not a navigation index");
  if (!heading) return warn(1, `The llms.txt has ${plural(links, "markdown link")} but does not start with a markdown heading`);
  if (links === 0) return warn(1, `The llms.txt has a heading but no markdown links - agents have nothing to navigate by`);
  if (chars > 30_000) {
    return warn(
      1,
      `The llms.txt is well-formatted with markdown links, but at ${chars.toLocaleString("en-US")} characters it exceeds the 30,000-character recommendation for a navigation index.`
    );
  }
  return pass(2, `The llms.txt is well-formatted: ${lines} lines with markdown links, ${chars.toLocaleString("en-US")} characters in total.`);
};

const llmsTxtLinksResolve: CheckFn = async (site) => {
  const llms = await site.llmsTxt();
  if (!llms) return fail("No llms.txt whose links could be checked");
  const urls = [...new Set(
    [...llms.body.matchAll(MARKDOWN_LINK)]
      .map((m) => resolveUrl(m[3], llms.finalUrl))
      .filter((u): u is string => u !== null)
  )].slice(0, 5);
  if (urls.length === 0) return na("llms.txt declares no markdown links to probe");
  const homePath = new URL(site.home.finalUrl).pathname.replace(/\/$/, "");
  const probed = await mapLimit(urls, 3, async (url) => {
    // The homepage is the one page that legitimately reads as the homepage.
    if (sameSite(url, site.origin) && new URL(url).pathname.replace(/\/$/, "") === homePath) {
      return { url, ok: true };
    }
    const result = await site.fetch(url);
    if (result.status !== 200 || result.body.trim().length === 0) return { url, ok: false };
    if (isHtml(result) && site.isHomepageClone(parseHtml(result.body, result.finalUrl || url))) return { url, ok: false };
    return { url, ok: true };
  });
  const broken = probed.filter((p) => !p.ok);
  if (broken.length === 0) return pass(2, `All ${plural(urls.length, "probed llms.txt link")} resolve to real content`);
  const list = broken.map((b) => b.url).join(", ");
  if (broken.length < urls.length) return warn(1, `${broken.length} of ${urls.length} probed llms.txt links do not resolve: ${list}`);
  return fail(`None of the ${urls.length} probed llms.txt links resolve to real content: ${list}`);
};

/* ── the developer surface (SaaS only) ──────────────────────────────────── */

export interface OpenApiSpec {
  url: string;
  version: string;
  /** Parsed when the spec was JSON; null for YAML, which is only text-searched. */
  json: Record<string, unknown> | null;
  text: string;
}

const OPENAPI_PATHS = [
  "/openapi.json",
  "/openapi.yaml",
  "/openapi.yml",
  "/api/openapi.json",
  "/api/openapi.yaml",
  "/swagger.json",
  "/api/swagger.json",
  "/.well-known/openapi.json",
  "/docs/openapi.json",
  "/api-docs",
  "/v1/openapi.json",
];

/** The site's OpenAPI document, if it publishes one anywhere predictable. */
export function findOpenApi(site: Site): Promise<OpenApiSpec | null> {
  return site.once("openapi", async () => {
    const llms = await site.llmsTxt();
    const linked = [
      ...site.page.links.map((l) => l.href),
      ...(llms ? [...llms.body.matchAll(MARKDOWN_LINK)].map((m) => resolveUrl(m[3], llms.finalUrl) ?? "") : []),
    ].filter((u) => u && /openapi|swagger/i.test(u) && onDomain(u, site.domain));
    const candidates = [...new Set([...linked, ...OPENAPI_PATHS.map((p) => site.url(p))])];
    for (const url of candidates.slice(0, 14)) {
      const result = await site.fetch(url);
      if (result.status !== 200 || isHtml(result)) continue;
      try {
        const json = JSON.parse(result.body) as Record<string, unknown>;
        const version = json.openapi ?? json.swagger;
        if (typeof version === "string") return { url, version, json, text: result.body };
      } catch {
        const yaml = result.body.match(/^(?:openapi|swagger)\s*:\s*["']?([\d.]+)/m);
        if (yaml) return { url, version: yaml[1], json: null, text: result.body };
      }
    }
    return null;
  });
}

const openapiSpec: CheckFn = async (site) => {
  const spec = await findOpenApi(site);
  if (spec) return pass(7, `OpenAPI spec found at ${spec.url} (version: ${spec.version})`);
  return site.hasApiSignals ? fail("No OpenAPI/Swagger specification found") : na("No OpenAPI/Swagger specification found");
};

const DOCS_LINK_TEXT = /\b(api|docs|documentation|developers?|reference|sdk)\b/i;
const DOCS_PATH = /\/(api|docs|documentation|developers?|reference)(\/|$)/i;

/** A documentation page a crawler could reach from the homepage, if any. */
export function findDocs(site: Site): Promise<{ url: string; page: LoadedPage; viaSubdomain: boolean } | null> {
  return site.once("docs", async () => {
    const linked = site.domainLinks
      .filter((l) => DOCS_LINK_TEXT.test(l.text) || DOCS_PATH.test(new URL(l.href).pathname) || /^(docs|developers?|api)\./i.test(new URL(l.href).hostname))
      .map((l) => l.href);
    const subdomains = [`https://docs.${site.domain}/`, `https://developers.${site.domain}/`, `https://developer.${site.domain}/`];
    for (const url of [...new Set([...linked.slice(0, 4), ...subdomains])]) {
      const result = await site.fetch(url);
      if (result.status !== 200 || !isHtml(result)) continue;
      const page = parseHtml(result.body, result.finalUrl || url);
      if (site.isHomepageClone(page) || page.text.length < 200) continue;
      return { url, page: { url, result, page }, viaSubdomain: !sameSite(url, site.origin) };
    }
    return null;
  });
}

const publicApiDocs: CheckFn = async (site) => {
  const docs = await findDocs(site);
  if (docs) {
    if (docs.viaSubdomain) return pass(3, `Documentation site found at ${new URL(docs.url).origin}`);
    return pass(3, `API/docs link found on homepage and resolves: ${new URL(docs.url).pathname}`);
  }
  const text = "No public API or documentation page linked from homepage";
  return site.hasApiSignals ? fail(text) : na(text);
};

const PORTAL_SIGNALS = /api key|quickstart|quick start|getting started|sdk|api reference|authentication|sandbox|client id/i;

const developerPortal: CheckFn = async (site) => {
  const docs = await findDocs(site);
  const candidates = [
    ...(docs ? [docs.url] : []),
    ...["/developers", "/developer", "/docs", "/dev", "/api"].map((p) => site.url(p)),
  ];
  let thin: string | null = null;
  for (const url of [...new Set(candidates)]) {
    const result = await site.fetch(url);
    if (result.status !== 200 || !isHtml(result)) continue;
    const page = parseHtml(result.body, result.finalUrl || url);
    if (site.isHomepageClone(page)) continue;
    const label = sameSite(url, site.origin) ? new URL(url).pathname : url;
    if (PORTAL_SIGNALS.test(page.text)) return pass(6, `Developer portal found at ${label}`);
    thin ??= label;
  }
  if (thin) return warn(3, `Docs page at ${thin} but no self-serve portal signals (API keys, quickstart, sandbox)`);
  return site.hasApiSignals ? fail("No developer portal found") : na("No developer portal found");
};

export const ACCESS_CHECKS: Record<string, CheckFn> = {
  "content-no-js": contentNoJs,
  "bot-detection": botDetection,
  "agent-crawler-reachability": agentCrawlerReachability,
  "sitemap": sitemap,
  "sitemap-lastmod": sitemapLastmod,
  "redirect-hygiene": redirectHygiene,
  "page-token-budget": pageTokenBudget,
  "docs-auth-gate": docsAuthGate,
  "json-ld": jsonLd,
  "json-ld-entity-linking": jsonLdEntityLinking,
  "org-schema-completeness": orgSchemaCompleteness,
  "schema-type-breadth": schemaTypeBreadth,
  "metadata-completeness": metadataCompleteness,
  "pricing-info": pricingInfo,
  "trust-anchors": trustAnchors,
  "agent-instruction": agentInstruction,
  "agent-discovery-file": agentDiscoveryFile,
  "llms-txt-exists": llmsTxtExists,
  "llms-txt-formatting": llmsTxtFormatting,
  "llms-txt-links-resolve": llmsTxtLinksResolve,
  "openapi-spec": openapiSpec,
  "public-api-docs": publicApiDocs,
  "developer-portal": developerPortal,
};
