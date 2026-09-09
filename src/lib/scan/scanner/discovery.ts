import { bareHost, onDomain } from "./http";
import { searchWeb } from "./search";
import type { RobotsGroup, RobotsTxt, Site } from "./site";
import { detectMcp } from "./usability";
import { error, fail, na, pass, warn, type CheckFn } from "./check";
import { plural } from "./util";

/**
 * The Discovery layer: can an agent find you at all?
 *
 * Three of these run a web search and one reads Wikidata, which makes this
 * the only layer that depends on anything other than the site itself. The
 * search-backed checks return `error` rather than `fail` when no search
 * provider is configured, so an unconfigured install produces a report that
 * is silent about brand search instead of one that says every business is
 * unfindable. See search.ts.
 */

/* ── brand-search-accuracy ──────────────────────────────────────────────── */

const brandSearchAccuracy: CheckFn = async (site) => {
  const brand = site.brand;
  const search = await searchWeb(brand, { signal: site.signal, count: 10 });
  if (!search) {
    return error(
      "Brand search not run: no search provider answered (set BRAVE_SEARCH_API_KEY or SERPER_API_KEY for a reliable one)"
    );
  }
  if (search.hits.length === 0) {
    return error(`Search for "${brand}" returned no results (${search.provider}) - could not measure`);
  }
  const position = search.hits.findIndex((h) => onDomain(h.url, site.domain)) + 1;
  const matches = search.hits.filter((h) => onDomain(h.url, site.domain)).length;
  if (position === 0) {
    return fail(
      `"${brand}" search returned ${search.hits.length} results but domain did not appear - brand may be too generic or not indexed`
    );
  }
  if (position <= 3) {
    return pass(
      3,
      `${site.domain} appears at position #${position} in a clean brand-name search for "${brand}" (${plural(matches, "total match", "total matches")})`
    );
  }
  return warn(
    position <= 5 ? 2 : 1,
    `${site.domain} appears ${matches === 1 ? "once" : `${matches} times`} in brand-name search results for "${brand}" (position #${position} out of ${search.hits.length})`
  );
};

/* ── agentic-search-usecase ─────────────────────────────────────────────── */

/**
 * Ora's own scanner returns `na` for this on every site: the check is in beta
 * and does not count. Emitting the same keeps the payload shape identical and
 * keeps report.ts's exclusion of it doing the same thing on both providers.
 */
const agenticSearchUsecase: CheckFn = async () =>
  na(
    "Category share of voice is in beta. It measures whether agents surface you for capability and use-case searches (not just your name). We are tuning it for accuracy before it counts toward your score - coming soon as a Pro check."
  );

/* ── wikipedia-presence ─────────────────────────────────────────────────── */

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

interface WikidataEntity {
  id: string;
  label: string;
  /** English Wikipedia article title, when the item has one. */
  enwiki: string | null;
  /** Whether P856 (official website) points at this domain. */
  websiteMatches: boolean;
}

async function wikidataEntity(site: Site, id: string): Promise<WikidataEntity | null> {
  const result = await site.fetch(
    `${WIKIDATA_API}?action=wbgetentities&ids=${encodeURIComponent(id)}&props=claims|sitelinks|labels&languages=en&format=json`
  );
  if (result.status !== 200) return null;
  try {
    const data = JSON.parse(result.body) as {
      entities?: Record<string, {
        labels?: { en?: { value?: string } };
        sitelinks?: { enwiki?: { title?: string } };
        claims?: { P856?: { mainsnak?: { datavalue?: { value?: unknown } } }[] };
      }>;
    };
    const entity = data.entities?.[id];
    if (!entity) return null;
    const websites = (entity.claims?.P856 ?? [])
      .map((c) => c.mainsnak?.datavalue?.value)
      .filter((v): v is string => typeof v === "string");
    return {
      id,
      label: entity.labels?.en?.value ?? id,
      enwiki: entity.sitelinks?.enwiki?.title ?? null,
      websiteMatches: websites.some((w) => bareHost(w) === site.domain),
    };
  } catch {
    return null;
  }
}

/**
 * Finds the Wikidata item whose official website is this domain.
 *
 * Exact match on P856 first, in the two spellings an editor is likely to have
 * typed; then a name search with the claim verified on each candidate, since
 * P856 is often recorded without the trailing slash Wikidata's own search
 * needs to match on.
 */
async function findWikidata(site: Site): Promise<{ entity: WikidataEntity | null; failed: boolean }> {
  let failed = false;
  for (const variant of [`https://www.${site.domain}/`, `https://${site.domain}/`]) {
    const result = await site.fetch(
      `${WIKIDATA_API}?action=query&list=search&srsearch=${encodeURIComponent(`haswbstatement:P856=${variant}`)}&srlimit=1&format=json`
    );
    if (result.status !== 200) {
      failed = true;
      continue;
    }
    try {
      const data = JSON.parse(result.body) as { query?: { search?: { title?: string }[] } };
      const title = data.query?.search?.[0]?.title;
      if (title) {
        const entity = await wikidataEntity(site, title);
        if (entity?.websiteMatches) return { entity, failed };
      }
    } catch {
      failed = true;
    }
  }

  const byName = await site.fetch(
    `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(site.brand)}&language=en&limit=5&format=json`
  );
  if (byName.status !== 200) return { entity: null, failed: true };
  try {
    const data = JSON.parse(byName.body) as { search?: { id?: string }[] };
    for (const candidate of (data.search ?? []).slice(0, 4)) {
      if (!candidate.id) continue;
      const entity = await wikidataEntity(site, candidate.id);
      if (entity?.websiteMatches) return { entity, failed };
    }
  } catch {
    failed = true;
  }
  return { entity: null, failed };
}

const wikipediaPresence: CheckFn = async (site) => {
  const { entity, failed } = await findWikidata(site);
  if (!entity) {
    if (failed) return error("Wikipedia and Wikidata presence could not be verified - try rescanning");
    return fail(
      `No Wikipedia article or Wikidata entity found for "${site.brand}" - creating a Wikipedia page and a Wikidata item with P856 = ${site.domain} is the highest-impact step for AI search citation coverage`
    );
  }
  if (entity.enwiki) {
    return pass(
      4,
      `Wikipedia "${entity.enwiki}" and Wikidata ${entity.id} both verified - domain confirmed on both sources`
    );
  }
  return warn(
    2,
    `Wikidata ${entity.id} (${entity.label}) verified - draft a Wikipedia page with cited references to complete knowledge graph coverage`
  );
};

/* ── robots-ai-policy-quality ───────────────────────────────────────────── */

/** Crawlers that fetch pages to answer a live question. Lower-cased robots tokens. */
const ANSWER_CRAWLERS = [
  "gptbot",
  "oai-searchbot",
  "chatgpt-user",
  "claudebot",
  "claude-searchbot",
  "claude-user",
  "perplexitybot",
  "perplexity-user",
  "google-extended",
  "applebot-extended",
  "duckassistbot",
  "mistralai-user",
];

/** Crawlers whose declared purpose is collecting training corpora. */
const TRAINING_CRAWLERS = [
  "ccbot",
  "bytespider",
  "anthropic-ai",
  "amazonbot",
  "omgilibot",
  "diffbot",
  "imagesiftbot",
  "timpibot",
  "meta-externalagent",
];

function groupFor(robots: RobotsTxt, agent: string): RobotsGroup | undefined {
  return robots.groups.find((g) => g.agents.includes(agent));
}

/** Whether a group shuts the crawler out of the whole site. */
function blocksRoot(group: RobotsGroup): boolean {
  const disallowsRoot = group.disallow.some((d) => d.trim() === "/");
  const allowsRoot = group.allow.some((a) => a.trim() === "/");
  return disallowsRoot && !allowsRoot;
}

const robotsAiPolicyQuality: CheckFn = async (site) => {
  const robots = await site.robots();
  if (!robots) return fail("No robots.txt found - crawlers have no stated policy to read");

  const signals = robots.contentSignals;
  if (signals && signals.search === "yes" && signals["ai-train"] === "no") {
    const parts = Object.entries(signals).map(([k, v]) => `${k}=${v}`).join(", ");
    return pass(2, `Tier-aware Content Signals policy (${parts}) - search allowed, ai-train blocked`);
  }

  const answerAllowed: string[] = [];
  const answerBlocked: string[] = [];
  for (const agent of ANSWER_CRAWLERS) {
    const group = groupFor(robots, agent);
    if (!group) continue;
    (blocksRoot(group) ? answerBlocked : answerAllowed).push(agent);
  }
  const trainingRestricted: string[] = [];
  const trainingNamed: string[] = [];
  for (const agent of TRAINING_CRAWLERS) {
    const group = groupFor(robots, agent);
    if (!group) continue;
    trainingNamed.push(agent);
    if (blocksRoot(group)) trainingRestricted.push(agent);
  }

  if (answerBlocked.length > 0) {
    return fail(
      `robots.txt blocks AI answer crawlers (${answerBlocked.join(", ")}) - the assistants that respect it never see the site`
    );
  }
  if (answerAllowed.length > 0 && trainingRestricted.length > 0) {
    return pass(
      2,
      `Sophisticated AI crawler policy: answer crawlers allowed (${answerAllowed.join(", ")}), training crawlers (${trainingRestricted.join(", ")}) restricted`
    );
  }
  if (answerAllowed.length > 0 || trainingNamed.length > 0) {
    return warn(
      1,
      `AI crawlers named in robots.txt (${[...answerAllowed, ...trainingNamed].join(", ")}) but no tier differentiation between answer and training crawlers`
    );
  }

  const wildcard = groupFor(robots, "*");
  if (wildcard && !blocksRoot(wildcard)) {
    return warn(
      1,
      "robots.txt allows all crawlers (e.g. `User-agent: *` + `Allow: /`) - open by default but declares no AI-crawler tier differentiation"
    );
  }
  if (wildcard) return fail("robots.txt disallows all crawlers at the root - AI crawlers are shut out along with everything else");
  return fail("No AI crawler directives in robots.txt");
};

/* ── chatgpt-app-listed ─────────────────────────────────────────────────── */

const chatgptAppListed: CheckFn = async (site) => {
  const manifest = await site.json("/.well-known/ai-plugin.json");
  const data = manifest?.data as { name_for_human?: unknown; name_for_model?: unknown } | undefined;
  const name = data?.name_for_human ?? data?.name_for_model;
  if (typeof name === "string" && name.trim()) {
    return pass(2, `ChatGPT plugin manifest found: "${name.trim()}"`);
  }
  // The directory itself has no public API to query; the manifest is the
  // only self-published evidence. Bonus check, so a miss costs nothing.
  return fail("Not found in ChatGPT app directory");
};

/* ── mcp-registry-listed ────────────────────────────────────────────────── */

const mcpRegistryListed: CheckFn = async (site) => {
  const mcp = await detectMcp(site);
  if (mcp.kind === "none") return na("No MCP server detected");
  return error(
    "MCP registry listings (Smithery, mcp.so) are not queried by the local scanner - verify the listing by hand"
  );
};

/* ── ard-catalog ────────────────────────────────────────────────────────── */

function validateArd(data: unknown): {
  spec: string;
  entries: number;
  valid: number;
  trust: boolean;
  firstError: string | null;
} {
  const catalog = (data ?? {}) as Record<string, unknown>;
  const spec = typeof catalog.specVersion === "string" ? catalog.specVersion : "unknown";
  const entries = Array.isArray(catalog.entries) ? catalog.entries : [];
  let valid = 0;
  let trust = false;
  let firstError: string | null = null;
  entries.forEach((raw, index) => {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const id = typeof entry.identifier === "string" ? entry.identifier : "";
    const problems: string[] = [];
    if (!id.startsWith("urn:air:")) problems.push("identifier is not a urn:air");
    if (typeof entry.displayName !== "string" || !entry.displayName) problems.push("missing displayName");
    if (typeof entry.type !== "string" || !entry.type) problems.push("missing type");
    const hasUrl = typeof entry.url === "string";
    const hasData = entry.data !== undefined;
    if (hasUrl === hasData) problems.push("needs exactly one of url or data");
    if (entry.trustManifest && typeof entry.trustManifest === "object") trust = true;
    if (problems.length === 0) valid++;
    else firstError ??= `entry[${index}]${id ? ` (${id})` : ""}: ${problems[0]}`;
  });
  if (entries.length === 0) firstError ??= "no entries";
  return { spec, entries: entries.length, valid, trust, firstError };
}

const ardCatalog: CheckFn = async (site) => {
  for (const path of ["/.well-known/ard.json", "/.well-known/ai-catalog.json"]) {
    const found = await site.json(path);
    if (!found) continue;
    const legacy = path.endsWith("ai-catalog.json");
    const legacyNote = legacy
      ? " - served at the legacy path; the canonical ARD path is /.well-known/ard.json (ARD v0.91)"
      : "";
    const v = validateArd(found.data);
    if (v.entries > 0 && v.valid === v.entries) {
      return pass(
        1,
        `ARD catalog valid at ${path} (spec ${v.spec}) - ${v.valid}/${v.entries} entries${v.trust ? ", trustManifest present" : ""}${legacyNote}`
      );
    }
    return warn(0, `${path} present but invalid: ${v.firstError}${legacyNote}`);
  }
  return fail("No /.well-known/ard.json (and no legacy /.well-known/ai-catalog.json)");
};

/* ── agentic-search-specific ────────────────────────────────────────────── */

const DEV_RESOURCE_TYPES: [string, RegExp][] = [
  ["OpenAPI spec", /openapi|swagger/i],
  ["MCP server", /\bmcp\b/i],
  ["auth docs", /\b(oauth|authentication|auth)\b/i],
  ["developer portal", /developers?\b/i],
  ["API docs", /\bapi\b|\bdocs?\b|documentation|reference/i],
];

const agenticSearchSpecific: CheckFn = async (site) => {
  const search = await searchWeb(`${site.brand} API documentation`, {
    signal: site.signal,
    count: 10,
  });
  if (!search) {
    return error(
      "Developer-resource search not run: no search provider answered (set BRAVE_SEARCH_API_KEY or SERPER_API_KEY for a reliable one)"
    );
  }
  const own = search.hits.filter((h) => onDomain(h.url, site.domain));
  if (own.length === 0) {
    return na(`Agent searched for "${site.brand}" developer resources but found nothing relevant`);
  }
  const types = new Set<string>();
  for (const hit of own) {
    const haystack = `${hit.url} ${hit.title}`;
    const match = DEV_RESOURCE_TYPES.find(([, re]) => re.test(haystack));
    if (match) types.add(match[0]);
  }
  if (types.size === 0) {
    // A plumber's pages turning up for "<name> API documentation" is not a
    // developer resource half-found; Ora reads that as nothing relevant.
    if (!site.hasApiSignals) {
      return na(`Agent searched for "${site.brand}" developer resources but found nothing relevant`);
    }
    return warn(1, `Agent found ${plural(own.length, "page")} by name but no recognizable developer-resource type`);
  }
  return pass(
    3,
    `Agent discovered ${plural(types.size, "developer-resource type")} by name (${[...types].join(", ")}) across ${plural(own.length, "page")}`
  );
};

export const DISCOVERY_CHECKS: Record<string, CheckFn> = {
  "brand-search-accuracy": brandSearchAccuracy,
  "agentic-search-usecase": agenticSearchUsecase,
  "wikipedia-presence": wikipediaPresence,
  "robots-ai-policy-quality": robotsAiPolicyQuality,
  "chatgpt-app-listed": chatgptAppListed,
  "mcp-registry-listed": mcpRegistryListed,
  "ard-catalog": ardCatalog,
  "agentic-search-specific": agenticSearchSpecific,
};
