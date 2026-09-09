import { scanDomain } from "../src/lib/scan/scanner";

/**
 * Checks that Wikidata is asked carefully.
 *
 *   npm run scan:wikidata
 *
 * Wikidata rate-limited this deployment (429) once the outreach caller began
 * holding many crawls open. The cause was not the crawl rate: it was that a
 * scan asked Wikidata up to seven times to establish that a local business
 * has no entry, and nothing bounded how many of those went out at once.
 * These are the three guards in discovery.ts, driven through the real
 * scanDomain against a stubbed fetch.
 *
 * No network: `fetch` is replaced for the duration.
 */

let pass = 0, fail = 0;
const t = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`, extra ?? ""); }
};

const HTML = "<html><head><title>Smith Tax Service</title></head><body><h1>Smith Tax Service</h1></body></html>";
const SERPER = JSON.stringify({ organic: [{ link: "https://smithtax.com", title: "Smith Tax Service" }] });
const WD_SEARCH = JSON.stringify({ query: { search: [{ title: "Q42" }] } });
const WD_NAMES = JSON.stringify({ search: [{ id: "Q1" }, { id: "Q2" }, { id: "Q3" }, { id: "Q4" }, { id: "Q5" }] });
const WD_ENTITY = JSON.stringify({ entities: { Q42: { labels: { en: { value: "Smith" } }, sitelinks: {}, claims: {} } } });

let wd: string[] = [];
let wdStatus = 200;
let wdDelayMs = 0;
let live = 0, peak = 0;

const real = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("wikidata.org")) {
    wd.push(url);
    live++; peak = Math.max(peak, live);
    if (wdDelayMs) await new Promise((r) => setTimeout(r, wdDelayMs));
    live--;
    const body = url.includes("wbgetentities") ? WD_ENTITY : url.includes("wbsearchentities") ? WD_NAMES : WD_SEARCH;
    return new Response(body, { status: wdStatus, headers: { "content-type": "application/json" } });
  }
  if (url.includes("serper.dev")) return new Response(SERPER, { status: 200, headers: { "content-type": "application/json" } });
  return new Response(HTML, { status: 200, headers: { "content-type": "text/html" } });
}) as typeof fetch;

process.env.SERPER_API_KEY = "test-key";
const reset = () => { wd = []; peak = 0; live = 0; };
const kind = (u: string) => u.includes("wbgetentities") ? "entity" : u.includes("wbsearchentities") ? "name-search" : "website-claim";

console.log("\n— a local business is not asked about at all —");
{
  reset();
  await scanDomain("smithtax.com", { category: "sbo" });
  t("zero Wikidata requests for an sbo scan", wd.length === 0, wd.map(kind));
  console.log(`      sbo scan made ${wd.length} Wikidata requests (was up to 7)`);
}

console.log("\n— a category that could have an entry still asks —");
{
  reset();
  await scanDomain("smithtax.com", { category: "saas" });
  t("it does ask", wd.length > 0, wd.length);
  const entities = wd.filter((u) => u.includes("wbgetentities")).length;
  const names = wd.filter((u) => u.includes("wbsearchentities")).length;
  t("only one candidate is read back, not four", entities <= 2, { entities, names, calls: wd.map(kind) });
  console.log(`      saas scan made ${wd.length} Wikidata requests (${entities} entity reads)`);
}

console.log("\n— concurrent scans do not arrive all at once —");
{
  reset();
  wdDelayMs = 30;
  await Promise.all([
    scanDomain("smithtax.com", { category: "saas" }),
    scanDomain("smithtax.com", { category: "saas" }),
    scanDomain("smithtax.com", { category: "saas" }),
  ]);
  wdDelayMs = 0;
  t("never more than three Wikidata requests in flight", peak <= 3, `peak was ${peak}`);
  console.log(`      three concurrent scans peaked at ${peak} simultaneous Wikidata requests`);
}

console.log("\n— a 429 stops everyone asking —");
{
  reset();
  wdStatus = 429;
  await scanDomain("smithtax.com", { category: "saas" });
  const first = wd.length;
  t("it stops after the refusal instead of trying the next spelling", first === 1, `${first} requests`);
  reset();
  await scanDomain("smithtax.com", { category: "saas" });
  t("and the next scan does not ask at all while the cooldown holds", wd.length === 0, wd.length);
  console.log(`      first rate-limited scan made ${first} request, the next made ${wd.length}`);
  wdStatus = 200;
}

globalThis.fetch = real;
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
