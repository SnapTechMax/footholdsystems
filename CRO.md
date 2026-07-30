# The CRO engine

Pulls Microsoft Clarity data for a sales page, forms a hypothesis about why
visitors aren't handing over an email, runs it as an A/B test, and promotes the
winner. It never asks for approval. Dashboard at `/admin/cro`.

Nothing here runs until the environment variables below are set. Until then the
site behaves exactly as it did before: `/guide` serves its shipped copy and the
dashboard reports what's missing.

## What it can and can't see

**Clarity's API is much thinner than its dashboard.** It gives page-level
aggregates only — no heatmap coordinates, no session recordings, **10 requests
per project per day**, and a **1–3 day** lookback. So the engine can tell that
nobody scrolls far enough to reach the form; it can't tell which headline is
confusing. Clarity generates hypotheses. It never judges them.

**Clarity has no idea who converted.** Conversions come from the Meta pixel
(`Lead`, tagged with a `variant` custom field, read back through the Graph API's
`custom_data_field` aggregation) and, in parallel, from our own records written
in `/api/lead-magnet`.

Those two disagree, and the server-side number is the accurate one. Ad blockers
and browser tracking prevention stop the pixel firing for a meaningful share of
visitors — commonly 15–30%, and not necessarily evenly across variants. The
server-side count sees every submission. Both are shown in the dashboard so the
gap is visible; `conversionSource` decides which one calls winners.

## The traffic problem

Detecting a 30% improvement on a 10% conversion rate needs roughly **1,774
impressions per arm**. A 10% improvement needs about **14,751**. Those aren't
tunable — they're what the arithmetic requires to tell a real change from noise.

A brand-new site does not produce that quickly, so the engine will usually
report "gathering data". That is the system working. An optimiser that rewrote
the page every night on 3-day windows would be reacting to randomness, and would
make the page worse while appearing busy.

Early on, the value is the Clarity diagnostics, not the test results.

## Setup

### 1. Database

Vercel → Storage → Create → Postgres, connect it to the project. That sets
`DATABASE_URL` automatically. Tables are created on first use.

### 2. Clarity API token

Clarity → Settings → Data Export → Generate new API token. Set as
`CLARITY_API_TOKEN`.

### 3. Meta pixel access (optional)

Needs a token with `ads_read` on the Business Manager owning the pixel. Set
`META_ACCESS_TOKEN` and `META_PIXEL_ID` (`1460434995827375`). Without these the
engine falls back to server-side counts and says so in the run log.

### 4. Secrets

- `ADMIN_PASSWORD` — HTTP Basic password for `/admin/cro`. **Without it the
  dashboard returns 503 rather than opening.** Any username works.
- `CRON_SECRET` — Vercel sends this on scheduled invocations. Without it the
  optimiser cannot be triggered at all.

### Full list

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres. Nothing runs without it. |
| `CLARITY_API_TOKEN` | yes | Clarity Data Export API. |
| `ADMIN_PASSWORD` | yes | Gate on `/admin/cro`. |
| `CRON_SECRET` | yes | Authorises the scheduled run. |
| `META_ACCESS_TOKEN` | no | Pixel conversion counts. |
| `META_PIXEL_ID` | no | Pixel conversion counts. |

## How a run works

Cron hits `/api/cro/tick` daily (`vercel.json`). Each run:

1. Skips if disabled, or if less than `intervalHours` has passed. The cron is
   fixed; the UI interval is enforced in the handler.
2. Claims one Clarity call against the 10/day budget, tracked in Postgres so the
   quota is never blown, and stores the snapshot.
3. Judges any running experiment against `conversionSource`:
   - **significant winner** → concluded, winner becomes the new baseline;
   - **challenger badly worse** → rolled back early, without waiting for
     significance. The asymmetry is deliberate: a losing variant costs real leads
     every day it stays up.
   - **otherwise** → left running.
4. If nothing is running, picks the next hypothesis and starts a test.

Rules fire in priority order — scroll depth, rage clicks, dead clicks,
quickbacks, engagement time, then incremental copy. One test at a time, because
splitting traffic further means nothing ever concludes.

Trigger a run by hand:

```bash
curl "https://www.footholdsystems.com/api/cro/tick?secret=YOUR_CRON_SECRET&force=1"
```

## How changes reach the page

Variants are served from the database, not committed to git. A change is live on
the next request and a rollback is one row — nothing waits on a deploy, and a bad
variant can't break the build. `src/lib/cro/variants.ts` holds the shipped
defaults and the library of alternatives; that file is the thing to edit to give
the engine more to try.

`/guide` is `force-dynamic` as a result. If the database is unreachable, the page
falls back to the shipped copy rather than failing.

## Guardrails

None of these ask you anything. They exist so unattended changes stay survivable.

- No winner is called below `minImpressionsPerArm` (default 300) **and**
  statistical significance.
- Automatic revert when a challenger is `rollbackDropPct` worse (default 40%),
  once each arm has cleared a floor of impressions.
- Only fields listed in `VariantContent` can change. The engine cannot touch
  anything else on the page.
- One experiment at a time.
- Clarity budget is tracked so the API quota can't be exhausted.
- Impressions are deduplicated per visitor, so reloads don't dilute the rate.
