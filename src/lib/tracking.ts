import "server-only";
import { neon } from "@neondatabase/serverless";
import { SEQUENCE_STEPS } from "./sequence-steps";
import { initConsentSchema } from "./consent";

/**
 * Per-email attribution for the nurture sequence.
 *
 * Calendly knows a booking happened but not what prompted it. Between that and
 * the sequence sits the question worth answering: which of the 22 emails
 * actually moves someone to book, and which are dead weight.
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

export const TRACKING_CONFIGURED = Boolean(connectionString());

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

/**
 * Delete every recorded click on a sequence link.
 *
 * Exists because the first clicks any of these links ever receive are the
 * operator's own, testing that the redirect works. Those are indistinguishable
 * from real ones afterwards — same table, same shape — and left in place they
 * quietly inflate the per-email figures the sequence is judged on for as long as
 * the list is small enough for a handful of clicks to matter, which is exactly
 * when those figures are being watched most closely.
 *
 * Clicks only. `sequence_bookings` is left alone: a booking is a real event with
 * a Calendly record behind it, and deleting one would misreport a call that
 * genuinely happened.
 *
 * Returns how many rows went, because a reset that cannot say what it removed is
 * indistinguishable from one that silently did nothing.
 */
export async function resetEmailClicks(): Promise<number> {
  const url = connectionString();
  if (!url) return 0;
  const sql = neon(url);
  await initTrackingSchema();

  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM email_clicks`) as { n: number }[];
  const removed = rows[0]?.n ?? 0;

  await sql`DELETE FROM email_clicks`;
  return removed;
}

/* ── reading ──────────────────────────────────────────────────────────────── */

export interface EmailAttribution {
  key: string;
  /** Accepted by the receiving server. The denominator worth using. */
  delivered: number;
  /** Rejected. A rising count here is what damages a sending domain. */
  bounced: number;
  /** Marked as spam. Gmail and Yahoo judge bulk senders at 0.3%. */
  complained: number;
  /** Booking-link clicks seen by /api/go/book. Not blocked, one link only. */
  clicks: number;
  /** Distinct people, where the merge tag identified them. */
  clickers: number;
  /**
   * Clicks reported by Resend's tracking, unsubscribes excluded. Covers every
   * link rather than just the button, so it should sit at or just above
   * `clicks` — a large gap either way means one of the two is not firing.
   */
  trackedClicks: number;
  trackedClickers: number;
  /** Opens. An image loading, not a person reading. Context, not a metric. */
  opens: number;
  openers: number;
  /** Clicks on the unsubscribe footer. The one click that is bad news. */
  unsubscribes: number;
  booked: number;
  canceled: number;
}

/** Clicks and bookings per sequence email, keyed for joining to SEQUENCE_STEPS. */
export async function getEmailAttribution(): Promise<
  Map<string, EmailAttribution>
> {
  const out = new Map<string, EmailAttribution>();
  const url = connectionString();
  if (!url) return out;
  const sql = neon(url);

  const blank = (key: string): EmailAttribution => ({
    key,
    delivered: 0,
    bounced: 0,
    complained: 0,
    clicks: 0,
    clickers: 0,
    trackedClicks: 0,
    trackedClickers: 0,
    opens: 0,
    openers: 0,
    unsubscribes: 0,
    booked: 0,
    canceled: 0,
  });
  const entryFor = (key: string) => {
    const existing = out.get(key) ?? blank(key);
    out.set(key, existing);
    return existing;
  };

  /**
   * Each read is isolated, so one missing table cannot zero the others.
   *
   * These are created on first write, so a table that does not exist yet is the
   * normal state of a fresh database rather than a fault. When all three shared
   * a try block, `email_events` not existing took the click and booking counts
   * down with it — and a dashboard cannot tell a zero that means "the query
   * broke" from a zero that means "nobody clicked".
   */
  const read = async <T>(label: string, run: () => Promise<T[]>): Promise<T[]> => {
    try {
      return await run();
    } catch (error) {
      console.error(`Attribution: ${label} read failed:`, error);
      return [];
    }
  };

  const clicks = await read("redirect clicks", async () =>
    (await sql`
      SELECT email_key,
             COUNT(*)::int                  AS clicks,
             COUNT(DISTINCT recipient)::int AS clickers
      FROM email_clicks GROUP BY email_key`) as {
      email_key: string;
      clicks: number;
      clickers: number;
    }[]
  );

  // One pass over email_events covering all five stored types. Counted with
  // FILTER rather than as five queries, because the row count here grows with
  // every send and this page is read on every refresh.
  const events = await read("resend events", async () =>
    (await sql`
      SELECT email_key,
             COUNT(*) FILTER (WHERE event_type = 'delivered')::int  AS delivered,
             COUNT(*) FILTER (WHERE event_type = 'bounced')::int    AS bounced,
             COUNT(*) FILTER (WHERE event_type = 'complained')::int AS complained,
             COUNT(*) FILTER (WHERE event_type = 'clicked')::int    AS tracked_clicks,
             COUNT(DISTINCT recipient)
               FILTER (WHERE event_type = 'clicked')::int           AS tracked_clickers,
             COUNT(*) FILTER (WHERE event_type = 'opened')::int     AS opens,
             COUNT(DISTINCT recipient)
               FILTER (WHERE event_type = 'opened')::int            AS openers,
             COUNT(*)
               FILTER (WHERE event_type = 'unsubscribe_clicked')::int AS unsubscribes
      FROM email_events
      WHERE email_key IS NOT NULL
      GROUP BY email_key`) as {
      email_key: string;
      delivered: number;
      bounced: number;
      complained: number;
      tracked_clicks: number;
      tracked_clickers: number;
      opens: number;
      openers: number;
      unsubscribes: number;
    }[]
  );

  const bookings = await read("bookings", async () =>
    (await sql`
      SELECT email_key, status, COUNT(DISTINCT email)::int AS n
      FROM sequence_bookings
      WHERE email_key IS NOT NULL
      GROUP BY email_key, status`) as {
      email_key: string;
      status: string;
      n: number;
    }[]
  );

  for (const row of events) {
    const entry = entryFor(row.email_key);
    entry.delivered = row.delivered;
    entry.bounced = row.bounced;
    entry.complained = row.complained;
    entry.trackedClicks = row.tracked_clicks;
    entry.trackedClickers = row.tracked_clickers;
    entry.opens = row.opens;
    entry.openers = row.openers;
    entry.unsubscribes = row.unsubscribes;
  }
  for (const row of clicks) {
    const entry = entryFor(row.email_key);
    entry.clicks = row.clicks;
    entry.clickers = row.clickers;
  }
  for (const row of bookings) {
    const entry = entryFor(row.email_key);
    if (row.status === "booked") entry.booked = row.n;
    else entry.canceled = row.n;
  }

  return out;
}

export interface StepToBooking {
  key: string;
  /** Distinct people who clicked a link in this email. */
  clickers: number;
  /**
   * Bookings whose last click before the booking was on this email. One booking
   * is credited to exactly one step, so these sum to the number of attributed
   * bookings rather than over-counting people who clicked several emails.
   */
  bookedLastTouch: number;
  /**
   * Bookings by someone who clicked this email at any point beforehand. A
   * booking appears under every email that contributed, so these sum to more
   * than the number of bookings — which is the point of having both.
   */
  bookedAssisted: number;
  /** Median hours from the last click to the booking, where there is one. */
  medianHoursToBook: number | null;
}

/**
 * Which sequence step precedes a booked audit.
 *
 * The join key is the recipient's email address, which both sides genuinely
 * carry: Resend reports `data.to[0]` on every event, and Calendly puts the
 * invitee's address in `payload.email` on `invitee.created`. Neither is inferred.
 *
 * Two credit models, because either alone misleads. Last touch answers "what
 * finally moved them" and is the one to judge a single email on; assisted
 * answers "what did they read on the way" and is the one to judge a *cut* on —
 * an email with no last-touch bookings can still be doing the work that makes
 * email 19 land, and dropping it on the first number alone would be a mistake.
 *
 * Only clicks at or before the booking count. Sequence sends continue until the
 * Calendly webhook marks the contact booked, so a later click is a real click on
 * an email that cannot have caused a booking that already happened.
 */
export async function getStepToBooking(): Promise<StepToBooking[]> {
  const url = connectionString();
  if (!url) return [];
  const sql = neon(url);

  try {
    const rows = (await sql`
      WITH clicks AS (
        SELECT recipient AS email, email_key, occurred_at
        FROM email_events
        WHERE event_type = 'clicked'
          AND email_key IS NOT NULL
          AND recipient IS NOT NULL
      ),
      bookings AS (
        SELECT email, MIN(created_at) AS booked_at
        FROM sequence_bookings
        WHERE status = 'booked'
        GROUP BY email
      ),
      -- The one click that immediately precedes each booking.
      last_touch AS (
        SELECT DISTINCT ON (b.email)
               b.email, b.booked_at, c.email_key, c.occurred_at
        FROM bookings b
        JOIN clicks c
          ON c.email = b.email AND c.occurred_at <= b.booked_at
        ORDER BY b.email, c.occurred_at DESC
      ),
      -- Every distinct email someone clicked before booking.
      assisted AS (
        SELECT DISTINCT b.email, c.email_key
        FROM bookings b
        JOIN clicks c
          ON c.email = b.email AND c.occurred_at <= b.booked_at
      )
      SELECT s.email_key                                   AS key,
             COUNT(DISTINCT s.email)::int                  AS clickers,
             COALESCE(lt.n, 0)::int                        AS booked_last_touch,
             COALESCE(a.n, 0)::int                         AS booked_assisted,
             lt.median_hours                               AS median_hours_to_book
      FROM clicks s
      LEFT JOIN (
        SELECT email_key,
               COUNT(*)::int AS n,
               PERCENTILE_CONT(0.5) WITHIN GROUP (
                 ORDER BY EXTRACT(EPOCH FROM (booked_at - occurred_at)) / 3600
               ) AS median_hours
        FROM last_touch GROUP BY email_key
      ) lt ON lt.email_key = s.email_key
      LEFT JOIN (
        SELECT email_key, COUNT(*)::int AS n FROM assisted GROUP BY email_key
      ) a ON a.email_key = s.email_key
      GROUP BY s.email_key, lt.n, a.n, lt.median_hours
      ORDER BY booked_last_touch DESC, clickers DESC`) as {
      key: string;
      clickers: number;
      booked_last_touch: number;
      booked_assisted: number;
      median_hours_to_book: string | number | null;
    }[];

    return rows.map((row) => ({
      key: row.key,
      clickers: row.clickers,
      bookedLastTouch: row.booked_last_touch,
      bookedAssisted: row.booked_assisted,
      medianHoursToBook:
        row.median_hours_to_book === null
          ? null
          : Math.round(Number(row.median_hours_to_book) * 10) / 10,
    }));
  } catch (error) {
    console.error("Attribution: step-to-booking read failed:", error);
    return [];
  }
}

export interface SubscriberPoint {
  /** ISO date, midnight UTC. */
  date: string;
  /** People who opted in that day. */
  added: number;
  /** Running total of opted-in subscribers as at that day. */
  total: number;
}

/**
 * Subscribers over time, one point per day.
 *
 * Counted from `marketing_consent`, which is append-only, so a person is
 * counted on the day of their *first* grant and a later withdrawal shows as the
 * running total flattening rather than as a retroactive edit to history.
 *
 * Days with no signups are filled in. Without that, a line chart would join
 * across a fortnight of silence and draw a gentle slope where nothing happened.
 */
export async function getSubscriberSeries(
  days = 60
): Promise<SubscriberPoint[]> {
  const url = connectionString();
  if (!url) return [];
  const sql = neon(url);

  // Created on first consent, not at deploy, so an untouched database has no
  // such table and the chart would show its empty state for a reason that has
  // nothing to do with how many people subscribed.
  try {
    await initConsentSchema();
  } catch (error) {
    console.error("Subscribers: consent schema check failed:", error);
  }

  try {
    const rows = (await sql`
      WITH first_grant AS (
        SELECT email, MIN(created_at) AS joined_at
        FROM marketing_consent
        WHERE granted = true
        GROUP BY email
      )
      SELECT (joined_at AT TIME ZONE 'UTC')::date::text AS date,
             COUNT(*)::int AS added
      FROM first_grant
      GROUP BY 1
      ORDER BY 1`) as { date: string; added: number }[];

    if (rows.length === 0) return [];

    const added = new Map(rows.map((r) => [r.date, r.added]));

    // Start at the earlier of the first signup and the requested window, so a
    // brand-new list is not padded with weeks of flat zero before it existed.
    const firstSeen = new Date(`${rows[0].date}T00:00:00Z`);
    const windowStart = new Date(Date.now() - (days - 1) * 86_400_000);
    windowStart.setUTCHours(0, 0, 0, 0);
    const start = firstSeen > windowStart ? firstSeen : windowStart;

    // Everyone who joined before the window still counts towards the total.
    let running = rows
      .filter((r) => new Date(`${r.date}T00:00:00Z`) < start)
      .reduce((sum, r) => sum + r.added, 0);

    const series: SubscriberPoint[] = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10);
      const todayAdded = added.get(date) ?? 0;
      running += todayAdded;
      series.push({ date, added: todayAdded, total: running });
    }

    return series;
  } catch (error) {
    console.error("Subscribers: series read failed:", error);
    return [];
  }
}
