import { decodeEntities } from "./html";
import { fetchUrl } from "./http";

/**
 * Web search for the two Discovery checks that need one.
 *
 * Ora runs brand-name and developer-resource searches against a search
 * index it pays for. We have three ways to get the same answer, tried in
 * order:
 *
 *   Serper             — SERPER_API_KEY. Google results by proxy; paid, and
 *                        the one whose answers match Ora's. Ora put a
 *                        three-week-old site first for its own name; Brave's
 *                        index did not list it at all, so a Brave key alone
 *                        would fail the foundational check on exactly the
 *                        new businesses this funnel is for.
 *   Brave Search API   — BRAVE_SEARCH_API_KEY. Free tier, JSON, a stated
 *                        rate limit; Brave's index, with the gap above.
 *   Brave's HTML       — keyless. Their results page, parsed. It answered
 *                        correctly from a plain fetch when this was written
 *                        (DuckDuckGo and Bing both served bot walls or junk
 *                        to the same request) and nobody has promised it
 *                        will keep doing so.
 *
 * `searchWeb` returns null when nothing answered, and the checks that call
 * it turn null into an `error` status — excluded from the score — rather
 * than a failure. A business must never be told it is unfindable because
 * our search provider was.
 */

export interface SearchHit {
  url: string;
  title: string;
}

export interface SearchResult {
  provider: "brave" | "serper" | "brave-html";
  hits: SearchHit[];
}

export interface SearchOptions {
  signal?: AbortSignal;
  count?: number;
}

/** A search engine that has not answered in 8s is not going to. */
const SEARCH_TIMEOUT_MS = 8_000;

/** A desktop browser, for the HTML fallback. The APIs get our real UA. */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

async function braveApi(
  query: string,
  key: string,
  count: number,
  signal?: AbortSignal
): Promise<SearchResult | null> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&safesearch=off`;
  const result = await fetchUrl(url, {
    signal,
    timeoutMs: SEARCH_TIMEOUT_MS,
    headers: { Accept: "application/json", "X-Subscription-Token": key },
  });
  if (result.status !== 200) return null;
  try {
    const data = JSON.parse(result.body) as { web?: { results?: { url?: string; title?: string }[] } };
    const hits = (data.web?.results ?? [])
      .filter((r): r is { url: string; title?: string } => typeof r.url === "string")
      .map((r) => ({ url: r.url, title: r.title ?? "" }));
    return { provider: "brave", hits };
  } catch {
    return null;
  }
}

async function serperApi(
  query: string,
  key: string,
  count: number,
  signal?: AbortSignal
): Promise<SearchResult | null> {
  for (let attempt = 0; attempt < SERPER_RETRY_WAITS_MS.length + 1; attempt++) {
    const result = await fetchUrl("https://google.serper.dev/search", {
      signal,
      timeoutMs: SEARCH_TIMEOUT_MS,
      method: "POST",
      headers: { "X-API-KEY": key, Accept: "application/json" },
      body: JSON.stringify({ q: query, num: count }),
    });
    // Being told to slow down is not a reason to give up on Serper. Falling
    // through would put this search into the Brave queue below — the very
    // thing scans are being kept out of — so it waits and asks again.
    if (result.status === 429 && attempt < SERPER_RETRY_WAITS_MS.length) {
      await sleep(SERPER_RETRY_WAITS_MS[attempt]);
      continue;
    }
    if (result.status !== 200) return null;
    try {
      const data = JSON.parse(result.body) as { organic?: { link?: string; title?: string }[] };
      const hits = (data.organic ?? [])
        .filter((r): r is { link: string; title?: string } => typeof r.link === "string")
        .map((r) => ({ url: r.link, title: r.title ?? "" }));
      return { provider: "serper", hits };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Pulls the organic results out of Brave's results page.
 *
 * Each result's primary link carries an `l1` class; sitelinks, video cards
 * and the AI-answer header do not, which is how the ordering below matches
 * what a person sees rather than every link on the page.
 */
export function parseBraveHtml(html: string): SearchHit[] {
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b([^>]*?)href="(https?:\/\/[^"]+)"([^>]*)>([\s\S]*?)<\/a>/g)) {
    const cls = `${m[1]} ${m[3]}`.match(/class="([^"]*)"/)?.[1] ?? "";
    if (!/(^|\s)l1(\s|$)/.test(cls)) continue;
    const url = decodeEntities(m[2]);
    if (/^https?:\/\/([a-z0-9-]+\.)*brave\.com\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    hits.push({
      url,
      title: decodeEntities(m[4].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 200),
    });
  }
  return hits;
}

async function braveHtml(query: string, count: number, signal?: AbortSignal): Promise<SearchResult | null> {
  const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
  for (let attempt = 0; attempt < RETRY_WAITS_MS.length + 1; attempt++) {
    const result = await fetchUrl(url, {
      signal,
      timeoutMs: SEARCH_TIMEOUT_MS,
      userAgent: BROWSER_UA,
      headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
      maxBytes: 2_000_000,
    });
    if (result.status === 429 && attempt < RETRY_WAITS_MS.length) {
      await sleep(RETRY_WAITS_MS[attempt]);
      continue;
    }
    if (result.status !== 200) return null;
    const hits = parseBraveHtml(result.body);
    if (hits.length === 0 && /captcha|unusual traffic|verify you are human/i.test(result.body)) return null;
    return { provider: "brave-html", hits: hits.slice(0, count) };
  }
  return null;
}

/**
 * The BRAVE endpoints run one at a time, with a pause between them.
 *
 * Brave's HTML endpoint answered two simultaneous requests from one IP with
 * a 429 for both (measured), and the API tier meters by the second. The queue
 * is module-wide, so concurrent scans in one process share it.
 *
 * Serper deliberately does NOT go through it. It is a paid API built for
 * concurrent callers and it is tried first, so queueing it made this gap the
 * throughput ceiling of the entire scanner rather than a guard on a free
 * endpoint: two searches per scan, one at a time, 1.5s apart, is three
 * seconds of dead wall-clock in every scan and roughly twenty scans a minute
 * per process — however many crawls the caller opens. The outreach caller
 * went from eight concurrent crawls to a hundred and nothing moved, because
 * every one of them was waiting on this chain. Scoping it to Brave is what
 * lets concurrency mean anything.
 */
const GAP_MS = 1_500;
/** Waits before the second and third try. One 4s pause was not enough. */
const RETRY_WAITS_MS = [3_000, 6_000];
/** Serper meters per call rather than per second, so these are short. */
const SERPER_RETRY_WAITS_MS = [400, 1_200];
let queue: Promise<unknown> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => sleep(GAP_MS),
    () => sleep(GAP_MS)
  );
  return run;
}

export function searchWeb(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult | null> {
  return search(query, options);
}

async function search(query: string, options: SearchOptions): Promise<SearchResult | null> {
  const count = options.count ?? 10;

  // Unqueued: as many scans as are running may be inside Serper at once.
  const serper = process.env.SERPER_API_KEY;
  if (serper) {
    const result = await serperApi(query, serper, count, options.signal);
    if (result) return result;
  }

  // Brave, one at a time. Reached only when Serper is unset or did not
  // answer, so on a healthy deployment this chain stays empty.
  return enqueue(async () => {
    const brave = process.env.BRAVE_SEARCH_API_KEY;
    if (brave) {
      const result = await braveApi(query, brave, count, options.signal);
      if (result) return result;
    }
    return braveHtml(query, count, options.signal);
  });
}
