import "server-only";
import { neon } from "@neondatabase/serverless";
import { SEQUENCE_STEPS } from "./sequence-steps";

/**
 * Per-email attribution for the nurture sequence. Writes only.
 *
 * Calendly knows a booking happened but not what prompted it. Between that and
 * the sequence sits the question worth answering: which of the 22 emails
 * actually moves someone to book, and which are dead weight.
 *
 * THE READING HALF IS GONE. `getEmailAttribution`, `getStepToBooking`,
 * `getSubscriberSeries` and `resetEmailClicks` were read by /admin/campaign,
 * which was deleted along with the rest of the old guide funnel. The tables
 * are still written and still hold every row they held; nothing renders them
 * today, and a query is the cheap half to write again if that changes.
 *
 * Three facts are recorded, from two independent sources:
 *
 *  - **Redirect clicks**, by `/api/go/book`. Every booking link points at that
 *    redirect rather than straight at Calendly, so the click is logged
 *    server-side before the visitor is handed on, where no ad blocker touches
 *    it. Stored in `email_clicks`.
 *  - **Resend events**, by `/api/resend/webhook`: clicks, opens and delivery
 *    outcomes, since click tracking was enabled on a tracking subdomain of our
 *    own. Stored in `email_events`. This covers every link rather than just the
 *    button, and reports the recipient reliably, which the merge tag does not.
 *  - **Bookings**, by the Calendly webhook, tagged with the email whose link
 *    started the visit. Calendly passes the UTM parameters it was opened with
 *    back in the webhook payload, which is what makes the join possible.
 *
 * The two click sources are kept apart rather than merged. They measure
 * different things and disagreeing is informative: the redirect sees only the
 * button but cannot be blocked, and Resend sees every link but only while its
 * tracking is on. Either one alone would be a single point of failure for the
 * question this whole file exists to answer.
 *
 * No write is allowed to break the thing it measures: a failed click insert
 * still redirects, and a failed booking insert still returns 200 so Calendly
 * stops retrying.
 */

const CONNECTION_ENV_VARS = [
  "DATABASE_URL",
  "STORAGE_DATABASE_URL",
  "NEON_DATABASE_URL",
  "POSTGRES_URL",
  "STORAGE_POSTGRES_URL",
];

function connectionString(): string | undefined {
  for (const name of CONNECTION_ENV_VARS) {
    if (process.env[name]) return process.env[name];
  }
  return undefined;
}

/** Keys the sequence actually contains, so junk in a query string is not stored. */
const KNOWN_KEYS = new Set(SEQUENCE_STEPS.map((step) => step.key));

/**
 * Merge tags arrive substituted or not at all.
 *
 * If Resend does not recognise a tag it passes the literal `{{{EMAIL}}}`
 * through into the URL. Storing that would create a contact called "{{{EMAIL}}}"
 * with a click count equal to the whole sequence, so anything still carrying
 * braces is treated as unknown rather than as an address.
 */
export function cleanRecipient(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.includes("{{") || !trimmed.includes("@")) return null;
  return trimmed;
}

/**
 * Resolve whatever a link carried back to a sequence step key.
 *
 * Links do not carry the bare key. The sequence tags everything with its
 * campaign name — `nurture-07-quoting` — while `SEQUENCE_STEPS` is keyed on
 * `quoting`, so a straight set lookup matches nothing and every click and
 * booking is discarded as junk. Nothing errors when that happens; the redirect
 * still redirects and the dashboard just reads zero forever, which is the worst
 * shape a bug like this can take.
 *
 * Both forms are accepted and normalised to the step key, so the UTM naming can
 * change again without breaking the join.
 */
export function knownKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (KNOWN_KEYS.has(trimmed)) return trimmed;
  const stripped = trimmed.replace(/^(?:foothold-)?nurture-\d+-/, "");
  return KNOWN_KEYS.has(stripped) ? stripped : null;
}

/**
 * Resolve a clicked URL back to the sequence email that contained it.
 *
 * This is what makes Resend's click webhook attributable, and it needs nothing
 * added to the emails: every link in every message already carries the campaign
 * name, because content/nurture-sequence.mjs runs the whole body through
 * `tagLinks()` before the template is created. Booking links get it as `e`,
 * everything else as `utm_campaign`, both in the form
 * `foothold-nurture-07-quotes` — which `knownKey` already normalises.
 *
 * That matters because the obvious mechanism is not available here. Resend's
 * per-send `tags` and custom headers only exist on POST /emails; an automation's
 * `send_email` step takes `template`, `from`, `subject` and `reply_to` and
 * nothing else, so there is no `X-Sequence-Step` to read and no tag to filter
 * on. The link is the identifier the sequence can actually carry.
 *
 * Resend rewrites these links to the tracking subdomain in the delivered
 * message, but the webhook reports the original destination, so what arrives
 * here is the URL as written above.
 */
export function keyFromLink(link: string | null | undefined): string | null {
  if (!link) return null;
  let params: URLSearchParams;
  try {
    params = new URL(link).searchParams;
  } catch {
    return null;
  }
  // `e` first: booking links carry the campaign there, and also set utm_campaign
  // on the far side of the redirect. Both agree, so the order is only about
  // reading the one that is present.
  return knownKey(params.get("e")) ?? knownKey(params.get("utm_campaign"));
}

export async function initTrackingSchema(): Promise<void> {
  const url = connectionString();
  if (!url) return;
  const sql = neon(url);

  await sql`
    CREATE TABLE IF NOT EXISTS email_clicks (
      id         BIGSERIAL PRIMARY KEY,
      email_key  TEXT NOT NULL,
      link       TEXT NOT NULL DEFAULT 'cta-button',
      recipient  TEXT,
      clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE INDEX IF NOT EXISTS email_clicks_key
      ON email_clicks (email_key, clicked_at DESC)`;

  // Everything Resend's webhook reports: clicks, opens and the delivery
  // outcomes, in one table.
  //
  // This replaced `email_deliveries`, which held the same three delivery kinds
  // with fewer columns. Both were being written for a while so the dashboard
  // could keep reading the old one, and that dual write is gone now the
  // dashboard reads this. Nothing was lost in the switch: the webhook rejected
  // every event with a 503 until RESEND_WEBHOOK_SECRET was first set, so
  // `email_deliveries` never held more than a few minutes of overlap.
  //
  // Still separate from `email_clicks`, which is a different measurement rather
  // than an older one. `email_clicks` holds booking-button clicks seen by
  // /api/go/book — one link, logged server-side, no rewriting. This holds every
  // link Resend saw clicked, via the tracking subdomain. A click on the booking
  // button lands in both on purpose: they are a cross-check on each other, and
  // the redirect keeps working if Resend's tracking is ever turned back off.
  await sql`
    CREATE TABLE IF NOT EXISTS email_events (
      id          BIGSERIAL PRIMARY KEY,
      event_id    TEXT NOT NULL,
      event_type  TEXT NOT NULL,
      email_key   TEXT,
      recipient   TEXT,
      email_id    TEXT,
      template_id TEXT,
      subject     TEXT,
      link        TEXT,
      detail      TEXT,
      user_agent  TEXT,
      ip_address  TEXT,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Keyed on the Svix message id, not on (email_id, type): one email legitimately
  // produces many clicks, and deduping on the email would keep only the first.
  // A webhook retry re-sends the same svix-id, which is exactly what to collapse.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS email_events_unique
      ON email_events (event_id)`;
  await sql`
    CREATE INDEX IF NOT EXISTS email_events_key
      ON email_events (email_key, event_type, occurred_at DESC)`;
  await sql`
    CREATE INDEX IF NOT EXISTS email_events_recipient
      ON email_events (recipient, occurred_at DESC)`;

  // One row per Calendly event rather than one per person: a booking followed by
  // a cancellation is two facts, and collapsing them would hide the churn.
  await sql`
    CREATE TABLE IF NOT EXISTS sequence_bookings (
      id         BIGSERIAL PRIMARY KEY,
      email      TEXT NOT NULL,
      email_key  TEXT,
      medium     TEXT,
      link       TEXT,
      status     TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE INDEX IF NOT EXISTS sequence_bookings_key
      ON sequence_bookings (email_key, created_at DESC)`;
}

export async function recordClick(input: {
  emailKey: string;
  link: string;
  recipient: string | null;
}): Promise<void> {
  const url = connectionString();
  if (!url) return;
  const sql = neon(url);
  await initTrackingSchema();
  await sql`
    INSERT INTO email_clicks (email_key, link, recipient)
    VALUES (${input.emailKey}, ${input.link}, ${input.recipient})`;
}

/**
 * Match a delivered email back to its step by subject.
 *
 * The webhook payload carries no step key — it describes an email, not an
 * automation position. Subjects are unique across the sequence, so they are the
 * join. Anything unrecognised is stored with a null key rather than dropped: a
 * bounce on the guide delivery email is still a bounce worth counting, it just
 * does not belong to a step.
 */
const SUBJECT_TO_KEY = new Map(
  SEQUENCE_STEPS.map((step) => [step.subject.trim().toLowerCase(), step.key])
);

export function keyFromSubject(subject: string | null | undefined): string | null {
  if (!subject) return null;
  return SUBJECT_TO_KEY.get(subject.trim().toLowerCase()) ?? null;
}

export type EngagementKind =
  | "clicked"
  | "opened"
  | "delivered"
  | "bounced"
  | "complained";

/** What actually gets stored — see `isUnsubscribeLink` for the extra one. */
export type StoredEventType = EngagementKind | "unsubscribe_clicked";

/**
 * Is this the unsubscribe link rather than a link in the copy?
 *
 * With click tracking on, every email in the sequence has exactly two clickable
 * links: the booking button and the unsubscribe footer. Only the first is
 * interest. The second is the opposite of interest, and it does not carry a
 * campaign — it is `{{{RESEND_UNSUBSCRIBE_URL}}}` in the template, substituted
 * by Resend at send time — so `keyFromLink` returns null for it and the subject
 * fallback would then file it as an ordinary click on that email.
 *
 * That single fallback would have made the click count the sequence is judged on
 * include the people leaving, which is exactly backwards, and would have let an
 * unsubscribe stand as the last touch before a booking.
 *
 * So it is stored under its own type. The row is kept rather than dropped —
 * which email pushes people to unsubscribe is worth knowing, and is not recorded
 * anywhere else — but it is not a click, and the attribution query only counts
 * `clicked`.
 */
export function isUnsubscribeLink(link: string | null | undefined): boolean {
  if (!link) return false;
  return /unsubscribe|\/unsub\b/i.test(link);
}

/**
 * Record one Resend webhook event, with the step it belongs to already resolved.
 *
 * Attribution is attempted in the order the identifiers are trustworthy: the
 * clicked link carries the campaign explicitly, so it wins; the subject is the
 * fallback for events with no link, and holds as long as the 22 subjects stay
 * distinct. `template_id` is stored on every row whether or not it was needed —
 * it is the one identifier Resend generates itself, so a map from it can be
 * rebuilt later (scripts/map-templates.mjs) without re-reading history.
 *
 * Returns which of the three things happened, rather than a boolean. A retry and
 * an unconfigured database both write no row, and reporting them the same way
 * would mean a webhook against a deployment with no DATABASE_URL answered every
 * event with "already had that one" — the one reply guaranteed to look fine.
 */
export type RecordOutcome = "written" | "duplicate" | "not-configured";
export async function recordEngagement(input: {
  eventId: string;
  kind: EngagementKind;
  recipient: string | null;
  emailId: string | null;
  templateId: string | null;
  subject: string | null;
  link: string | null;
  detail: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  occurredAt: string | null;
}): Promise<RecordOutcome> {
  const url = connectionString();
  if (!url) return "not-configured";
  const sql = neon(url);
  await initTrackingSchema();

  // The unsubscribe footer is a click on the message but not a click on the
  // offer, so it is typed apart before anything counts it.
  const eventType: StoredEventType =
    input.kind === "clicked" && isUnsubscribeLink(input.link)
      ? "unsubscribe_clicked"
      : input.kind;

  const emailKey = keyFromLink(input.link) ?? keyFromSubject(input.subject);

  // A timestamp we cannot parse is worse than none: `new Date("nonsense")` is
  // Invalid Date, which Postgres rejects and would cost the whole row.
  const occurred =
    input.occurredAt && !Number.isNaN(Date.parse(input.occurredAt))
      ? new Date(input.occurredAt).toISOString()
      : new Date().toISOString();

  const rows = (await sql`
    INSERT INTO email_events (
      event_id, event_type, email_key, recipient, email_id, template_id,
      subject, link, detail, user_agent, ip_address, occurred_at
    )
    VALUES (
      ${input.eventId}, ${eventType}, ${emailKey},
      ${cleanRecipient(input.recipient)}, ${input.emailId}, ${input.templateId},
      ${input.subject}, ${input.link}, ${input.detail},
      ${input.userAgent}, ${input.ipAddress}, ${occurred}
    )
    ON CONFLICT (event_id) DO NOTHING
    RETURNING id`) as { id: number }[];

  return rows.length > 0 ? "written" : "duplicate";
}

export async function recordBooking(input: {
  email: string;
  emailKey: string | null;
  medium: string | null;
  link: string | null;
  status: "booked" | "canceled";
}): Promise<void> {
  const url = connectionString();
  if (!url) return;
  const sql = neon(url);
  await initTrackingSchema();
  await sql`
    INSERT INTO sequence_bookings (email, email_key, medium, link, status)
    VALUES (${input.email}, ${input.emailKey}, ${input.medium}, ${input.link},
            ${input.status})`;
}
