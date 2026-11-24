# How footholdsystems works

This repo runs footholdsystems.com, the website for FootHold AEO. It covers the sales page, the free AI-visibility scan, the paid reports, checkout, the email sequence, ad tracking, cold outreach and the admin screens.

It's one Next.js 16 app (React 19, Tailwind 4, TypeScript), deployed on Vercel. Data is in Neon Postgres, email goes through Resend, payments through Whop, ad tracking through Meta, and bookings through Calendly.

Related docs:
- [SCANNER.md](SCANNER.md): the scanner in depth, written to share
- [SEQUENCE.md](SEQUENCE.md): the 22-email nurture sequence
- [TRACKING.md](TRACKING.md): email click and open tracking
- [BOOKING.md](BOOKING.md): Calendly setup

---

## 1. What's being sold

All prices live in one file, [src/lib/scan/pricing.ts](src/lib/scan/pricing.ts). Change them there and nowhere else. Every page, email, llms.txt and checkout reads from it.

| Tier | Price | How it's sold |
|---|---|---|
| **Fix list** ("solutions") | $49 | On the scan report: unlock the blurred fixes |
| **The Fix** ("done_for_you") | $1,500 one-off ($750 of it non-refundable on cancel) | On the report below the paywall, on the page after a $49 purchase, and in the nurture emails |
| **Get Picked** (retainer) | $1,500 setup ($3,000 without The Fix) + $1,800/month, 6-month contract | Only on the handover page after The Fix is delivered. Sold over a call, not through checkout |

The positioning and voice are in [context/](context/): `company.md`, `customer.md`, `offer.md` and `voice.md`. Page copy and the creative generator are written from these. `offer.md` is dated 2026-08-26 and still says $1,497 in places. The code is the source of truth for prices.

---

## 2. The customer journey

```
Meta ad
  └─► Home page (/)  ── form: website + email + business type
        └─► POST /api/scan ──► lead saved, scan queued, nurture sequence starts
              ├─► /scan/thanks       "check your email" (Meta Lead fires here)
              └─► background: crawl → report → email with link to /scan/<token>

/scan/<token>   report with the fixes blurred
  ├─► "Unlock the fixes – $49"   ──► /api/go/checkout ──► Whop ──► /scan/<token>/next
  └─► "Start The Fix – $1,500"   ──► /api/go/checkout ──► Whop ──► /scan/<token>/booked

/scan/<token>/next     the $49 buyer: link to the fixes, then the $1,500 pitch
/scan/<token>/booked   the $1,500 buyer: payment confirmed, book the kickoff call
/start                 intake form you send to a Fix customer by hand
/scan/<token>/complete handover page once the work is done (the only place the retainer is offered)
```

**There are no logins.** The token in the URL (32 random bytes) is the only key to a report. Anyone with the link can open it.

### Step by step

1. **Home page** ([src/app/page.tsx](src/app/page.tsx)). The single long sales page for cold Meta traffic, ending in the scan form ([ScanForm.tsx](src/components/ScanForm.tsx)). The copy sits in data blocks at the top of the file. Don't reorder the sections casually: the order is problem → mechanism → objections → offer on purpose.

2. **Scan request** ([src/app/api/scan/route.ts](src/app/api/scan/route.ts)):
   - Spam: a hidden honeypot field and a minimum time to fill in the form. Bots get a fake "ok".
   - Limits: 3 per IP per hour (refused), 8 a minute or 500 a day (still accepted, but left for the sweeper), 2,000 a day (refused, and a push notification goes to your phone).
   - It saves the lead with the exact consent text shown, IP, UTM tags and Meta cookies, then the scan row.
   - Background jobs: the server-side Meta `Lead` event, signing up for the nurture sequence and running the scan.
   - If the same domain was already scanned today, it reuses that report.

3. **Scan → report → email.** See section 3.

4. **Report page** ([src/app/scan/[token]/page.tsx](src/app/scan/[token]/page.tsx)). Built on the server. Unpaid visitors get placeholder text under the blur, not the real fixes hidden with CSS, so devtools can't reveal them. [ScanPoller.tsx](src/components/ScanPoller.tsx) refreshes the page while the scan is still running.

5. **Checkout** ([api/go/checkout](src/app/api/go/checkout/route.ts) → [lib/scan/whop.ts](src/lib/scan/whop.ts)). Each checkout is created through Whop's API so the scan token can ride along as metadata. That's the only link between a payment and a report. A plain Whop link would take the money and unlock nothing.

6. **Payment webhook** ([api/whop/webhook](src/app/api/whop/webhook/route.ts)). Checks the signature, finds the scan by token (or by email as a fallback), records the order in `scan_orders`, sends Meta `Purchase` and pushes a notification to your phone. For The Fix, it also marks the Resend contact `converted` so the nurture emails stop selling it. If money arrives and can't be matched to a scan, you get an email ([alert.ts](src/lib/scan/alert.ts)).

7. **After purchase:**
   - `/next` puts the $49 buyer's list first and the Fix pitch below it.
   - `/booked` waits for the webhook if Whop redirected before it arrived, then shows the kickoff booking ([BookKickoff.tsx](src/components/BookKickoff.tsx)).

8. **Delivery:**
   - [/start](src/app/start/page.tsx) is the intake questionnaire. It isn't indexed or linked anywhere; you paste the link to the customer. The questions are defined once, in [lib/intake/questions.ts](src/lib/intake/questions.ts).
   - Submissions email you a markdown digest and appear at `/admin/intake`.
   - When the work is done, `/admin/handover` publishes `/scan/<token>/complete`.

---

## 3. The scanner

Full write-up: [SCANNER.md](SCANNER.md). In short:

- `scanDomain(domain)` in [src/lib/scan/scanner/](src/lib/scan/scanner/) fetches the site once with its own HTTP client and runs 44 checks, 6 at a time, within a 45-second limit. They cover discovery, access, usability and payments.
- `buildReport(raw, category)` in [report.ts](src/lib/scan/report.ts):
  - keeps only the checks that apply to the business category ([categories.ts](src/lib/scan/categories.ts));
  - re-scores those and grades A–F;
  - caps the grade when required checks fail (brand search failing caps it at C);
  - picks the top 8 findings.
- Every finding has a free half (problem and consequence) and a paid half (fix). All the copy is in [relevance.ts](src/lib/scan/relevance.ts).
- `toPublicReport()` removes the paid half before an unpaid page sees it. The report email ([email.ts](src/lib/scan/email.ts)) never includes it.
- [run.ts](src/lib/scan/run.ts) ties it together: claim the row → scan → store → email. Claiming first means two workers never crawl the same scan twice.
- Brand search uses Serper, then the Brave API, then Brave's results page without a key. If none answers, the check comes back as error and doesn't count against the site.
- It replaced Ora on 2026-09-09. `npm run scan:compare` measures how closely it still matches Ora.

**Admin tools for existing scans** (both need the admin password):
- `POST /api/scan/refresh?token=…` re-scans in place. Same link, no email unless you add `&email=1`.
- `POST /api/scan/category?token=…&category=digital` re-scores the stored data under a different business type, for when someone picked the wrong one.

---

## 4. Background jobs

**Scan sweep.** [.github/workflows/scan-sweep.yml](.github/workflows/scan-sweep.yml) calls `GET /api/scan/sweep` every 10 minutes, using the `CRON_SECRET` repo secret. It runs on GitHub because Vercel's Hobby plan only allows a daily cron. Each run:
1. re-sends up to 10 reports that were stored but never emailed;
2. re-runs up to 8 scans that were stuck or still queued.

Background scans can die partway (a deploy, a timeout), so the sweep is the safety net. GitHub turns scheduled workflows off after 60 days with no commits.

---

## 5. Email

All email goes through Resend, from `CONTACT_FROM_EMAIL`. Replies go to `CONTACT_TO_EMAIL`.

| Email | Sent by | Notes |
|---|---|---|
| Scan report | [run.ts](src/lib/scan/run.ts) | The free half only. Its unsubscribe link goes to `/api/scan/unsubscribe`, which updates both the database and the Resend contact |
| Nurture sequence (22 emails over 38 days) | A Resend automation | Started by the `scan.requested` event from [subscribe.ts](src/lib/subscribe.ts). Copy in [content/nurture-sequence.mjs](content/nurture-sequence.mjs), pushed to Resend with `scripts/create-email-sequence.mjs`. See [SEQUENCE.md](SEQUENCE.md) |
| Intake confirmation and notification | [api/intake](src/app/api/intake/route.ts) | |
| Unmatched-payment alert | [alert.ts](src/lib/scan/alert.ts) | |

**What stops the sequence:**
- **booked**, set by the [Calendly webhook](src/app/api/calendly/webhook/route.ts) when someone books;
- **converted**, set by the Whop webhook after a Fix purchase;
- unsubscribing.

**Links in the sequence** go through redirect routes so the click is recorded:
- `/api/go/upgrade` creates a checkout. If that fails, it falls back to the booking page.
- `/api/go/book` is the old booking link, kept because people still have those emails.

The [Resend webhook](src/app/api/resend/webhook/route.ts) records delivered, bounced, complained, opened and clicked into `email_events` and `email_clicks`.

---

## 6. Ad tracking (Meta)

The browser pixel and the server-side Conversions API ([meta-capi.ts](src/lib/meta-capi.ts)) send the same events with the same `event_id`, built from the scan token, so Meta counts each one once.

| Event | Browser | Server |
|---|---|---|
| Lead | [LeadPixel](src/components/LeadPixel.tsx) on /scan/thanks | /api/scan |
| ViewContent / ReportOpened | [ReportOpenedPixel](src/components/ReportOpenedPixel.tsx) | — |
| InitiateCheckout | — | /api/go/checkout |
| Purchase | [PurchasePixel](src/components/PurchasePixel.tsx) | Whop webhook, the reliable one |

`_fbp` and `_fbc` are saved on the lead at signup so later server events still match the person. Outreach reports (`/audit/…`) fire no Meta events, so cold prospects don't skew the ad data.

`GET /api/capi/health` sends a harmless test event to prove the Meta token works. `GET /api/whop/health` creates a real (unused) checkout to prove the Whop key's permissions.

---

## 7. Cold outreach

1. In **/admin/outreach**, type a prospect's domain, or POST it to `/api/outreach/scan` with `OUTREACH_API_KEY` from another tool. The scan is queued and the sweeper runs it.
2. You get a `/audit/<token>` link. That page shows the **full report with every fix, free**, explains who you are, and offers The Fix.
3. Put the link in a cold email you write yourself. The system never emails prospects and never adds them to the sequence.
4. For emails that pitch The Fix directly, link `/audit/<token>/start`. It's a plain page with a buy button, so email security scanners that open every link don't create fake checkouts.
5. `/admin/sales` lists every sale and which outreach batch (`email_key`) earned it.

---

## 8. Admin

Everything under `/admin` is behind HTTP basic auth with `ADMIN_PASSWORD` ([proxy.ts](src/proxy.ts), [admin-auth.ts](src/lib/admin-auth.ts)). Server actions check the password themselves too. `/admin` redirects to outreach.

| Page | Use |
|---|---|
| `/admin/outreach` | Scan prospects, get audit links, see who paid |
| `/admin/sales` | Every order |
| `/admin/lookup` | Type a website, get its report link (for replying to customers) |
| `/admin/intake` | Intake form submissions, with a copy-as-markdown button |
| `/admin/handover` | Publish a customer's handover page |

`/api/scan/simulate-purchase` (admin only) marks a scan as paid without a real payment, to test what happens after purchase. It can remove the fake payment afterwards.

---

## 9. Machine-readable pages for AI agents

The site practises what it sells. All of these are generated from code, so prices can't go stale:

- `/llms.txt`, `/index.md`, `/pricing.md` ([agent-docs.ts](src/lib/agent-docs.ts))
- `/.well-known/ard.json`, `/.well-known/agent-card.json`, `/.well-known/agent-skills/…` ([agent-manifests.ts](src/lib/agent-manifests.ts))
- `robots.ts` and `sitemap.ts`
- `Link` headers in [next.config.ts](next.config.ts)
- [proxy.ts](src/proxy.ts) serves the markdown version of a page to clients that ask for `text/markdown`
- Structured data in [schema.ts](src/lib/schema.ts)

`next.config.ts` also redirects old guide PDF filenames to the current one.

---

## 10. Database (Neon Postgres)

Each module creates its own tables on first use (`CREATE TABLE IF NOT EXISTS`), and adds new columns the same way (`ADD COLUMN IF NOT EXISTS`). There are no separate migration files.

| Table | Holds | Defined in |
|---|---|---|
| `scan_leads` | Email, consent text, IP, UTM tags, Meta cookies, unsubscribe state | [lib/scan/db.ts](src/lib/scan/db.ts) |
| `scans` | Token, domain, category, status, report, raw results, outreach flag, handover | same |
| `scan_orders` | Payments: product, amount, Whop ids, outreach batch | same |
| `build_intakes` | `/start` answers (JSONB) | [lib/intake/db.ts](src/lib/intake/db.ts) |
| `email_events`, `email_clicks`, `sequence_bookings` | Email engagement and bookings tied to emails | [lib/tracking.ts](src/lib/tracking.ts) |

Connection: [pg.ts](src/lib/pg.ts) reads the first of `DATABASE_URL`, `STORAGE_DATABASE_URL`, `NEON_DATABASE_URL`, `POSTGRES_URL` or `STORAGE_POSTGRES_URL` that's set.

---

## 11. Environment variables

The full list with explanations is in [.env.example](.env.example).

| Variable | For |
|---|---|
| `DATABASE_URL` | Neon |
| `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` | Email |
| `ADMIN_PASSWORD` | /admin and the admin APIs |
| `NEXT_PUBLIC_SITE_URL` | Links in emails |
| `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_GRAPH_API_VERSION` | Meta |
| `SERPER_API_KEY`, `BRAVE_SEARCH_API_KEY` | Scanner brand search (optional, but Serper is recommended) |
| `WHOP_API_KEY`, `WHOP_ACCOUNT_ID`, `WHOP_PLAN_ID_SOLUTIONS`, `WHOP_PLAN_ID_DONE_FOR_YOU`, `WHOP_WEBHOOK_SECRET` | Payments |
| `CALENDLY_WEBHOOK_SECRET` | Booking webhook |
| `PUSHOVER_API_TOKEN`, `PUSHOVER_USER_KEY` | Push notifications to your phone (optional) |
| `CRON_SECRET` | Sweep endpoint |
| `OUTREACH_API_KEY` | Outreach API (falls back to `CRON_SECRET`) |

Most webhooks and secret-protected routes **refuse every request** when their secret is missing.

---

## 12. Commands and scripts

```bash
npm run dev                                   # local site at localhost:3000
npm run build && npm start                    # production build
npm run lint

npm run scan:local -- example.com [category] [--json]   # scan one site from the terminal
npm run scan:compare                          # check the scanner against Ora
npm run scan:pacing                           # test search rate limits
npm run scan:wikidata                         # test the Wikidata check
```

One-off scripts in [scripts/](scripts/):

| Script | Does |
|---|---|
| `create-email-sequence.mjs`, `build-sequence-steps.mjs`, `preview-sequence.mjs`, `switch-sequence.mjs` | Build, preview and switch the Resend nurture automation |
| `configure-tracking.mjs`, `test-tracking.mjs`, `check-events.mjs`, `register-webhook.mjs` | Resend click tracking and webhooks |
| `add-booking-cta-to-guide.py` | Restamps the guide PDF's booking button (from the old guide funnel) |
| `step-to-booking.sql` | Query: which email led to which booking |

**The creative generator** ([creative-generator/](creative-generator/)) is a separate local tool, not part of the site. Run `node creative-generator/server.mjs`, open localhost:4321, and it writes Meta ad copy and renders three image ads at every Meta size from the `context/` files. `.vercelignore` keeps it out of deploys.

---

## 13. Things that will bite you

- **Vercel deploys whatever is in this folder.** `vercel --prod` ships your local files, not `main`, so GitHub and the live site can drift apart. Commit what you deploy.
- **DNS is on Cloudflare, not Vercel.** When adding a record, put only the subdomain in Name (`track`, not `track.footholdsystems.com`), and leave CNAMEs for Resend and Vercel on "DNS only" (grey cloud).
- **Vercel env vars are marked Sensitive**, so `vercel env pull` gives you empty values. Get the database string from Neon directly.
- **Resend contact lookups are case-sensitive; the database lowercases emails.** Always go through [lib/resend-contact.ts](src/lib/resend-contact.ts).
- **Whop's v1 API gives amounts in dollars** (`total`, `subtotal`, `usd_total`). `final_amount` and `amount` are v2 fields and come back undefined.
- **The nurture copy in this repo is newer than what's in Resend.** Switching over means duplicating the automation (Resend can't edit an enabled one). You put that off on 2026-10-03.
- **Don't rename** the stored category value `sbo` (it's "Local Services" on screen), the intake field `name`s or check IDs. Live rows and stored reports use them.
- **The `server-only` import** in report/relevance/db files stops them being used in the browser. Scripts get around it with [scripts/ts-hooks.mjs](scripts/ts-hooks.mjs).
- **Most files start with a long comment explaining why they're built the way they are.** Read it before changing the file; many describe a bug that already happened once.
