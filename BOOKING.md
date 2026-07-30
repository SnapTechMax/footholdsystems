# Booking setup (Calendly)

The site's "Book a call" buttons all point at one Calendly event type. **The booking
rules live in Calendly, not in this codebase** — Calendly has no URL parameter for a
maximum bookable date, so the window cannot be set from a link. Everything below is a
one-time change in the Calendly dashboard.

Event type: `calendly.com/max-snaptechrepair/new-meeting`
(the value of `CALENDLY_URL` in [`src/lib/site.ts`](src/lib/site.ts))

## The rules we want

| Rule | Value |
| --- | --- |
| How far ahead someone can book | 7 calendar days, rolling |
| Time of day | 1:00pm – 4:00pm Pacific |
| Call length | 20 minutes (the site promises "twenty minutes") |

A **rolling** window is the important part: Calendly recalculates it per visitor when
the page loads, which is exactly the behaviour we want.

- Opens the link Aug 1 → can book Aug 1–8
- Opens the link Aug 2 → can book Aug 2–9

## Steps

### 1. The 7-day rolling window

1. Calendly → **Event Types** → open the event type
2. Expand **Availability** (older UI: **When can people book this event?**)
3. Under **Date range**, choose the *rolling* option — "**N** days into the future"
4. Set **N = 7** and pick **calendar days** from the dropdown

> The dropdown also offers **week days**. Pick **calendar days** to match the spec above.
> With *week days*, a link opened on a Friday would stay open through the following
> Tuesday rather than closing the next Friday.

### 2. The 1–4pm Pacific hours

1. Same **Availability** section → open the availability schedule it uses
2. Set the timezone to **Pacific Time – US & Canada (Los Angeles)**
3. Set each weekday you want to **1:00pm – 4:00pm**, and clear the days you don't

> **On "PST" specifically:** pick the *Los Angeles* timezone rather than a fixed UTC−8
> offset. Los Angeles is on PDT (UTC−7) from March to November, so a hard −8 offset
> would silently show your slots as 12–3pm for most of the year. The named timezone
> keeps them at 1–4pm Pacific year-round.

### 3. Call length

**Event Types** → the event type → **Duration** → **20 minutes**.

## Checking it

Open the link in a private window and confirm:

- The last selectable day is 7 days out from today, and the day after it is greyed out
- The only times offered are 1:00pm–4:00pm Pacific
- Tomorrow, the whole range has shifted forward by one day

## Where the buttons are

Each entry point tags its link with a `utm_campaign` so bookings can be told apart in
Calendly's UTM reporting, via `calendlyUrl()` in [`src/lib/site.ts`](src/lib/site.ts):

| `utm_campaign` | Where |
| --- | --- |
| `header` | Site header, every page |
| `homepage` | Homepage "next step" block |
| `guide` | Guide page, bottom CTA |
| `guide-thanks` | Thank-you page after a guide request |

They also fire a `book_call_click` event to GA4 / UET / Meta, labelled with the same
entry point.
