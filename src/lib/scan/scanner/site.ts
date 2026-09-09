import {
  fetchUrl,
  onDomain,
  probe,
  resolveUrl,
  sameSite,
  type FetchOptions,
  type FetchResult,
} from "./http";
import { isHtml, nodeTypes, parseHtml, type Link, type ParsedHtml } from "./html";
import { mapLimit } from "./util";

/**
 * Everything the checks share about one site, fetched once.
 *
 * Ora's checks are independent questions that mostly want the same handful
 * of documents — the homepage, robots.txt, the sitemap, llms.txt, a few
 * sampled pages. Forty-four checks each fetching their own copy would be
 * forty-four homepages. So the site is loaded here, every fetch is memoised
 * by URL, and the derived things (which sitemap, which pages to sample,
 * what the brand is called) are computed on first use and kept.
 *
 * The homepage is the one thing loaded eagerly, because nothing else makes
 * sense without it and its final URL decides the origin every later probe
 * is made against: a site that 308s its apex to www gets its well-known
 * files probed on www, which is where they are.
 */

export class ScanError extends Error {
  /** False when trying again later cannot help: the domain does not resolve. */
  readonly retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = "ScanError";
    this.retryable = retryable;
  }
}

export interface RobotsGroup {
  /** Lower-cased user-agent tokens this group applies to. */
  agents: string[];
  allow: string[];
  disallow: string[];
}

export interface RobotsTxt {
  raw: string;
  groups: RobotsGroup[];
  sitemaps: string[];
  /** Cloudflare Content Signals, e.g. { search: "yes", "ai-train": "no" }. */
  contentSignals: Record<string, string> | null;
}

export interface SitemapEntry {
  loc: string;
  lastmod: string | null;
}

export interface SitemapInfo {
  url: string;
  isIndex: boolean;
  /** Child sitemaps listed, when this is an index. */
  childCount: number;
  /** Entries read, capped. From up to three children when this is an index. */
  entries: SitemapEntry[];
}

export interface LoadedPage {
  url: string;
  result: FetchResult;
  page: ParsedHtml;
}

export type TrustPageKind = "about" | "contact" | "privacy";

/** Types Ora reads as "this is what the site is". */
export const IDENTITY_TYPES = new Set([
  "Organization",
  "Corporation",
  "LocalBusiness",
  "SoftwareApplication",
  "WebApplication",
  "MobileApplication",
  "Product",
  "Person",
  "Article",
  "NewsArticle",
  "BlogPosting",
]);

/**
 * Whether a JSON-LD type is an Organization or one of its many subtypes.
 *
 * schema.org has well over a hundred LocalBusiness subtypes and the list
 * grows; matching by name shape (Plumber, RoofingContractor, AutoRepair,
 * MedicalClinic…) catches the ones a real business site uses without
 * needing the whole vocabulary here.
 */
export function isOrganizationType(type: string): boolean {
  if (/^(Organization|Corporation|LocalBusiness|NGO|GovernmentOrganization|EducationalOrganization|MedicalOrganization|SportsOrganization|Airline|Consortium|OnlineBusiness|OnlineStore)$/.test(type)) {
    return true;
  }
  return /(Business|Store|Shop|Service|Contractor|Repair|Dealer|Salon|Clinic|Restaurant|Hotel|Agency|Company|Plumber|Electrician|Locksmith|Attorney|Dentist|Physician|Bakery|Cafe|Bar|Pub|Gym|School|Church|Library|Bank|Brand)$/.test(
    type
  );
}

const MAX_SAMPLED_PAGES = 5;
/** Ora samples up to 500 sitemap entries; so do we. */
const MAX_SITEMAP_ENTRIES = 500;
const MAX_SITEMAP_CHILDREN = 3;

const NON_PAGE_EXTENSION = /\.(pdf|jpe?g|png|gif|webp|svg|mp4|mp3|zip|xml|json|txt|css|js|ico|woff2?)(\?|$)/i;

function parseRobots(raw: string): RobotsTxt {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let contentSignals: Record<string, string> | null = null;
  let current: RobotsGroup | null = null;
  // True while the previous line was a User-agent line, so several in a row
  // share one group, as the spec says they do.
  let collecting = false;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === "user-agent") {
      if (!collecting || !current) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      collecting = true;
      continue;
    }
    collecting = false;
    if (key === "sitemap") {
      sitemaps.push(value);
    } else if (key === "content-signal") {
      contentSignals ??= {};
      for (const pair of value.split(",")) {
        const [k, v] = pair.split("=").map((s) => s.trim().toLowerCase());
        if (k && v) contentSignals[k] = v;
      }
    } else if (current && key === "allow") {
      current.allow.push(value);
    } else if (current && key === "disallow") {
      current.disallow.push(value);
    }
  }
  return { raw, groups, sitemaps, contentSignals };
}

function parseSitemapEntries(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  for (const m of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)) {
    const loc = m[1].match(/<loc\b[^>]*>\s*([\s\S]*?)\s*<\/loc>/i);
    if (!loc) continue;
    const lastmod = m[1].match(/<lastmod\b[^>]*>\s*([\s\S]*?)\s*<\/lastmod>/i);
    entries.push({
      loc: loc[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
      lastmod: lastmod ? lastmod[1].trim() : null,
    });
    if (entries.length >= MAX_SITEMAP_ENTRIES) break;
  }
  return entries;
}

function parseSitemapIndex(xml: string): string[] {
  const locs: string[] = [];
  for (const m of xml.matchAll(/<sitemap\b[^>]*>([\s\S]*?)<\/sitemap>/gi)) {
    const loc = m[1].match(/<loc\b[^>]*>\s*([\s\S]*?)\s*<\/loc>/i);
    if (loc) locs.push(loc[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim());
  }
  return locs;
}

/** Letters and digits only, for fuzzy "is this the brand" comparisons. */
function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export class Site {
  private readonly fetches = new Map<string, Promise<FetchResult>>();
  private readonly memo = new Map<string, Promise<unknown>>();

  private constructor(
    readonly domain: string,
    /** The origin the homepage finally answered from, e.g. https://www.example.com */
    readonly origin: string,
    readonly home: FetchResult,
    readonly page: ParsedHtml,
    readonly signal: AbortSignal
  ) {}

  /**
   * Loads the homepage, or throws.
   *
   * https first, then http, because a site with no TLS at all still exists
   * and still deserves a report — one that will, correctly, say a lot of
   * things are wrong with it. A homepage that answers with nothing readable
   * on either scheme is not a bad site, it is no site, and the scan fails
   * the way an Ora scan of it would.
   */
  static async load(domain: string, signal: AbortSignal): Promise<Site> {
    let home: FetchResult | null = null;
    for (const scheme of ["https", "http"]) {
      const attempt = await fetchUrl(`${scheme}://${domain}/`, { signal });
      if (attempt.status !== 0) {
        home = attempt;
        break;
      }
      // Remember the failure so the http fallback's error can mention https.
      home ??= attempt;
    }
    if (!home || home.status === 0) {
      const reason = home?.error ?? "no response";
      throw new ScanError(`Could not reach ${domain}: ${reason}`, !/ENOTFOUND/i.test(reason));
    }
    if (home.status >= 500) {
      throw new ScanError(`${domain} answered its homepage with HTTP ${home.status}`);
    }

    const origin = new URL(home.finalUrl).origin;
    const page = parseHtml(home.body, home.finalUrl);
    const site = new Site(domain, origin, home, page, signal);
    site.fetches.set(`GET ${SCANNER_KEY} ${home.finalUrl}`, Promise.resolve(home));
    return site;
  }

  /** An absolute URL on the final origin. Absolute inputs pass through. */
  url(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return new URL(pathOrUrl, this.origin).toString();
  }

  /** Fetches once per method, user-agent and URL. */
  fetch(pathOrUrl: string, options: FetchOptions = {}): Promise<FetchResult> {
    const url = this.url(pathOrUrl);
    const key = `${options.method ?? "GET"} ${options.userAgent ?? SCANNER_KEY} ${url}`;
    let pending = this.fetches.get(key);
    if (!pending) {
      pending = fetchUrl(url, { signal: this.signal, ...options });
      this.fetches.set(key, pending);
    }
    return pending;
  }

  probe(pathOrUrl: string, options: FetchOptions = {}): Promise<FetchResult> {
    const url = this.url(pathOrUrl);
    const key = `PROBE ${options.userAgent ?? SCANNER_KEY} ${url}`;
    let pending = this.fetches.get(key);
    if (!pending) {
      pending = probe(url, { signal: this.signal, ...options });
      this.fetches.set(key, pending);
    }
    return pending;
  }

  /** Computes something once and keeps it. */
  once<T>(key: string, compute: () => Promise<T>): Promise<T> {
    let pending = this.memo.get(key) as Promise<T> | undefined;
    if (!pending) {
      pending = compute();
      this.memo.set(key, pending);
    }
    return pending;
  }

  /**
   * Fetches a path and parses it as JSON, or null when it is missing, is
   * HTML (the SPA-shell-for-every-URL case), or does not parse.
   */
  async json(pathOrUrl: string): Promise<{ result: FetchResult; data: unknown } | null> {
    const result = await this.fetch(pathOrUrl);
    if (result.status !== 200 || isHtml(result)) return null;
    try {
      return { result, data: JSON.parse(result.body) };
    } catch {
      return null;
    }
  }

  /** A non-HTML text document at a path, or null. */
  async textFile(pathOrUrl: string, minLength = 1): Promise<FetchResult | null> {
    const result = await this.fetch(pathOrUrl);
    if (result.status !== 200 || isHtml(result)) return null;
    if (result.body.trim().length < minLength) return null;
    return result;
  }

  /** Homepage links that stay on this site (www and apex are one site). */
  get internalLinks(): Link[] {
    return this.page.links.filter((l) => sameSite(l.href, this.origin));
  }

  /** Homepage links on this domain or any subdomain (docs., api., …). */
  get domainLinks(): Link[] {
    return this.page.links.filter((l) => onDomain(l.href, this.domain));
  }

  /**
   * The name a search for this business would use.
   *
   * JSON-LD first, since a site that declared its name in structured data
   * meant it; then og:site_name; then the segment of the <title> that most
   * resembles the domain, which is how "SnapTech Repair | iPhone Repair in
   * Riverside" becomes "SnapTech Repair" rather than the other half.
   */
  get brand(): string {
    return this.once0("brand", () => {
      for (const node of this.page.jsonLd) {
        if (nodeTypes(node).some((t) => isOrganizationType(t) || IDENTITY_TYPES.has(t))) {
          const name = node.name;
          if (typeof name === "string" && name.trim()) return name.trim();
        }
      }
      const siteName = this.page.metas.get("og:site_name");
      if (siteName) return siteName;

      const label = squash(this.domain.split(".")[0]);
      const segments = this.page.title
        .split(/\s*[|•·–—:-]\s*/)
        .map((s) => s.trim())
        .filter((s) => s && !/^(home|homepage|welcome)$/i.test(s));
      if (segments.length > 0) {
        const scored = segments.map((s) => {
          const sq = squash(s);
          const score = sq === label ? 3 : sq.includes(label) || label.includes(sq) ? 2 : 0;
          return { s, score };
        });
        scored.sort((a, b) => b.score - a.score);
        if (scored[0].score > 0) return scored[0].s;
        return segments[0];
      }
      return this.domain.split(".")[0];
    });
  }

  /** Synchronous memo for cheap derived values. */
  private readonly sync = new Map<string, unknown>();
  private once0<T>(key: string, compute: () => T): T {
    if (!this.sync.has(key)) this.sync.set(key, compute());
    return this.sync.get(key) as T;
  }

  robots(): Promise<RobotsTxt | null> {
    return this.once("robots", async () => {
      const result = await this.fetch("/robots.txt");
      if (result.status !== 200 || isHtml(result)) return null;
      return parseRobots(result.body);
    });
  }

  sitemap(): Promise<SitemapInfo | null> {
    return this.once("sitemap", async () => {
      const robots = await this.robots();
      const candidates = [
        ...(robots?.sitemaps ?? []),
        "/sitemap.xml",
        "/sitemap_index.xml",
        "/sitemap-index.xml",
        "/sitemap/sitemap.xml",
      ];
      const seen = new Set<string>();
      for (const candidate of candidates) {
        const url = resolveUrl(candidate, this.origin);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        const result = await this.fetch(url);
        if (result.status !== 200 || isHtml(result)) continue;
        if (/<sitemapindex\b/i.test(result.body)) {
          const children = parseSitemapIndex(result.body);
          const entries: SitemapEntry[] = [];
          const fetched = await mapLimit(children.slice(0, MAX_SITEMAP_CHILDREN), 3, (c) =>
            this.fetch(c)
          );
          for (const child of fetched) {
            if (child.status === 200 && !isHtml(child)) {
              entries.push(...parseSitemapEntries(child.body));
            }
            if (entries.length >= MAX_SITEMAP_ENTRIES) break;
          }
          return {
            url,
            isIndex: true,
            childCount: children.length,
            entries: entries.slice(0, MAX_SITEMAP_ENTRIES),
          };
        }
        if (/<urlset\b/i.test(result.body)) {
          return { url, isIndex: false, childCount: 0, entries: parseSitemapEntries(result.body) };
        }
      }
      return null;
    });
  }

  /** /llms.txt or /.well-known/llms.txt, when it is real text of any length. */
  llmsTxt(): Promise<FetchResult | null> {
    return this.once("llms", async () => {
      for (const path of ["/llms.txt", "/.well-known/llms.txt"]) {
        const result = await this.textFile(path);
        if (result) return result;
      }
      return null;
    });
  }

  /**
   * A handful of pages beyond the homepage, for the checks that ask about
   * "your pages" rather than "your homepage".
   *
   * Pages the homepage links to come first: they are what a crawler reads
   * first, and they are what Ora measures — its six pages on stripe.com were
   * navigation pages, where a sitemap-first sample had picked two 160K-token
   * legal agreements and failed the token budget Ora passed. The sitemap
   * fills in, spread across sections, when the homepage links to little.
   */
  contentPages(): Promise<LoadedPage[]> {
    return this.once("contentPages", async () => {
      const homePath = new URL(this.home.finalUrl).pathname.replace(/\/$/, "");
      const candidates: string[] = [];
      const seenPaths = new Set<string>([homePath, ""]);
      const seenSections = new Set<string>();

      const consider = (raw: string): void => {
        const url = resolveUrl(raw, this.origin);
        if (!url || !sameSite(url, this.origin) || NON_PAGE_EXTENSION.test(url)) return;
        const path = new URL(url).pathname.replace(/\/$/, "");
        if (seenPaths.has(path)) return;
        seenPaths.add(path);
        candidates.push(url);
      };

      for (const link of this.internalLinks) consider(link.href);
      if (candidates.length < MAX_SAMPLED_PAGES) {
        const sitemap = await this.sitemap();
        if (sitemap) {
          const bySection: string[] = [];
          const rest: string[] = [];
          for (const entry of sitemap.entries) {
            const section = new URL(entry.loc, this.origin).pathname.split("/")[1] ?? "";
            (seenSections.has(section) ? rest : bySection).push(entry.loc);
            seenSections.add(section);
          }
          for (const loc of [...bySection, ...rest]) consider(loc);
        }
      }

      const chosen = candidates.slice(0, MAX_SAMPLED_PAGES);
      const loaded = await mapLimit(chosen, 4, async (url) => {
        const result = await this.fetch(url);
        return { url, result, page: parseHtml(result.body, result.finalUrl || url) };
      });
      return loaded;
    });
  }

  /**
   * The about, contact and privacy pages, found the way a visitor would:
   * by following the homepage link that says so, then by trying the usual
   * paths. A page counts only when it is real — 200, HTML, some substance,
   * and not the homepage served under another name.
   */
  trustPages(): Promise<Record<TrustPageKind, LoadedPage | null>> {
    return this.once("trustPages", async () => {
      const spec: Record<TrustPageKind, { path: RegExp; text: RegExp; fallbacks: string[] }> = {
        about: {
          path: /\/(about(-us)?|our-story|who-we-are|company|team)\/?$/i,
          text: /^(about( us)?|our story|who we are|company|meet the team)$/i,
          fallbacks: ["/about", "/about-us", "/about/", "/company"],
        },
        contact: {
          path: /\/contact(-us)?\/?$/i,
          text: /^(contact( us)?|get in touch|reach us)$/i,
          fallbacks: ["/contact", "/contact-us", "/contact/"],
        },
        privacy: {
          path: /privacy/i,
          text: /privacy/i,
          fallbacks: ["/privacy", "/privacy-policy", "/legal/privacy", "/privacy/"],
        },
      };
      const kinds = Object.keys(spec) as TrustPageKind[];
      const found = await mapLimit(kinds, 3, async (kind) => {
        const { path, text, fallbacks } = spec[kind];
        const linked = this.internalLinks
          .filter((l) => path.test(new URL(l.href).pathname) || text.test(l.text.trim()))
          .map((l) => l.href);
        const candidates = [...new Set([...linked, ...fallbacks.map((p) => this.url(p))])];
        for (const url of candidates.slice(0, 4)) {
          const result = await this.fetch(url);
          if (result.status !== 200 || !isHtml(result)) continue;
          const page = parseHtml(result.body, result.finalUrl || url);
          // An /about-us that redirects to the homepage is the site saying
          // the about content lives there, and Ora credits it as the About
          // page (measured). A contact or privacy page that lands on the
          // homepage is just missing.
          const landedOnHome = result.chain.length > 0 && sameSite(result.finalUrl, this.origin) &&
            new URL(result.finalUrl).pathname.replace(/\/$/, "") === new URL(this.home.finalUrl).pathname.replace(/\/$/, "");
          if (this.isHomepageClone(page) && !(kind === "about" && landedOnHome)) continue;
          return { url, result, page };
        }
        return null;
      });
      return { about: found[0], contact: found[1], privacy: found[2] };
    });
  }

  /**
   * Whether a page is the homepage again — the SPA shell served for every path.
   *
   * Compared on the whole text, not the opening of it: every page on a site
   * starts with the same navigation, so two different pages look identical
   * for their first few hundred characters and a real About page was being
   * thrown away as a clone. A shell that swaps the <title> and nothing else
   * is caught by the canonical rule.
   */
  isHomepageClone(page: ParsedHtml): boolean {
    const home = this.page.text;
    if (home.length < 50) return false;
    if (page.text === home) return true;
    if (page.canonical && page.canonical === this.page.canonical) {
      return Math.abs(page.text.length - home.length) < home.length * 0.02;
    }
    return false;
  }

  /**
   * Whether this site sells things online, which decides whether the
   * agentic-commerce checks apply or read N/A the way Ora's do for a
   * consultancy.
   */
  get hasCommerceSignals(): boolean {
    return this.once0("commerce", () => {
      const types = this.page.jsonLd.flatMap(nodeTypes);
      if (types.some((t) => /^(Product|Offer|AggregateOffer|ProductGroup|OnlineStore)$/.test(t))) return true;
      if (this.internalLinks.some((l) => /\/(cart|checkout|collections|products|shop|store)(\/|$)/i.test(new URL(l.href).pathname))) return true;
      if (/add to (cart|bag|basket)/i.test(this.page.text)) return true;
      return /cdn\.shopify\.com|Shopify\.theme|woocommerce|bigcommerce\.com|squarespace-commerce/i.test(this.page.html);
    });
  }

  /** Whether the site presents a developer surface at all. */
  get hasApiSignals(): boolean {
    return this.once0("api", () =>
      this.domainLinks.some(
        (l) =>
          /\b(api|docs|documentation|developers?|sdk|reference)\b/i.test(l.text) ||
          /\/(api|docs|documentation|developers?|reference)(\/|$)/i.test(new URL(l.href).pathname) ||
          /^(api|docs|developers?)\./i.test(new URL(l.href).hostname)
      )
    );
  }
}

/** Cache-key stand-in for the default user agent, so the key stays short. */
const SCANNER_KEY = "*";
