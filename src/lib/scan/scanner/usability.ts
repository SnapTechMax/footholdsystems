import { findDocs, findOpenApi } from "./access";
import { onDomain } from "./http";
import { isHtml, stringsIn } from "./html";
import type { Site } from "./site";
import { error, fail, na, pass, warn, type CheckFn } from "./check";
import { mapLimit, plural, randomSlug } from "./util";

/**
 * The Usability layer: can an agent operate the site?
 *
 * One check here applies to everybody (agent-friendly-404) and one to any
 * software product (webmcp). The rest describe an API surface, and for a
 * site that has none they answer `na` the way Ora's do — which report.ts
 * then counts as a failure only when the reader said they were a platform.
 */

/* ── agent-friendly-404 ─────────────────────────────────────────────────── */

const agentFriendly404: CheckFn = async (site) => {
  // Ora asks for markdown first. A site that answers a 404 with a markdown
  // body when asked is giving an agent something it can act on; the same
  // links in an HTML page earn the lesser credit, which is what Ora awards
  // an HTML 404 however helpful its content.
  const result = await site.fetch(`/${randomSlug()}`, {
    headers: { Accept: "text/markdown, text/plain;q=0.9, text/html;q=0.8, */*;q=0.7" },
  });
  if (result.status === 0) return error(`Could not probe a nonexistent path: ${result.error}`);
  if (result.chain.length > 0 && result.status === 200) {
    return warn(0, `Nonexistent paths redirect to ${new URL(result.finalUrl).pathname} instead of returning 404 - agents conclude every path exists`);
  }
  if (result.status === 404 || result.status === 410) {
    const body = result.body.slice(0, 20_000);
    const markdown =
      result.contentType.includes("text/markdown") ||
      (!isHtml(result) && /^\s*#/.test(body) && /\]\(|https?:\/\//.test(body));
    if (markdown) return pass(2, "Nonexistent paths return HTTP 404 with markdown guidance for agents - the strongest 404 contract");
    return warn(1, "Nonexistent paths return a real HTTP 404. For full credit, include a short markdown body (site map links, where to look next) so agents can recover.");
  }
  if (result.status === 200) {
    return fail("Nonexistent paths return HTTP 200 with the app shell (soft-404). Agents probing for resources conclude every path exists. Return a real HTTP 404 status for unknown paths.");
  }
  if (result.status === 401 || result.status === 403) {
    return warn(0, `Nonexistent paths return HTTP ${result.status} where a 404 belongs - agents cannot tell a missing page from a gated one`);
  }
  return error(`Nonexistent path probe answered HTTP ${result.status} - could not classify`);
};

/* ── shared: the MCP surface ────────────────────────────────────────────── */

export type McpDetection =
  | { kind: "none" }
  | { kind: "manifest"; url: string }
  | { kind: "auth"; url: string; challenge: string }
  | { kind: "connected"; url: string; name: string; version: string; protocol: string };

const INITIALIZE = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "FootHoldScan", version: "1.0" },
  },
});

function parseInitialize(body: string): { name: string; version: string; protocol: string } | null {
  // Streamable HTTP may answer as JSON or as an SSE frame carrying JSON.
  const json = body.trim().startsWith("{")
    ? body
    : body.split("\n").find((l) => l.startsWith("data:"))?.slice(5).trim();
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as {
      result?: { serverInfo?: { name?: string; version?: string }; protocolVersion?: string };
    };
    if (!parsed.result) return null;
    return {
      name: parsed.result.serverInfo?.name ?? "unnamed",
      version: parsed.result.serverInfo?.version ?? "?",
      protocol: parsed.result.protocolVersion ?? "?",
    };
  } catch {
    return null;
  }
}

export function detectMcp(site: Site): Promise<McpDetection> {
  return site.once("mcp", async () => {
    const manifest = await site.json("/.well-known/mcp.json");
    const endpoints = [site.url("/mcp"), site.url("/api/mcp"), `https://mcp.${site.domain}/`, `https://mcp.${site.domain}/mcp`];
    const manifestUrl = (manifest?.data as { url?: unknown; endpoint?: unknown } | undefined);
    for (const candidate of [manifestUrl?.url, manifestUrl?.endpoint]) {
      if (typeof candidate === "string" && /^https?:\/\//.test(candidate)) endpoints.unshift(candidate);
    }
    let auth: { url: string; challenge: string } | null = null;
    for (const url of [...new Set(endpoints)]) {
      const result = await site.fetch(url, {
        method: "POST",
        body: INITIALIZE,
        headers: { Accept: "application/json, text/event-stream" },
        maxBytes: 64_000,
      });
      if (result.status === 200) {
        const info = parseInitialize(result.body);
        if (info) return { kind: "connected", url, ...info };
      }
      const challenge = result.status === 401 ? result.headers?.get("www-authenticate") : null;
      if (challenge) auth ??= { url, challenge };
    }
    if (auth) return { kind: "auth", ...auth };
    if (manifest) return { kind: "manifest", url: site.url("/.well-known/mcp.json") };
    return { kind: "none" };
  });
}

const mcpServer: CheckFn = async (site) => {
  const mcp = await detectMcp(site);
  switch (mcp.kind) {
    case "connected":
      return pass(6, `MCP server connected via Streamable HTTP at ${mcp.url} - ${mcp.name} v${mcp.version} (protocol ${mcp.protocol})`);
    case "auth":
      return warn(5, `Live MCP server at ${mcp.url} requires authentication (challenge at initialize) - properly scoped. Upgrade to public tool listing for full 6/6.`);
    case "manifest":
      return warn(5, `MCP manifest at /.well-known/mcp.json but no live handshake at /mcp or /api/mcp`);
    default:
      return na("No MCP server or manifest found");
  }
};

/* ── public-api ─────────────────────────────────────────────────────────── */

/** An endpoint on this domain that answers with JSON, if one is easy to find. */
function findJsonEndpoint(site: Site): Promise<{ url: string; status: number } | null> {
  return site.once("jsonEndpoint", async () => {
    const spec = await findOpenApi(site);
    const servers = (spec?.json?.servers as { url?: unknown }[] | undefined) ?? [];
    const fromSpec = servers.map((s) => s.url).filter((u): u is string => typeof u === "string" && /^https?:/.test(u));
    const candidates = [...fromSpec, `https://api.${site.domain}/`, site.url("/api"), site.url("/api/v1")];
    for (const url of [...new Set(candidates)].slice(0, 5)) {
      const result = await site.probe(url, { headers: { Accept: "application/json" } });
      if (result.status !== 0 && result.contentType.includes("json")) return { url, status: result.status };
    }
    return null;
  });
}

const publicApi: CheckFn = async (site) => {
  const docs = await findDocs(site);
  const spec = await findOpenApi(site);
  if (docs) return pass(7, `REST API documentation found at ${docs.url}. Best-of-protocols score: 7/7.`);
  if (spec) return pass(7, `OpenAPI spec at ${spec.url} describes the API. Best-of-protocols score: 7/7.`);
  const endpoint = await findJsonEndpoint(site);
  if (endpoint) return warn(4, `An endpoint answers with JSON at ${endpoint.url} (HTTP ${endpoint.status}) but no documentation is linked from the homepage`);
  return na("No publicly reachable API surface detected (REST and GraphQL both absent or auth-gated)");
};

/* ── oauth-support ──────────────────────────────────────────────────────── */

const oauthSupport: CheckFn = async (site) => {
  const checks: [string, string][] = [
    ["/.well-known/oauth-authorization-server", "OAuth authorization server metadata"],
    ["/.well-known/openid-configuration", "OpenID Connect discovery endpoint"],
    ["/.well-known/oauth-protected-resource", "OAuth protected resource metadata"],
  ];
  for (const [path, label] of checks) {
    const found = await site.json(path);
    const data = (found?.data ?? {}) as Record<string, unknown>;
    if (found && (typeof data.issuer === "string" || typeof data.authorization_endpoint === "string" || typeof data.resource === "string")) {
      return pass(5, `${label} found at ${site.origin}`);
    }
  }
  // An MCP server that answers initialize with an OAuth challenge points at
  // its protected-resource metadata, which names the authorization server.
  // That is how Ora finds Stripe's at access.stripe.com rather than on the
  // marketing domain, and it is the path an agent would actually take.
  const mcp = await detectMcp(site);
  if (mcp.kind === "auth") {
    const server = await authorizationServerFor(site, mcp.url, mcp.challenge);
    if (server) return pass(5, `OAuth authorization server metadata at ${server}`);
  }
  if (/\boauth\b/i.test(site.page.text)) return na("OAuth mentioned on homepage but no standard endpoints found");
  return na("No OAuth 2.0 or OpenID Connect support detected");
};

/** Follows RFC 9728 protected-resource metadata to an authorization server with RFC 8414 metadata. */
async function authorizationServerFor(site: Site, mcpUrl: string, challenge: string): Promise<string | null> {
  const fromHeader = challenge.match(/resource_metadata="([^"]+)"/)?.[1];
  const metadataUrls = [fromHeader, `${new URL(mcpUrl).origin}/.well-known/oauth-protected-resource`].filter(
    (u): u is string => typeof u === "string"
  );
  for (const url of [...new Set(metadataUrls)]) {
    const doc = await site.json(url);
    const servers = (doc?.data as { authorization_servers?: unknown } | undefined)?.authorization_servers;
    const issuer = Array.isArray(servers) ? servers.find((v) => typeof v === "string") : undefined;
    if (typeof issuer !== "string") continue;
    const base = new URL(issuer);
    const path = base.pathname.replace(/\/$/, "");
    // RFC 8414 puts the well-known segment before the issuer's path, and
    // many servers also answer with it appended; both are tried.
    const candidates = [
      `${base.origin}/.well-known/oauth-authorization-server${path}`,
      `${base.origin}${path}/.well-known/oauth-authorization-server`,
      `${base.origin}/.well-known/openid-configuration${path}`,
      `${base.origin}${path}/.well-known/openid-configuration`,
    ];
    for (const candidate of [...new Set(candidates)]) {
      const meta = await site.json(candidate);
      const data = (meta?.data ?? {}) as Record<string, unknown>;
      if (meta && (typeof data.issuer === "string" || typeof data.authorization_endpoint === "string")) {
        return issuer.replace(/\/$/, "");
      }
    }
  }
  return null;
}

/* ── json-error-responses ───────────────────────────────────────────────── */

const jsonErrorResponses: CheckFn = async (site) => {
  const spec = await findOpenApi(site);
  const servers = (spec?.json?.servers as { url?: unknown }[] | undefined) ?? [];
  const fromSpec = servers.map((s) => s.url).filter((u): u is string => typeof u === "string" && /^https?:/.test(u));
  const probes = [
    ...fromSpec.map((u) => `${u.replace(/\/$/, "")}/${randomSlug()}`),
    site.url(`/api/v1/${randomSlug()}`),
    site.url(`/api/${randomSlug()}`),
    `https://api.${site.domain}/${randomSlug()}`,
  ];
  for (const url of [...new Set(probes)].slice(0, 5)) {
    const result = await site.probe(url, { headers: { Accept: "application/json" } });
    if (result.status >= 400 && result.status < 500 && result.contentType.includes("json")) {
      return pass(4, `API returns JSON error responses (${result.status} at ${url}${fromSpec.includes(url) ? " (from OpenAPI servers)" : ""})`);
    }
  }
  const text = "API does not return JSON error responses (or no API detected)";
  return site.hasApiSignals || spec ? fail(text) : na(text);
};

/* ── api-error-model ────────────────────────────────────────────────────── */

const apiErrorModel: CheckFn = async (site) => {
  const spec = await findOpenApi(site);
  if (!spec) {
    // No spec to read the model from. An API that exists without one has
    // no typed error model an agent could find; a site with no API at all
    // has nothing to type.
    const surface = (await findDocs(site)) ?? (await findJsonEndpoint(site));
    return surface ? fail("No typed error model found") : na("No REST API surface detected on this domain");
  }
  if (/application\/problem\+json/i.test(spec.text)) return pass(3, "OpenAPI uses application/problem+json (RFC 7807) for 4xx/5xx responses");
  if (!spec.json) {
    return /components:\s*[\s\S]*?schemas:[\s\S]*?\b\w*(Error|Problem)\w*:/m.test(spec.text)
      ? pass(3, "OpenAPI (YAML) defines an error schema under components.schemas")
      : fail("No typed error model found");
  }
  const schemas = ((spec.json.components as { schemas?: Record<string, unknown> } | undefined)?.schemas) ?? {};
  const errorSchemas = Object.keys(schemas).filter((k) => /error|problem/i.test(k));
  if (errorSchemas.length === 0) return fail("No typed error model found");
  const referenced = errorSchemas.some((name) =>
    new RegExp(`"[45]\\d\\d"\\s*:\\s*\\{[^}]*?\\$ref"\\s*:\\s*"#/components/schemas/${name}"`).test(spec.text)
      || new RegExp(`#/components/schemas/${name}`).test(spec.text.replace(/"components"[\s\S]*$/, ""))
  );
  if (referenced) return pass(3, "OpenAPI defines a typed error schema in components.schemas and 4xx/5xx responses reference it");
  return warn(1, `OpenAPI defines ${errorSchemas.join(", ")} in components.schemas but no 4xx/5xx response references it`);
};

/* ── rest-sdk-packages ──────────────────────────────────────────────────── */

const ECOSYSTEM_LINKS: [string, RegExp][] = [
  ["npm", /npmjs\.com\/package\//i],
  ["pypi", /pypi\.org\/project\//i],
  ["rubygems", /rubygems\.org\/gems\//i],
  ["go", /pkg\.go\.dev\//i],
  ["packagist", /packagist\.org\/packages\//i],
  ["nuget", /nuget\.org\/packages\//i],
  ["crates", /crates\.io\/crates\//i],
  ["maven", /mvnrepository\.com|central\.sonatype\.com/i],
];

function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const restSdkPackages: CheckFn = async (site) => {
  const ecosystems = new Set<string>();
  let npmNote = "";

  const registry = await site.fetch(
    `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(site.brand)}&size=20`,
    { headers: { Accept: "application/json" } }
  );
  if (registry.status === 200) {
    try {
      const data = JSON.parse(registry.body) as { objects?: { package?: { name?: string; links?: Record<string, string> } }[] };
      const brand = squash(site.brand);
      const official = (data.objects ?? []).some(({ package: pkg }) => {
        if (!pkg?.name) return false;
        const bare = pkg.name.replace(/^@[^/]+\//, "");
        const scope = pkg.name.match(/^@([^/]+)\//)?.[1];
        const linksHome = Object.values(pkg.links ?? {}).some((u) => onDomain(u, site.domain));
        return linksHome || squash(bare) === brand || (scope !== undefined && squash(scope) === brand);
      });
      if (official) ecosystems.add("npm");
    } catch {
      npmNote = " (npm registry answer unreadable)";
    }
  } else {
    npmNote = " (npm registry unreachable)";
  }

  // The other registries, by the package name a brand would use. Each has
  // a JSON endpoint that states the project's homepage, which is what makes
  // the package verifiably theirs rather than a namesake.
  const brand = squash(site.brand);
  const registries: [string, string, (data: unknown) => string[]][] = [
    ["pypi", `https://pypi.org/pypi/${brand}/json`, (d) => {
      const info = ((d as { info?: Record<string, unknown> }).info ?? {}) as Record<string, unknown>;
      return [...stringsIn(info.home_page), ...stringsIn(info.project_urls), ...stringsIn(info.project_url)];
    }],
    ["rubygems", `https://rubygems.org/api/v1/gems/${brand}.json`, (d) => stringsIn(d)],
  ];
  for (const [ecosystem, url, urlsOf] of registries) {
    const result = await site.fetch(url, { headers: { Accept: "application/json" } });
    if (result.status !== 200) continue;
    try {
      const urls = urlsOf(JSON.parse(result.body)).filter((u) => /^https?:/.test(u));
      if (urls.some((u) => onDomain(u, site.domain))) ecosystems.add(ecosystem);
    } catch {
      // Not JSON; not a package page.
    }
  }
  // Go has no name lookup, but the <brand>/<brand>-go module convention is
  // near-universal and pkg.go.dev prints the module's homepage on the page.
  const go = await site.fetch(`https://pkg.go.dev/github.com/${brand}/${brand}-go`);
  if (go.status === 200 && go.body.includes(site.domain)) ecosystems.add("go");

  const docs = await findDocs(site);
  const llms = await site.llmsTxt();
  const haystack = [
    ...site.page.links.map((l) => l.href),
    ...(docs ? docs.page.page.links.map((l) => l.href) : []),
    llms?.body ?? "",
  ].join("\n");
  for (const [name, re] of ECOSYSTEM_LINKS) if (re.test(haystack)) ecosystems.add(name);

  const list = [...ecosystems].join(", ");
  if (ecosystems.size >= 3) return pass(3, `SDK packages found across ${ecosystems.size} ecosystems: ${list}`);
  if (ecosystems.size === 2) return warn(2, `SDK packages found in ${list} - add a third ecosystem for full credit`);
  if (ecosystems.size === 1) return warn(1, `SDK package found only in ${list}`);
  const none = `No SDK packages found across language ecosystems${npmNote}`;
  return site.hasApiSignals ? fail(none) : na(none);
};

/* ── webmcp ─────────────────────────────────────────────────────────────── */

const MODEL_CONTEXT = /\bmodelContext\b/;

const webmcp: CheckFn = async (site) => {
  const { page } = site;
  const toolForms = page.forms.filter((f) => f.toolname !== undefined && f.tooldescription !== undefined);
  if (toolForms.length > 0) {
    return pass(5, `Declarative WebMCP API detected (${plural(toolForms.length, "form")} with toolname + tooldescription attributes)`);
  }
  if (page.inlineScripts.some((s) => /modelContext\.(registerTool|provideContext)/.test(s))) {
    return pass(5, "Imperative WebMCP API detected (document.modelContext.registerTool in inline script).");
  }
  const bundles = page.scriptSrcs.filter((src) => onDomain(src, site.domain));
  const scanned = bundles.slice(0, 8);
  const hits = await mapLimit(scanned, 4, async (src) => {
    const result = await site.fetch(src, { maxBytes: 3_000_000 });
    return result.status === 200 && MODEL_CONTEXT.test(result.body) ? src : null;
  });
  const hit = hits.find((h) => h !== null);
  if (hit) return pass(5, `Imperative WebMCP API detected (modelContext registration in ${new URL(hit).pathname})`);
  const scanNote = bundles.length > 0 ? ` (scanned ${scanned.length} of ${bundles.length} same-origin script bundle(s) for modelContext registrations)` : "";
  return fail(`No WebMCP support detected - no tool-attribute forms and no document.modelContext / navigator.modelContext usage found${scanNote}`);
};

export const USABILITY_CHECKS: Record<string, CheckFn> = {
  "agent-friendly-404": agentFriendly404,
  "public-api": publicApi,
  "mcp-server": mcpServer,
  "oauth-support": oauthSupport,
  "json-error-responses": jsonErrorResponses,
  "api-error-model": apiErrorModel,
  "rest-sdk-packages": restSdkPackages,
  "webmcp": webmcp,
};
