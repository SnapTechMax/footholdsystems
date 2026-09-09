import type { FetchResult } from "./http";
import { resolveUrl } from "./http";

/**
 * HTML reading for the local scanner, without a DOM.
 *
 * Every check here asks a coarse question of a page — is there an H1, what
 * are the JSON-LD blocks, which links point where, how much text is there
 * once the markup is gone. Regular expressions answer all of those on real
 * pages well enough, and they answer them with no dependency, which is the
 * point: this scanner exists as a fallback, and a fallback that pulls in a
 * parser the rest of the site does not use is one more thing to break.
 *
 * What this is not is a browser. Nothing runs JavaScript, which is correct
 * rather than a limitation: the crawlers being modelled do not run it either,
 * and content-no-js exists to measure exactly that.
 */

export interface Link {
  href: string;
  text: string;
}

export interface Heading {
  level: number;
  text: string;
}

export interface ParsedHtml {
  html: string;
  /** Visible text with scripts, styles and markup removed. */
  text: string;
  title: string;
  lang: string | null;
  canonical: string | null;
  /** Lower-cased name/property → content. Last one wins on duplicates. */
  metas: Map<string, string>;
  /** Absolute http(s) links, in document order. */
  links: Link[];
  headings: Heading[];
  /** Every JSON-LD node, with @graph containers flattened. */
  jsonLd: Record<string, unknown>[];
  jsonLdBlockCount: number;
  /** Attribute maps of every <form>. */
  forms: Record<string, string>[];
  inlineScripts: string[];
  /** Absolute src of every external script. */
  scriptSrcs: string[];
  hasMetaRefresh: boolean;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Parses the attributes inside one tag: `a="1" b='2' c=3 d`. */
export function parseAttrs(tagInner: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tagInner))) {
    const name = m[1].toLowerCase();
    attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

const BLOCK_TAGS =
  "p|div|section|article|header|footer|nav|aside|main|h[1-6]|li|ul|ol|table|tr|td|th|br|hr|blockquote|pre|form|fieldset|dl|dt|dd|figure|figcaption|address|details|summary";

/** Visible text: no scripts, styles, hidden template content or tags. */
export function extractText(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(cleaned)
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

/** Strips tags from a fragment such as a heading's inner HTML. */
function innerText(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function flattenJsonLd(value: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const item of value) flattenJsonLd(item, out);
    return;
  }
  if (!value || typeof value !== "object") return;
  const node = value as Record<string, unknown>;
  out.push(node);
  if (Array.isArray(node["@graph"])) flattenJsonLd(node["@graph"], out);
}

export function parseHtml(html: string, baseUrl: string): ParsedHtml {
  const metas = new Map<string, string>();
  for (const m of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const attrs = parseAttrs(m[1]);
    const key = (attrs.property ?? attrs.name ?? attrs["http-equiv"] ?? "").toLowerCase();
    if (key && attrs.content !== undefined) metas.set(key, attrs.content.trim());
  }

  let canonical: string | null = null;
  for (const m of html.matchAll(/<link\b([^>]*)>/gi)) {
    const attrs = parseAttrs(m[1]);
    if (/(^|\s)canonical(\s|$)/i.test(attrs.rel ?? "") && attrs.href) {
      canonical = resolveUrl(attrs.href, baseUrl);
      break;
    }
  }

  const links: Link[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = parseAttrs(m[1]);
    if (!attrs.href) continue;
    const href = resolveUrl(attrs.href, baseUrl);
    if (!href) continue;
    links.push({ href, text: innerText(m[2]).slice(0, 200) });
  }

  const headings: Heading[] = [];
  for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    headings.push({ level: Number(m[1]), text: innerText(m[2]).slice(0, 200) });
  }

  const jsonLd: Record<string, unknown>[] = [];
  let jsonLdBlockCount = 0;
  const inlineScripts: string[] = [];
  const scriptSrcs: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = parseAttrs(m[1]);
    const type = (attrs.type ?? "").toLowerCase();
    if (type.includes("ld+json")) {
      jsonLdBlockCount++;
      try {
        // Some sites leave an HTML comment wrapper or a trailing semicolon in
        // the block; strip the two most common before giving up on it.
        const raw = m[2].replace(/^\s*<!--/, "").replace(/-->\s*$/, "").trim().replace(/;$/, "");
        flattenJsonLd(JSON.parse(raw), jsonLd);
      } catch {
        // A malformed block is still a block; it just contributes no nodes.
      }
      continue;
    }
    if (attrs.src) {
      const src = resolveUrl(attrs.src, baseUrl);
      if (src) scriptSrcs.push(src);
    } else if (m[2].trim()) {
      inlineScripts.push(m[2]);
    }
  }

  const forms: Record<string, string>[] = [];
  for (const m of html.matchAll(/<form\b([^>]*)>/gi)) forms.push(parseAttrs(m[1]));

  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const langMatch = html.match(/<html\b[^>]*\blang\s*=\s*["']?([a-zA-Z-]+)/i);

  return {
    html,
    text: extractText(html),
    title: titleMatch ? innerText(titleMatch[1]) : "",
    lang: langMatch ? langMatch[1] : null,
    canonical,
    metas,
    links,
    headings,
    jsonLd,
    jsonLdBlockCount,
    forms,
    inlineScripts,
    scriptSrcs,
    hasMetaRefresh: /<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i.test(html),
  };
}

export function isHtml(result: FetchResult): boolean {
  if (result.contentType.includes("text/html") || result.contentType.includes("xhtml")) {
    return true;
  }
  // Servers that send text/plain for an HTML shell are common enough to check
  // the body too — an llms.txt that is really the homepage must not count.
  return /^\s*(<!doctype\s+html|<html\b)/i.test(result.body.slice(0, 300));
}

/**
 * Whether a response is a bot-protection wall rather than the page.
 *
 * Status alone is not enough: Cloudflare's managed challenge is a 403 or a
 * 503, but some WAFs serve the interstitial with a 200. The markers are the
 * phrases those pages actually contain.
 */
export function looksBlocked(result: FetchResult): boolean {
  if (result.status === 0) return false; // no response is not a block, it is unreachable
  if (result.status === 403 || result.status === 429 || result.status === 503) return true;
  if (result.status === 401) return true;
  const head = result.body.slice(0, 20_000);
  return /just a moment|attention required|cf-browser-verification|cf_chl_|cf-challenge|verify you are human|enable javascript and cookies to continue|access denied|ddos-guard|_Incapsula_Resource|px-captcha|perimeterx|are you a robot|unusual traffic from your/i.test(
    head
  );
}

/* ── JSON-LD helpers ──────────────────────────────────────────────────────── */

/** `@type` as a list, whether it was a string, an array, or absent. */
export function nodeTypes(node: Record<string, unknown>): string[] {
  const type = node["@type"];
  if (typeof type === "string") return [type];
  if (Array.isArray(type)) return type.filter((t): t is string => typeof t === "string");
  return [];
}

/** True when a value is present and not an empty string/array/object. */
export function has(node: Record<string, unknown>, key: string): boolean {
  const value = node[key];
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Every string inside a value, however nested. For sameAs and url fields. */
export function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const v of value) stringsIn(v, out);
  else if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) stringsIn(v, out);
  }
  return out;
}
