import { searchWeb } from "../src/lib/scan/scanner/search";

/**
 * Checks that the search queue paces Brave and nothing else.
 *
 *   npm run scan:pacing
 *
 * Every scan makes two web searches, so whatever paces a search paces the
 * whole scanner. The queue in search.ts exists because Brave 429s two
 * simultaneous requests from one IP; when it also wrapped Serper it became
 * the throughput ceiling of everything, and raising the outreach caller's
 * concurrency did nothing at all. This drives searchWeb against a stubbed
 * fetch and times it, so that cannot come back unnoticed.
 *
 * No network: `fetch` is replaced for the duration.
 */

const GAP_MS = 1_500;
const LATENCY_MS = 120;

type Reply = { status: number; body: string };
let handler: (url: string) => Reply;
let calls: string[] = [];

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  calls.push(url);
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  const { status, body } = handler(url);
  return new Response(body, { status, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const SERPER_OK = JSON.stringify({ organic: [{ link: "https://example.com", title: "Example" }] });
const BRAVE_HTML = '<a class="l1" href="https://example.com">Example</a>';

let pass = 0, fail = 0;
const t = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`, extra ?? ""); }
};

const reset = (h: (url: string) => Reply) => { handler = h; calls = []; };
const timed = async <T,>(fn: () => Promise<T>): Promise<[T, number]> => {
  const at = Date.now();
  const out = await fn();
  return [out, Date.now() - at];
};
const fanOut = (n: number) =>
  Promise.all(Array.from({ length: n }, (_, i) => searchWeb(`query ${i}`)));

console.log("\n— Serper, the healthy path —");
{
  process.env.SERPER_API_KEY = "test-key";
  delete process.env.BRAVE_SEARCH_API_KEY;
  reset(() => ({ status: 200, body: SERPER_OK }));
  const N = 8;
  const [results, ms] = await timed(() => fanOut(N));
  t("every search answered", results.every((r) => r?.provider === "serper"), results.map((r) => r?.provider));
  t("one request each", calls.length === N, calls.length);
  // Queued, this would be N * (latency + 1.5s) — about 13 seconds.
  t(`${N} searches run concurrently, not one at a time`, ms < LATENCY_MS + GAP_MS, `${ms}ms`);
  console.log(`      ${N} concurrent Serper searches took ${ms}ms (queued would be ~${N * (LATENCY_MS + GAP_MS)}ms)`);
}

console.log("\n— Serper rate-limited —");
{
  process.env.SERPER_API_KEY = "test-key";
  let seen = 0;
  reset(() => (++seen <= 2 ? { status: 429, body: "" } : { status: 200, body: SERPER_OK }));
  const [result] = await timed(() => searchWeb("rate limited"));
  t("a 429 is waited out rather than abandoned", result?.provider === "serper", result);
  t("it asked Serper again instead of falling to Brave", calls.every((u) => u.includes("serper")), calls);
}

console.log("\n— Serper down, so Brave carries it —");
{
  process.env.SERPER_API_KEY = "test-key";
  reset((url) => (url.includes("serper") ? { status: 500, body: "" } : { status: 200, body: BRAVE_HTML }));
  const N = 3;
  const [results, ms] = await timed(() => fanOut(N));
  t("Brave answers", results.every((r) => r?.provider === "brave-html"), results.map((r) => r?.provider));
  // The whole point of the queue: these must NOT be simultaneous.
  t(`${N} Brave searches are still paced one at a time`, ms > (N - 1) * GAP_MS, `${ms}ms`);
  console.log(`      ${N} concurrent Brave searches took ${ms}ms (a gap of ${GAP_MS}ms between each)`);
}

console.log("\n— no Serper key at all —");
{
  delete process.env.SERPER_API_KEY;
  reset(() => ({ status: 200, body: BRAVE_HTML }));
  const [results, ms] = await timed(() => fanOut(2));
  t("Brave answers", results.every((r) => r?.provider === "brave-html"));
  t("and is still paced", ms > GAP_MS, `${ms}ms`);
}

globalThis.fetch = realFetch;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
