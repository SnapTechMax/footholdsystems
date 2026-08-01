# Foothold automation

Two systems: the nurture sequence, and the CRO engine that optimises the page
feeding it.

## Lead capture

When someone downloads the guide, `/api/lead-magnet`:

1. **Rejects the request** if the consent box was not ticked. The guide is gated
   behind it.
2. **Sends the guide.**
3. **Records the consent** in `marketing_consent`.
4. **Enrols them in the sequence.**
5. **Emails Max** that a lead came in.

Steps 3 to 5 run only after the guide has actually sent, and are best-effort: a
failure there must not turn a successful download into an error for the person
who asked.

## Consent

The checkbox is unticked by default, and **required or not depending on where the
visitor is**. Unticked because pre-ticking it would remove the affirmative action
that makes the record worth anything.

`src/lib/geo.ts` reads Vercel's `x-vercel-ip-country` header. In the EU 27, the
UK, the rest of the EEA and Switzerland the tick is optional and the wording
changes to say the guide is theirs either way. Everywhere else it is required.
An unknown country is treated as required, matching the US default: erring that
way costs a conversion, erring the other way collects consent that is not valid.

Both wordings are stored verbatim with the consent record, which is how the
difference stays provable later.

The gate is enforced server-side as well as with the `required` attribute. The
route is a public endpoint, so a browser attribute alone would not be a gate.

Two things worth knowing about this arrangement:

- **US law permits it.** CAN-SPAM requires accurate headers, a postal address and
  a working unsubscribe; it does not require prior consent at all.
- **GDPR does not**, which is why the gate is switched off there. Article 7(4)
  says consent is not freely given where a service is conditional on consenting to
  processing that is not necessary for it, so a forced tick would produce invalid
  consent however it is worded.

Separately from the law, an email provider's own terms are stricter and are what
actually ended the MailerLite account. Whether a required tick counts as
agreement is the provider's call.

`marketing_consent` stores the **exact wording shown**, not just a boolean, plus
IP, user agent and timestamp. Wording changes over time, and "they ticked a box"
is worth little if nobody can say what the box said at the time. The table is
append-only, so a later withdrawal is a new row and the history stays intact.

`CONSENT_TEXT` lives in `src/lib/site.ts` because `lib/consent.ts` is server-only
and the form is a client component. Both import the same constant, so what is
shown and what is stored cannot drift.

Declines are recorded too. Being able to prove someone said no matters as much as
proving they said yes.

## The sequence

22 emails over 38 days. Copy in `content/nurture-sequence.mjs`;
`scripts/create-email-sequence.mjs` pushes it to Resend as templates plus an
automation.

```bash
RESEND_API_KEY=re_xxx node scripts/create-email-sequence.mjs --dry-run
RESEND_API_KEY=re_xxx node scripts/create-email-sequence.mjs
```

Created **disabled**. Resend does not allow an enabled automation's steps to be
edited, so changes mean duplicating 67 steps and switching over.

Triggered by the `guide.downloaded` event, which is only sent for people who
opted in.

### Booked contacts

`/api/calendly/webhook` sets a `booked` contact property on `invitee.created` and
clears it on `invitee.canceled`. A condition before every send ends the run for
anyone marked booked, so a booking on any of the 38 days stops the rest.
`SUPPRESS_AFTER_BOOKING=0` drops those checks, which is the fallback if the
automation is rejected for size.

The endpoint fails closed: 503 with no `CALENDLY_WEBHOOK_SECRET`, 401 on anything
that does not verify. Signatures are checked over the raw body, compared in
constant time, and rejected beyond five minutes so a captured payload cannot be
replayed. **Confirm the scheme with one real test booking**: a mismatch appears in
the logs as `Calendly webhook rejected: signature did not match`.

---

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

Vercel → Storage → Create → Postgres, connect it to the project. Tables are
created on first use.

The integration namespaces the variables it creates, so the connection string
may arrive as `STORAGE_DATABASE_URL` rather than `DATABASE_URL` — this project's
did. Each name is checked bare and with the `STORAGE_` and `NEON_` prefixes, so
either works; the dashboard header shows which one it connected through.

### 2. Clarity API token

Clarity → Settings → Data Export → Generate new API token. Set as
`CLARITY_API_TOKEN`.

### 3. Meta pixel access (optional)

Needs a token with `ads_read` on the Business Manager owning the pixel. Set
`META_ACCESS_TOKEN` and `META_PIXEL_ID` (`1149312161102608`). Without these the
engine falls back to server-side counts and says so in the run log.

### 4. Secrets

- `ADMIN_PASSWORD` — HTTP Basic password for `/admin/cro`. **Without it the
  dashboard returns 503 rather than opening.** Any username works.
- `CRON_SECRET` — Vercel sends this on scheduled invocations. Without it the
  optimiser cannot be triggered at all.

### Full list

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` or `STORAGE_DATABASE_URL` | yes | Postgres. Nothing runs without it. |
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

---

# Campaign dashboard

`/admin/campaign`, behind the same gate as the CRO dashboard.

Two sources, because neither is the whole picture. **Our database** knows who
downloaded and who consented, including the people who declined and were
therefore never enrolled. **Resend** knows who is in the sequence and how far
each has got.

Needs `RESEND_AUTOMATION_ID`, printed when `scripts/create-email-sequence.mjs`
runs. Without it the top half still works and the sequence half stays at zero.

Resend's list endpoint returns run status but not steps, so the per-email funnel
fetches runs individually and is capped at 50. Past that the dashboard says it is
showing a sample rather than quietly reporting a fraction as the total.

## Opens and clicks

Not shown, because Resend's API exposes neither for automations. Every link in
every email instead carries `utm_campaign` identifying the email and
`utm_content` identifying the link within it, so click-through is in GA4 under
Acquisition rather than here.

`scripts/build-sequence-steps.mjs` regenerates `src/lib/sequence-steps.ts` from
the copy. Run it after changing subjects or delays, or the funnel labels drift
from the emails actually being sent.
