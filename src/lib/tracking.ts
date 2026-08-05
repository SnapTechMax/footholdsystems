import "server-only";
import { neon } from "@neondatabase/serverless";
import { SEQUENCE_STEPS } from "./sequence-steps";
import { initConsentSchema } from "./consent";

/**
 * Per-email attribution for the nurture sequence.
 *
 * Resend's API reports neither opens nor clicks for automations, and Calendly
 * knows a booking happened but not what prompted it. Between them sits the
 * question worth answering: which of the 22 emails actually moves someone to
 * book, and which are dead weight.
 *
 * Two facts are recorded here, both server-side so ad blockers cannot thin them
 * out the way they thin out the Meta pixel:
 *
 *  - **Clicks**, by `/api/go/book`. Every booking link in the sequence points at
 *    that redirect rather than straight at Calendly, so the click is logged
 *    before the visitor is handed on.
 *  - **Bookings**, by the Calendly webhook, tagged with the email whose link
 *    started the visit. Calendly passes the UTM parameters it was opened with
 *    back in the webhook payload, which is what makes the join possible.
 *
 * Neither write is allowed to break the thing it measures: a failed click
 * insert still redirects, and a failed booking insert still returns 200 so
 * Calendly stops retrying.
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

  // Delivery outcomes reported by Resend's webhook: delivered, bounced,
  // complained. Nothing is embedded in the email to collect these — they come
  // from the receiving server's SMTP response and from feedback loops, which is
  // what makes them free of the deliverability cost a tracking pixel carries.
  await sql`
    CREATE TABLE IF NOT EXISTS email_deliveries (
      id         BIGSERIAL PRIMARY KEY,
      email_key  TEXT,
      kind       TEXT NOT NULL,
      recipient  TEXT,
      email_id   TEXT,
      detail     TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  await sql`
    CREATE INDEX IF NOT EXISTS email_deliveries_key
      ON email_deliveries (email_key, kind, created_at DESC)`;
  // One row per Resend event id, so a webhook retry cannot count twice.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS email_deliveries_unique
      ON email_deliveries (email_id, kind)
      WHERE email_id IS NOT NULL`;

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

export async function recordDelivery(input: {
  kind: "delivered" | "bounced" | "complained";
  subject: string | null;
  recipient: string | null;
  emailId: string | null;
  detail: string | null;
}): Promise<void> {
  const url = connectionString();
  if (!url) return;
  const sql = neon(url);
  await initTrackingSchema();
  await sql`
    INSERT INTO email_deliveries (email_key, kind, recipient, email_id, detail)
    VALUES (
      ${keyFromSubject(input.subject)}, ${input.kind},
      ${cleanRecipient(input.recipient)}, ${input.emailId}, ${input.detail}
    )
    ON CONFLICT DO NOTHING`;
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
  clicks: number;
  /** Distinct people, where the merge tag identified them. */
  clickers: number;
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

  try {
    const clicks = (await sql`
      SELECT email_key,
             COUNT(*)::int                      AS clicks,
             COUNT(DISTINCT recipient)::int     AS clickers
      FROM email_clicks GROUP BY email_key`) as {
      email_key: string;
      clicks: number;
      clickers: number;
    }[];

    const bookings = (await sql`
      SELECT email_key, status, COUNT(DISTINCT email)::int AS n
      FROM sequence_bookings
      WHERE email_key IS NOT NULL
      GROUP BY email_key, status`) as {
      email_key: string;
      status: string;
      n: number;
    }[];

    const deliveries = (await sql`
      SELECT email_key, kind, COUNT(*)::int AS n
      FROM email_deliveries
      WHERE email_key IS NOT NULL
      GROUP BY email_key, kind`) as {
      email_key: string;
      kind: string;
      n: number;
    }[];

    const blank = (key: string): EmailAttribution => ({
      key,
      delivered: 0,
      bounced: 0,
      complained: 0,
      clicks: 0,
      clickers: 0,
      booked: 0,
      canceled: 0,
    });

    for (const row of deliveries) {
      const entry = out.get(row.email_key) ?? blank(row.email_key);
      if (row.kind === "delivered") entry.delivered = row.n;
      else if (row.kind === "bounced") entry.bounced = row.n;
      else if (row.kind === "complained") entry.complained = row.n;
      out.set(row.email_key, entry);
    }
    for (const row of clicks) {
      const entry = out.get(row.email_key) ?? blank(row.email_key);
      entry.clicks = row.clicks;
      entry.clickers = row.clickers;
      out.set(row.email_key, entry);
    }
    for (const row of bookings) {
      const entry = out.get(row.email_key) ?? blank(row.email_key);
      if (row.status === "booked") entry.booked = row.n;
      else entry.canceled = row.n;
      out.set(row.email_key, entry);
    }
  } catch (error) {
    // An empty database is normal here — these tables are created on first
    // write — but the failure is still logged. A zero meaning "the query broke"
    // and a zero meaning "nobody clicked" look identical on a dashboard.
    console.error("Attribution: read failed:", error);
  }

  return out;
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
