# The nurture sequence

What happens after somebody runs a free scan: they are enrolled in a 22 email
sequence, and a booking stops it.

> This file used to be `CRO.md` and also covered the guide funnel's lead
> capture, its consent records, an experiment engine that rewrote the sales
> page, and a campaign dashboard. All four were deleted with the guide funnel
> on 28 August 2026 — `/api/lead`, `/api/cro/*`, `/api/campaign/refresh`,
> `/admin`, `/admin/cro`, `/admin/campaign` and the nine library modules behind
> them. Nothing in this file describes them any more.
>
> Related: [`TRACKING.md`](TRACKING.md) for what is still recorded per email,
> and [`BOOKING.md`](BOOKING.md) for the Calendly side.

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

Triggered by the `scan.requested` event, sent by `lib/subscribe.ts` when
somebody runs a free scan. It has to match `TRIGGER_EVENT` in the script above
or the automation never fires, and nothing anywhere reports that it did not.

`guide.downloaded` was the old trigger. That event and its automation still
exist in Resend on purpose: anyone mid-sequence on the guide flow is listening
to a different trigger, so nothing sent from here reaches them.

### Booked contacts

`/api/calendly/webhook` sets a `booked` contact property on `invitee.created` and
clears it on `invitee.canceled`. A condition before every send ends the run for
anyone marked booked, so a booking on any of the 38 days stops the rest.
`SUPPRESS_AFTER_BOOKING=0` drops those checks, which is the fallback if the
automation is rejected for size.

The endpoint fails closed: 503 with no `CALENDLY_WEBHOOK_SECRET`, 401 on anything
that does not verify. Signatures are checked over the raw body, compared in
constant time, and rejected beyond five minutes so a captured payload cannot be
replayed. **Confirmed against a real test booking**, so the signature scheme is
known to match rather than assumed. If it ever stops matching — a rotated secret
is the likely cause — it appears in the logs as
`Calendly webhook rejected: signature did not match`.
