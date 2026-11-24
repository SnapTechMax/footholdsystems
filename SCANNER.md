# The AI Visibility Scanner

This tool grades how easily AI assistants (ChatGPT, Claude, Perplexity, Google's AI answers) can find a business's website, read it and recommend it. You give it a domain. It runs 44 checks and returns a score out of 100, a letter grade and a ranked list of what to fix.

It runs on plain Node with no headless browser and no paid AI calls. A scan usually takes 2–10 seconds.

Code: https://github.com/SnapTechMax/footholdsystems. Everything described here is under `src/lib/scan/`.

---

## Try it in two minutes

You need Node 22.13 or newer.

```bash
git clone https://github.com/SnapTechMax/footholdsystems.git
cd footholdsystems
npm install
npm run scan:local -- yourbusiness.com
```

This prints every check with its result, then the report a customer would see. A few variations:

```bash
npm run scan:local -- yourbusiness.com ecommerce   # grade it as an online store
npm run scan:local -- yourbusiness.com --json      # the raw results as JSON
```

The categories are `sbo` (local services, the default), `digital`, `ecommerce`, `saas` and `app`. The next section explains what each one changes.

No API keys are needed to try it. For accurate brand-search results, add a [Serper](https://serper.dev) key to a `.env.local` file (see "Search" below).

---

## What it checks

The 44 checks fall into four groups:

| Group | What it asks | Examples |
|---|---|---|
| **Discovery** | Can an AI find you at all? | Does a search for your business name return your site? Are you on Wikipedia or Wikidata? What does your robots.txt tell AI crawlers? |
| **Access** | Can it read and understand you? | Does your content show without JavaScript? Do you block AI crawlers like ChatGPT-User or ClaudeBot? Do you have a sitemap, structured data (JSON-LD), metadata, pricing, about/contact/privacy pages and llms.txt? |
| **Usability** | Can it operate you? | A sensible 404 page, a public API, an MCP server, OAuth, machine-readable errors |
| **Payments** | Can it pay you? | Support for the new agent payment standards (ACP, UCP, AP2, MPP, x402) |

Each check comes back as one of these:
- **pass**
- **warning:** partly there
- **fail**
- **n/a:** doesn't apply to this site
- **error:** couldn't be measured, for example because the search provider didn't answer. This never counts against the site.

Each result also includes a short note on what the scanner saw, such as "example.com appears at position #1 in a clean brand-name search".

---

## Which checks count depends on the business

A plumber shouldn't be marked down for not having an API, and a software platform shouldn't get an A just because it has a sitemap. So the report scores only the checks that fit the category the business picks:

| Category | Checks scored |
|---|---|
| Local Services | 25 base checks: findability, readability, structured data, trust pages, llms.txt |
| Digital Services (agencies, consultants) | Same 25 |
| eCommerce | Base + the agent-payment checks (bonus only, so they never lower the score) |
| SaaS or platform | Base + 13 developer checks (OpenAPI, API docs, MCP server, OAuth, SDKs…) |
| App or software product | Base + WebMCP + ChatGPT app listing |

The lists are in `src/lib/scan/categories.ts`. A check makes it into a report only if a category includes it **and** it has plain-English copy written for it. That's deliberate: a new check stays out of reports until someone decides it belongs.

---

## How the score and grade work

1. **Score** = points earned ÷ points available, across the checks that count for the category. Checks that came back n/a or error are left out. Bonus checks can add to the score but never lower it. One exception: for SaaS and App, a missing developer check counts as a fail. A platform with no API shouldn't score well just because there was nothing to assess.

2. **Letter grade:** A is 85+, B 70+, C 55+, D 40+, F below 40. These bands are lower than school grades because almost no business has done any of this work yet.

3. **Grade caps.** Some checks are marked *required*. Failing them limits the grade, however high the number is:

   | Situation | Highest possible grade |
   |---|---|
   | 1 required check failing | B |
   | 2 required checks failing | C |
   | 3 or more failing | D |
   | Only partial passes on required checks | B |
   | **The business name search doesn't return the site** | **C**, overriding everything else |

   The name search gets its own rule because it matters most. If an AI looks a business up by name and can't find its site, it can't confirm the business exists, so nothing else in the report matters much. Whenever a cap changes the grade, the report says why.

4. **Findings.** Failing checks are ranked by how many points fixing them would win back, with required checks weighted 1.5×. The report keeps the top 8. Checks that only restate a bigger failure are hidden. For example, "llms.txt is badly formatted" doesn't appear when there's no llms.txt at all.

---

## The free half and the paid half

Every finding has two parts:
- **Free:** what's wrong and what it costs the business ("An AI can't find your site from your business name. When something looks you up by name…").
- **Paid:** how to fix it.

`toPublicReport()` in `src/lib/scan/report.ts` removes the fix text before a report is shown to anyone who hasn't paid. Because the fix text is deleted from the data itself, no page can leak it by mistake. If you want to give the scan away as a lead magnet and sell the fixes, this split is already done for you. If you'd rather give everything away, show the full report instead of the public one.

All the copy, including titles, consequences, fixes and the separate wording for partial passes, is in `src/lib/scan/relevance.ts`. It's the file you'll most want to rewrite in your own voice.

---

## How it works under the hood

```
domain
  │
  ▼
Site.load()          fetch the homepage (https, falling back to http) and follow redirects
  │                  the page it lands on decides where every later request goes
  ▼
44 checks            6 at a time; each URL is fetched once and shared
  │                  (robots.txt, sitemap, llms.txt, ~5 sampled pages, …)
  ▼
raw results          every check with status, points and a note (stored as-is)
  │
  ▼
buildReport()        filter to the category → re-score → grade → cap → rank findings
  │
  ▼
report               score, grade, verdict, summary, up to 8 findings
```

| File | Job |
|---|---|
| `scanner/index.ts` | Entry point: `scanDomain(domain)`. Runs the checks and adds up the score |
| `scanner/site.ts` | Loads the site once and caches every fetch. Works out the business name: structured data first, then `og:site_name`, then the part of the page title that looks most like the domain |
| `scanner/http.ts` | The HTTP client. Never throws, follows redirects itself, 10s timeout, 1.5 MB size cap |
| `scanner/catalog.ts` | The 44 checks: IDs, points, tiers, bonus flags |
| `scanner/discovery.ts`, `access.ts`, `usability.ts`, `payments.ts` | The checks themselves |
| `scanner/search.ts` | Web search for the two search-based checks |
| `categories.ts` | Which checks each category scores |
| `relevance.ts` | Plain-English copy for each check |
| `report.ts` | Scoring, grading, caps and findings |

`scanner/` has no framework dependencies, so you can copy it into any Node project. `report.ts` and `relevance.ts` import `server-only`, a Next.js guard. Outside Next.js, delete that line or stub it the way `scripts/ts-hooks.mjs` does.

**Limits:**
- A whole scan has 45 seconds. A check that runs too long comes back as error instead of holding up the scan.
- A domain that doesn't exist fails permanently. A slow or down site throws an error that's worth retrying later.

---

## Search

Two checks need a web search: the business name search and one developer check. The scanner tries these in order:

1. **Serper** (`SERPER_API_KEY`). Paid, returns Google results. Recommended: it found brand-new sites that Brave's index didn't list at all.
2. **Brave Search API** (`BRAVE_SEARCH_API_KEY`). Has a free tier.
3. **Brave's results page.** Needs no key, but Brave could block it at any time.

If none of them answers, the check comes back as error and is left out of the score. A business is never told it can't be found because the search provider was down.

The report also explains that this is a "cold" search with no login, history or location. Business owners will search their own name, see themselves first and think the report is wrong. The caveat stops that.

---

## Making it yours

If you just want to scan sites, the CLI above is all you need. To put it in your own business:

**Rebrand.** The scanner identifies itself as `FootHoldScan` in `scanner/http.ts` (the user-agent) and in `scanner/access.ts` and `scanner/usability.ts`. Change it to your own name and URL. Site owners see it in their logs.

**Rewrite the copy** in `relevance.ts`. The `fix` text is your product.

**Change the scoring** if you like. Grade bands and caps are at the top of `report.ts`. Category lists are in `categories.ts`.

**The rest of the repo** is one business's sales funnel built around the scanner, and you can borrow pieces of it:
- `src/app/api/scan/route.ts` is the public form handler. It saves the lead with a consent record and limits scans to 3 per IP per hour. It answers the visitor straight away and runs the scan in the background, so nobody waits.
- `src/lib/scan/run.ts` is the background job: claim the scan, run it, store the report, email it.
- `src/app/api/scan/sweep/route.ts` re-runs scans that died partway and re-sends emails that didn't go out. A GitHub Action calls it every 10 minutes.

These parts use Postgres (Neon), Resend for email, Whop for payments and the Meta Conversions API for ads. They're tied to that business's pricing and branding, so treat them as examples rather than something to deploy as-is. The table setup is in `src/lib/scan/db.ts`.

---

## Caveats

- This is a heuristic scanner. It uses `fetch` and pattern matching, not a real browser or an LLM. On the checks that matter for a business website, its results matched a 125-check commercial scanner check for check. Even so, treat it as a strong first read, not an audit.
- The "category share of voice" check (does an AI suggest you when someone asks for what you do) is still in beta and always comes back n/a.
- Sites change. Scan again after making fixes; nothing is cached between runs.
