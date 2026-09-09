/**
 * HTTP for the local scanner.
 *
 * One function, `fetchUrl`, that never throws. Every check in this scanner
 * is a question about how a site answers a request, and "it did not answer"
 * is one of the answers — a check that threw on a connection refused would
 * turn "your site blocks this crawler" into a scan error instead of the
 * finding it is.
 *
 * Redirects are followed by hand rather than by `fetch`, because two checks
 * need the chain itself: redirect-hygiene wants to know about cross-domain
 * hops, and the final URL decides which origin every later probe is made
 * against. Bodies are capped so a 200MB sitemap or a runaway stream cannot
 * hold a serverless invocation open past its deadline.
 *
 * Deliberately free of `server-only`: nothing here touches a secret, and the
 * CLI in scripts/local-scan.ts runs this code under plain Node.
 */

/**
 * Our own User-Agent. Named, with a URL, the way the assistant crawlers are —
 * a site that wants to allow or block us should be able to say so by name.
 */
export const SCANNER_UA =
  "Mozilla/5.0 (compatible; FootHoldScan/1.0; +https://www.footholdsystems.com/)";

const DEFAULT_TIMEOUT_MS = 10_000;
/** Enough for any page, llms.txt or sitemap worth reading; not enough to hurt. */
const DEFAULT_MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 5;

export interface Hop {
  url: string;
  status: number;
}

export interface FetchResult {
  /** What was asked for. */
  url: string;
  /** Where it ended up after redirects. Equal to `url` when there were none. */
  finalUrl: string;
  /** 0 when no HTTP response arrived at all. */
  status: number;
  ok: boolean;
  headers: Headers | null;
  contentType: string;
  body: string;
  truncated: boolean;
  /** Every redirect hop taken, in order. Empty when the first response was final. */
  chain: Hop[];
  /** Set when no response arrived: DNS, TLS, refused, timeout. */
  error?: string;
  ms: number;
}

export interface FetchOptions {
  method?: "GET" | "POST" | "OPTIONS";
  headers?: Record<string, string>;
  body?: string;
  userAgent?: string;
  maxBytes?: number;
  timeoutMs?: number;
  /** Follow redirects (default true). Off when the redirect is the thing being measured. */
  follow?: boolean;
  /** The scan-wide deadline. Combined with the per-request timeout. */
  signal?: AbortSignal;
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function readBody(
  response: Response,
  maxBytes: number
): Promise<{ body: string; truncated: boolean }> {
  if (!response.body) return { body: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (received >= maxBytes) {
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  // UTF-8 regardless of the declared charset. A Latin-1 site comes through
  // with a few mangled accents, which no check here is sensitive to.
  return { body: new TextDecoder("utf-8", { fatal: false }).decode(bytes), truncated };
}

export async function fetchUrl(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const started = Date.now();
  const chain: Hop[] = [];
  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const method = options.method ?? "GET";
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const follow = options.follow ?? true;

  const fail = (error: unknown): FetchResult => ({
    url,
    finalUrl: chain.length ? chain[chain.length - 1].url : url,
    status: 0,
    ok: false,
    headers: null,
    contentType: "",
    body: "",
    truncated: false,
    chain,
    error: error instanceof Error ? error.message : String(error),
    ms: Date.now() - started,
  });

  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await fetch(current, {
        method,
        headers: {
          "User-Agent": options.userAgent ?? SCANNER_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.9,text/plain;q=0.8,*/*;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
        body: options.body,
        redirect: "manual",
        signal,
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        return fail(new Error(`Timed out after ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`));
      }
      // Node wraps the real reason in `cause`; that is the message worth keeping.
      const cause = (error as { cause?: unknown })?.cause;
      return fail(cause instanceof Error ? cause : error);
    }

    if (follow && isRedirect(response.status)) {
      const location = response.headers.get("location");
      if (location) {
        chain.push({ url: current, status: response.status });
        // Discard the redirect body so the socket is released promptly.
        await response.body?.cancel().catch(() => {});
        try {
          current = new URL(location, current).toString();
        } catch {
          return fail(new Error(`Unparseable redirect target: ${location}`));
        }
        continue;
      }
    }

    const { body, truncated } = await readBody(response, maxBytes);
    return {
      url,
      finalUrl: current,
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      contentType: (response.headers.get("content-type") ?? "").toLowerCase(),
      body,
      truncated,
      chain,
      ms: Date.now() - started,
    };
  }

  return fail(new Error(`More than ${MAX_REDIRECTS} redirects`));
}

/**
 * A status-only request. GET with a small body cap rather than HEAD, because
 * enough servers answer HEAD with a 405 or a different status from GET that
 * HEAD measures the server's HEAD handling rather than the page.
 */
export function probe(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  return fetchUrl(url, { maxBytes: 64_000, ...options });
}

/** Hostname with a leading www. removed, for "same site" comparisons. */
export function bareHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function sameSite(a: string, b: string): boolean {
  const ha = bareHost(a);
  const hb = bareHost(b);
  return ha !== "" && ha === hb;
}

/** Whether `url` is on `domain` or one of its subdomains. */
export function onDomain(url: string, domain: string): boolean {
  const host = bareHost(url);
  return host === domain || host.endsWith(`.${domain}`);
}

export function resolveUrl(href: string, base: string): string | null {
  try {
    const resolved = new URL(href, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
}
