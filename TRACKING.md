# Click and open tracking

Resend rewrites links and embeds a pixel; a custom tracking subdomain is what
makes the first of those safe. This file covers turning it on, the DNS record it
needs, the webhook that captures the events, and how a click gets attributed to
one of the 22 nurture emails.

Related: [`BOOKING.md`](BOOKING.md) for the Calendly side of the join.

## Why a tracking subdomain

Click tracking works by rewriting every link in the message to point at the ESP
and redirect on. Without a custom subdomain the reader hovers a link in a mail
from `max@footholdsystems.com` and sees a `resend.com` URL. That mismatch is the
shape of a phishing mail, it is scored as one, and it is the entire
deliverability cost of click tracking.

`track.footholdsystems.com` keeps the registrable domain the same as the From
address and under the same DMARC policy, so the link stops looking borrowed.

**Opens are a different trade and the objection stands.** No email protocol
reports an open, so an open rate is always a 1×1 image loading — and Apple Mail
Privacy Protection loads it on the reader's behalf whether or not anyone looked.
Opens are recorded because they are useful for spotting a segment that has gone
completely cold. **Clicks are the metric to act on.**

## 1. Turn it on

```bash
RESEND_API_KEY=re_xxx node scripts/configure-tracking.mjs
```

Read-only: prints the current `click_tracking`, `open_tracking` and
`tracking_subdomain` for the domain. Then:

```bash
RESEND_API_KEY=re_xxx node scripts/configure-tracking.mjs --apply
```

One `PATCH /domains/:id` setting `click_tracking: true`, `open_tracking: true`
and `tracking_subdomain: "track"`, followed by a re-read to print the DNS record
Resend wants. Both flags are sent in the same call as the subdomain, because
each requires a tracking subdomain to be configured.

> **This is close to permanent.** Resend's documentation is explicit that a
> tracking subdomain, once set, can be changed but never removed. That is why
> the subdomain is a constant in the script rather than a flag.

## 2. The DNS record

The record is a `CNAME` at `track.footholdsystems.com`. **The value is issued
per domain and only Resend can tell you what it is** — it is not a fixed
hostname, so it has to come from the API rather than from this file. `--apply`
prints it in full.

DNS for this domain is on **Cloudflare**. Add it under **DNS → Records → Add
record**:

| Field | Value |
| --- | --- |
| Type | `CNAME` |
| Name | `track` — **not** the full `track.footholdsystems.com` |
| Target | the value the script prints |
| Proxy status | **DNS only** (grey cloud) |
| TTL | Auto |

Then:

```bash
RESEND_API_KEY=re_xxx node scripts/configure-tracking.mjs --verify
```

That calls `POST /domains/:id/verify` and re-reads the record status. It is not
verified until the script says so.

### Two ways this fails with a CNAME that reads as correct

- **Pasting the full hostname into Name.** Cloudflare appends the zone to
  whatever is in that field, so `track.footholdsystems.com` becomes
  `track.footholdsystems.com.footholdsystems.com`. It resolves for nobody and
  looks entirely right in the dashboard. The script prints both the short and
  full forms so the right one is obvious.
- **Leaving the proxy on.** An orange-cloud record answers with Cloudflare's own
  IPs, so Resend cannot complete the domain-control check for the TLS
  certificate the tracking subdomain needs, and it never verifies. Grey cloud.

A third, less likely: **CAA records** that do not permit the issuing CA will
block that certificate. Resend's Cloudflare guide does not mention this, so
treat it as a thing to check only if verification stalls with the record
otherwise correct — the script prints any CAA records the API returns.

## 3. The webhook

**The endpoint already exists at `/api/resend/webhook`** — this is the route
that has been recording `delivered`, `bounced` and `complained`. It has been
extended rather than replaced, so there is one signature implementation and one
endpoint to register, not two.

A webhook is **already registered** for this endpoint — it is what has been
recording delivery events — so the job is to add `email.clicked` and
`email.opened` to its subscription, not to register a new one:

```bash
RESEND_API_KEY=re_xxx node scripts/register-webhook.mjs           # show
RESEND_API_KEY=re_xxx node scripts/register-webhook.mjs --apply   # set
```

> **Do not add a second webhook pointing at this endpoint.** Two subscriptions
> both send `email.delivered`, and the deduplication here is keyed on the Svix
> message id — which differs between subscriptions for the same underlying
> event. Every delivery, bounce and complaint would count twice, and nothing
> downstream would flag it. The script refuses to proceed if it finds more than
> one webhook on the endpoint.

Updating in place keeps the signing secret, so `RESEND_WEBHOOK_SECRET` does not
change and nothing needs redeploying for it. If the script does create a webhook
from scratch, it prints the new secret to set in Vercel.

**Deploy before subscribing.** The endpoint answers `email.clicked` with a 200
either way, so subscribing while the old handler is live means clicks are
accepted and silently dropped rather than erroring.

Signature verification follows Svix's scheme and **fails closed** — a request
that cannot be verified is rejected with a 401, including one with no signature
headers at all. Anything not in the five types above is acknowledged with a 200
and ignored, so Resend stops retrying it.

### Environment variables

All of these already exist; tracking adds none.

| Variable | Used for |
| --- | --- |
| `RESEND_API_KEY` | The configure script, and the Calendly route's contact update |
| `RESEND_WEBHOOK_SECRET` | Verifying webhook signatures. `whsec_…` |
| `DATABASE_URL` | Neon. Also read from `POSTGRES_URL` and three other aliases |
| `CALENDLY_WEBHOOK_SECRET` | The booking side of the join |

Nothing is hardcoded, and the webhook returns 503 rather than accepting an
unverified request if its secret is missing.

## 4. How a click becomes a sequence step

**The identifier is the link, not a tag or a header.** That is not a preference —
Resend's per-send `tags` and custom `headers` only exist on `POST /emails`. An
automation's `send_email` step accepts `template`, `from`, `subject` and
`reply_to` and nothing else, so there is no `X-Sequence-Step: 7` to read and no
tag to filter on. The 22 emails are sent by an Automation
(`scripts/create-email-sequence.mjs`), so that route is closed.

It does not need to be open. Every link in every email already carries its
campaign, because `content/nurture-sequence.mjs` runs each body through
`tagLinks()` before the template is created:

```
https://www.footholdsystems.com/api/go/book?e=nurture-10-quotes&c=cta-button&r={{{EMAIL}}}
```

`keyFromLink()` reads `e` (or `utm_campaign` on non-booking links) and
normalises it to the step key — `quotes`. Verified against all 44 links across
the 22 emails.

Resolution order, most trustworthy first:

1. **`data.click.link`** — carries the campaign explicitly. Clicks only.
2. **`data.subject`** — the fallback for opens and delivery events. Holds as
   long as the 22 subjects stay distinct.
3. **`data.template_id`** — stored on every row but not currently used to
   resolve. It is the one identifier Resend generates itself, so a map from it
   can be rebuilt later without re-reading history.

The recipient comes from `data.to[0]`, which is more reliable than the
`{{{EMAIL}}}` merge tag the `/api/go/book` redirect depends on.

### Unsubscribe clicks are not clicks

With tracking on, each email has exactly two clickable links: the booking button
and the unsubscribe footer. The unsubscribe link carries no campaign, so it
would fall through to the subject fallback and be filed as an ordinary click on
that email — putting the people *leaving* into the number the sequence is judged
on, and letting an unsubscribe stand as the last touch before a booking.

It is stored as `unsubscribe_clicked` instead. The row is kept, because which
email drives unsubscribes is worth knowing and is recorded nowhere else, but the
attribution query only counts `clicked`.

### Two click tables, on purpose

| Table | Written by | Holds |
| --- | --- | --- |
| `email_clicks` | `/api/go/book` | Booking-button clicks, server-side, no rewriting |
| `email_events` | this webhook | Every event Resend reports, with link and step |

A booking-button click lands in both. They are a cross-check on each other, and
the redirect keeps working if Resend's tracking is ever turned off again. The
existing campaign dashboard reads `email_clicks` and `email_deliveries` and is
untouched by any of this.

`email_events` is deduplicated on `svix-id`, so a webhook retry cannot count
twice — while three genuine clicks on three links stay three rows.

## 5. Which step precedes a booking

```bash
psql "$DATABASE_URL" -f scripts/step-to-booking.sql
```

Also available in code as `getStepToBooking()` in
[`src/lib/tracking.ts`](src/lib/tracking.ts).

The join key is the recipient's email address. **Both sides genuinely carry it**:
Resend reports `data.to[0]` on every event, and Calendly puts the invitee's
address in `payload.email` on `invitee.created`. Both are lowercased on the way
in, so they compare directly.

Two credit models, because either alone misleads:

- **last touch** — the click immediately before the booking. The number to judge
  a single email on. These sum to the number of attributed bookings.
- **assisted** — every email clicked at any point before booking. The number to
  judge a *cut* on: an email with no last-touch bookings may still be what makes
  email 19 land. These sum to more than the number of bookings, on purpose.

Only clicks at or before the booking count — sends continue until the Calendly
webhook marks the contact booked, so a later click cannot have caused a booking
that already happened.

## 6. Test plan

Run in order. The first three are the deployment sequence and matter: the
endpoint has to be live before Resend is told to send it clicks.

**0. Deploy, then subscribe**

```bash
git push                                                  # Vercel builds on push
RESEND_API_KEY=re_xxx node scripts/register-webhook.mjs --apply
```

**1. Confirm tracking is live**

```bash
RESEND_API_KEY=re_xxx node scripts/configure-tracking.mjs
```

Expect `click_tracking true`, `open_tracking true`, `tracking_subdomain track`,
and the Tracking record's status `verified`.

**2. Send yourself one real sequence email**

```bash
RESEND_API_KEY=re_xxx node scripts/test-tracking.mjs max@snaptechrepair.com --step quotes
```

Sends the actual copy for step 10, so the links are the real ones. Check the
received mail: **hovering the booking link should show
`track.footholdsystems.com`**, not `resend.com`. If it still shows the sending
domain unrewritten, tracking is not active yet.

**3. Click the link**

It should redirect through to Calendly as normal — the tracking hop is invisible.

**4. Confirm the event landed with the right step**

```bash
psql "$DATABASE_URL" -c "SELECT event_type, email_key, recipient, link, occurred_at FROM email_events ORDER BY id DESC LIMIT 5;"
```

Expect a row with `event_type = clicked`, **`email_key = quotes`**, and your
address as `recipient`. That is the acceptance criterion: the click is
attributed to a specific one of the 22.

An `opened` row for the same email should appear too, usually first.

**5. Confirm the join**

```bash
psql "$DATABASE_URL" -f scripts/step-to-booking.sql
```

With a click but no booking yet, expect `quotes` with `clickers 1` and
`booked_last_touch 0`. Book a test call at the same address and re-run: it
should move to `1`, with `median_hours_to_book` filled in.

**6. Confirm it fails closed**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://www.footholdsystems.com/api/resend/webhook -d '{"type":"email.clicked"}'
```

Expect `401`. Anything else means unsigned events are being accepted.

### Cleaning up after testing

The test click is a real row and will sit in the per-email figures. The campaign
dashboard's reset control clears `email_clicks`; for the new table:

```bash
psql "$DATABASE_URL" -c "DELETE FROM email_events WHERE recipient = 'max@snaptechrepair.com';"
```
