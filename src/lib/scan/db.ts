import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "@/lib/pg";
import { DEFAULT_CATEGORY, isBusinessCategory, type BusinessCategory } from "./categories";
import type { OraScan, ScanReport } from "./types";

/**
 * Storage for the free-scan funnel.
 *
 * Three tables, because they answer three different questions and have three
 * different lifetimes:
 *
 *  - `scan_leads` is the mailing list. One row per email address, ever.
 *  - `scans` is one row per requested scan. A lead can request several.
 *  - `scan_orders` is money. Kept separate from `scans` so a refund, a second
 *    product, or a payment that arrives before the scan finishes are all
 *    ordinary rows rather than schema problems.
 */

export type ScanStatus = "queued" | "running" | "complete" | "failed";

/** Products someone can buy against a scan. Values are stored, so don't rename. */
export type OrderProduct = "solutions" | "done_for_you";
export type OrderStatus = "pending" | "paid" | "refunded";

/**
 * What was handed over when a build finished.
 *
 * Filled in by an admin after the work is delivered, and the only thing that
 * makes the handover page reachable. Stored on the scan rather than in its own
 * table because there is exactly one of these per build, and a JSONB column
 * absorbs a new field later without a migration.
 */
export interface Handover {
  /** The machine-readable site we built them. The reason they paid. */
  secondDomain: string;
  /** What changed, in the admin's words. Rendered as paragraphs. */
  notes: string;
  /** ISO date the work was delivered. */
  deliveredAt: string;
}

export interface ScanRow {
  id: number;
  token: string;
  leadId: number;
  email: string;
  domain: string;
  url: string;
  category: BusinessCategory;
  status: ScanStatus;
  score: number | null;
  grade: string | null;
  report: ScanReport | null;
  raw: OraScan | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  completedAt: string | null;
  reportEmailedAt: string | null;
  /** Null until the report is first read. See `markReportOpened`. */
  reportOpenedAt: string | null;
  handover: Handover | null;
  /**
   * True when an admin queued this from /admin/outreach rather than a visitor
   * asking for it.
   *
   * It decides three things, and all three are the difference between a lead
   * and a stranger: nothing is emailed (there is no customer here, only a
   * domain), nothing is paywalled (the whole report is the pitch), and the
   * report is read at /audit/<token> rather than /scan/<token>.
   */
  outreach: boolean;
  /** Meta's `_fbp` from the visit that created the lead, for later events. */
  fbp: string | null;
  /** Meta's `_fbc` from the visit that created the lead, for later events. */
  fbc: string | null;
}

/**
 * Public identifier for a scan, used in the report URL and the email link.
 *
 * 32 bytes of CSPRNG, base64url. This is the *only* thing standing between a
 * stranger and someone else's report, so it is not a sequential id and not a
 * UUIDv4 — an unguessable token is doing real access-control work here.
 */
function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Create tables if they don't exist. Safe to call on every request. */
export async function initScanSchema(): Promise<void> {
  const db = sql();

  await db`
    CREATE TABLE IF NOT EXISTS scan_leads (
      id              BIGSERIAL PRIMARY KEY,
      email           TEXT NOT NULL,
      consent_text    TEXT NOT NULL,
      consent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      ip_address      TEXT,
      user_agent      TEXT,
      attribution     JSONB,
      unsubscribed_at TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  /**
   * Meta's own browser cookies, kept against the lead.
   *
   * They are read from the request at scan time and used immediately for the
   * Lead conversion, which was the only thing that needed them while every
   * conversion fired in the same visit. ReportOpened does not: the report link
   * is emailed, so it is opened later, often on a phone rather than the browser
   * that saw the ad, and that browser has no _fbc to offer. Storing them here
   * means the later event can still be matched back to the click that paid for
   * it, which for a $1,497 product is the difference between an attributed sale
   * and an anonymous one.
   */
  await db`ALTER TABLE scan_leads ADD COLUMN IF NOT EXISTS fbp TEXT`;
  await db`ALTER TABLE scan_leads ADD COLUMN IF NOT EXISTS fbc TEXT`;

  // Case-insensitive uniqueness. Addresses are stored lowercased, but the index
  // is the thing that actually stops MAX@x.com and max@x.com becoming two
  // subscribers if a caller ever forgets to normalise.
  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS scan_leads_email_key
      ON scan_leads (lower(email))`;

  await db`
    CREATE TABLE IF NOT EXISTS scans (
      id                BIGSERIAL PRIMARY KEY,
      token             TEXT NOT NULL UNIQUE,
      lead_id           BIGINT NOT NULL REFERENCES scan_leads(id) ON DELETE CASCADE,
      domain            TEXT NOT NULL,
      url               TEXT NOT NULL,
      category          TEXT NOT NULL DEFAULT 'sbo',
      status            TEXT NOT NULL DEFAULT 'queued',
      score             INTEGER,
      grade             TEXT,
      report            JSONB,
      raw               JSONB,
      error             TEXT,
      attempts          INTEGER NOT NULL DEFAULT 0,
      ip_address        TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      started_at        TIMESTAMPTZ,
      completed_at      TIMESTAMPTZ,
      report_emailed_at TIMESTAMPTZ
    )`;

  // The CREATE above only runs on a fresh install, so an existing deployment
  // needs the column added explicitly. IF NOT EXISTS makes this a no-op
  // everywhere else, which is what keeps initSchema safe to call per request.
  await db`ALTER TABLE scans ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'sbo'`;
  // Set once a build is delivered. Null until then, which is what the handover
  // page checks before it will render anything.
  await db`ALTER TABLE scans ADD COLUMN IF NOT EXISTS handover JSONB`;
  /**
   * When the report was first read, and the guard on the ReportOpened event.
   *
   * In the database rather than in localStorage, unlike every other conversion
   * guard here, because this one cannot be a per-browser fact. The report link
   * is emailed and lives forever; the same person opens it on a laptop and then
   * a phone, and a per-browser guard would report that as two. One column, one
   * conditional UPDATE, one event per scan for all time.
   */
  await db`ALTER TABLE scans ADD COLUMN IF NOT EXISTS report_opened_at TIMESTAMPTZ`;
  /**
   * Marks a scan we ran on somebody who never asked.
   *
   * Cold outbound: an admin types a prospect's domain into /admin/outreach, we
   * scan it, and the resulting link goes out in an email. That row is not a
   * lead — nobody consented to anything — so it must never be emailed a report
   * and must never be counted as one. A column rather than a separate table
   * because it is the same scan, run for a different reason, and every reader
   * downstream (the report builder, the paywall, the sweeper) wants the same
   * shape.
   */
  await db`ALTER TABLE scans ADD COLUMN IF NOT EXISTS outreach BOOLEAN NOT NULL DEFAULT false`;

  await db`CREATE INDEX IF NOT EXISTS scans_status_idx ON scans (status, created_at)`;
  // Partial, because outreach rows are a small minority of the table and the
  // admin panel is the only thing that ever asks for them.
  await db`
    CREATE INDEX IF NOT EXISTS scans_outreach_idx
      ON scans (created_at DESC) WHERE outreach`;
  await db`CREATE INDEX IF NOT EXISTS scans_lead_idx ON scans (lead_id)`;
  // Powers the per-IP throttle, which is what protects Ora's 30-scans-a-day
  // ceiling from a single bored visitor.
  await db`CREATE INDEX IF NOT EXISTS scans_ip_created_idx ON scans (ip_address, created_at)`;

  await db`
    CREATE TABLE IF NOT EXISTS scan_orders (
      id           BIGSERIAL PRIMARY KEY,
      scan_id      BIGINT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
      product      TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      provider     TEXT,
      provider_ref TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      paid_at      TIMESTAMPTZ
    )`;

  // One paid order per product per scan. Payment webhooks retry, and without
  // this a provider replaying a delivery would grant the same unlock twice and
  // double the revenue figure.
  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS scan_orders_paid_once
      ON scan_orders (scan_id, product) WHERE status = 'paid'`;

  // Looked up by the webhook, which knows the provider's id and nothing else.
  await db`
    CREATE INDEX IF NOT EXISTS scan_orders_provider_ref_idx
      ON scan_orders (provider_ref)`;
}

/* ── leads ────────────────────────────────────────────────────────────────── */

export interface LeadInput {
  email: string;
  consentText: string;
  ipAddress: string | null;
  userAgent: string | null;
  attribution: Record<string, unknown> | null;
  /** Meta's `_fbp` cookie, when the browser had one. */
  fbp?: string | null;
  /** Meta's `_fbc` cookie — the click that brought them. */
  fbc?: string | null;
}

/**
 * Records the subscriber, returning their id.
 *
 * A repeat requester updates the consent record rather than being rejected:
 * the most recent agreement is the one we would have to defend, and someone
 * scanning a second site has just consented again.
 *
 * Re-subscribing deliberately clears `unsubscribed_at`. They asked for this
 * one; honouring an old opt-out by silently not sending the thing they just
 * requested would be the wrong kind of respectful.
 */
export async function upsertLead(input: LeadInput): Promise<number> {
  const db = sql();
  const email = input.email.trim().toLowerCase();

  const rows = (await db`
    INSERT INTO scan_leads (email, consent_text, ip_address, user_agent, attribution, fbp, fbc)
    VALUES (
      ${email}, ${input.consentText}, ${input.ipAddress}, ${input.userAgent},
      ${input.attribution ? JSON.stringify(input.attribution) : null}::jsonb,
      ${input.fbp ?? null}, ${input.fbc ?? null}
    )
    ON CONFLICT (lower(email)) DO UPDATE SET
      consent_text    = EXCLUDED.consent_text,
      consent_at      = now(),
      ip_address      = COALESCE(EXCLUDED.ip_address, scan_leads.ip_address),
      user_agent      = COALESCE(EXCLUDED.user_agent, scan_leads.user_agent),
      attribution     = COALESCE(EXCLUDED.attribution, scan_leads.attribution),
      -- Newest non-null wins. A returning visitor arriving from a fresh ad
      -- click carries a newer _fbc, and that click is the one that should be
      -- credited with whatever they do next.
      fbp             = COALESCE(EXCLUDED.fbp, scan_leads.fbp),
      fbc             = COALESCE(EXCLUDED.fbc, scan_leads.fbc),
      unsubscribed_at = NULL
    RETURNING id`) as { id: number }[];

  return Number(rows[0].id);
}

export async function unsubscribe(email: string): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    UPDATE scan_leads SET unsubscribed_at = now()
    WHERE lower(email) = ${email.trim().toLowerCase()} AND unsubscribed_at IS NULL
    RETURNING id`) as { id: number }[];
  return rows.length > 0;
}

/* ── scans ────────────────────────────────────────────────────────────────── */

/**
 * Queues a scan and returns its row.
 *
 * If this lead already has a completed scan for this domain from the last 24
 * hours, that one comes back instead of a new one being queued. Re-submitting
 * the same site is the most likely duplicate, and each one costs a slot out of
 * Ora's daily ceiling.
 */
export async function createScan(args: {
  leadId: number;
  domain: string;
  url: string;
  category: BusinessCategory;
  ipAddress: string | null;
}): Promise<{ id: number; token: string; reused: boolean }> {
  const db = sql();

  const existing = (await db`
    SELECT id, token FROM scans
    WHERE lead_id = ${args.leadId}
      AND domain = ${args.domain}
      -- Same site, different category is a different report, so it does not
      -- count as a duplicate and is worth a fresh scan.
      AND category = ${args.category}
      AND status = 'complete'
      AND completed_at > now() - INTERVAL '24 hours'
    ORDER BY completed_at DESC
    LIMIT 1`) as { id: number; token: string }[];

  if (existing.length > 0) {
    return { id: Number(existing[0].id), token: existing[0].token, reused: true };
  }

  const token = newToken();
  const rows = (await db`
    INSERT INTO scans (token, lead_id, domain, url, category, ip_address)
    VALUES (${token}, ${args.leadId}, ${args.domain}, ${args.url}, ${args.category}, ${args.ipAddress})
    RETURNING id, token`) as { id: number; token: string }[];

  return { id: Number(rows[0].id), token: rows[0].token, reused: false };
}

/**
 * How many scans this IP has started in the last hour.
 *
 * Ora's ceiling is 30 scans per rolling 24 hours for our whole deployment, so
 * one visitor hammering the form does not just cost us money, it takes the
 * feature away from everyone else for the rest of the day.
 */
export async function recentScanCountForIp(ip: string): Promise<number> {
  const db = sql();
  const rows = (await db`
    SELECT count(*)::int AS n FROM scans
    WHERE ip_address = ${ip} AND created_at > now() - INTERVAL '1 hour'`) as {
    n: number;
  }[];
  return rows[0]?.n ?? 0;
}

/** Total scans started in the last rolling 24 hours. A cost backstop, not a quota. */
export async function scansStartedToday(): Promise<number> {
  const db = sql();
  const rows = (await db`
    SELECT count(*)::int AS n FROM scans
    WHERE created_at > now() - INTERVAL '24 hours' AND status <> 'failed'`) as {
    n: number;
  }[];
  return rows[0]?.n ?? 0;
}

/**
 * Scans started in the last minute, across everybody.
 *
 * The scan provider's only real limit is a burst one — 10 a minute for the
 * whole deployment, since Vercel gives us a single outbound IP. This is what
 * the request path checks against it. Deliberately global rather than per-IP:
 * the limit is global, so counting per visitor would measure the wrong thing.
 */
export async function scansStartedInLastMinute(): Promise<number> {
  const db = sql();
  const rows = (await db`
    SELECT count(*)::int AS n FROM scans
    WHERE created_at > now() - INTERVAL '1 minute' AND status <> 'failed'`) as {
    n: number;
  }[];
  return rows[0]?.n ?? 0;
}

/**
 * Claims a queued scan for processing.
 *
 * The status check is inside the UPDATE rather than a separate SELECT so two
 * concurrent workers cannot both claim the same row — the second one updates
 * zero rows and gets null back. `after()` and the cron sweeper can and do
 * overlap.
 */
export async function claimScan(id: number): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    UPDATE scans
    SET status = 'running', started_at = now(), attempts = attempts + 1
    WHERE id = ${id} AND status IN ('queued', 'failed')
    RETURNING id`) as { id: number }[];
  return rows.length > 0;
}

export async function completeScan(args: {
  id: number;
  score: number;
  grade: string;
  report: ScanReport;
  raw: OraScan;
}): Promise<void> {
  const db = sql();
  await db`
    UPDATE scans SET
      status = 'complete',
      score = ${args.score},
      grade = ${args.grade},
      report = ${JSON.stringify(args.report)}::jsonb,
      raw = ${JSON.stringify(args.raw)}::jsonb,
      error = NULL,
      completed_at = now()
    WHERE id = ${args.id}`;
}

/**
 * Changes the business type a scan is scored against.
 *
 * For when somebody picked the wrong one. That is not a hypothetical: before
 * the types were split five ways, a web developer with no product API had
 * nowhere to put himself except "SaaS" and got a report demanding an OpenAPI
 * spec, and the same shape catches anyone who mis-picks in a hurry.
 *
 * Only the column moves here. The report page rebuilds from `raw` on every
 * view, so this alone corrects what the customer sees on the URL they already
 * have — no new token, no second email. The caller is expected to follow with
 * `completeScan` to bring the stored report, score and grade back in step,
 * because those are what the admin views and the emails read.
 */
export async function setScanCategory(
  id: number,
  category: BusinessCategory
): Promise<void> {
  const db = sql();
  await db`UPDATE scans SET category = ${category} WHERE id = ${id}`;
}

export async function failScan(id: number, error: string): Promise<void> {
  const db = sql();
  // Truncated: this is third-party error text of unbounded length and it is
  // only ever read by us.
  await db`
    UPDATE scans SET status = 'failed', error = ${error.slice(0, 2000)}
    WHERE id = ${id}`;
}

/**
 * Records what was delivered, which is what makes the handover page render.
 *
 * Overwrites rather than appending: there is one delivery per build, and an
 * admin correcting a typo should not create a second one.
 */
export async function setHandover(
  scanId: number,
  handover: Handover
): Promise<void> {
  const db = sql();
  await db`
    UPDATE scans SET handover = ${JSON.stringify(handover)}::jsonb
    WHERE id = ${scanId}`;
}

/** Clears a handover, so the page goes back to being unreachable. */
export async function clearHandover(scanId: number): Promise<void> {
  const db = sql();
  await db`UPDATE scans SET handover = NULL WHERE id = ${scanId}`;
}

export async function markReportEmailed(id: number): Promise<void> {
  const db = sql();
  await db`UPDATE scans SET report_emailed_at = now() WHERE id = ${id}`;
}

/**
 * Claims the first read of a report, returning true only for the caller that won.
 *
 * The conditional UPDATE is the whole point. The report page is
 * force-dynamic, so this runs on every request, and two tabs opened together
 * are two concurrent requests racing for the same row. `WHERE report_opened_at
 * IS NULL` makes the database the arbiter: exactly one UPDATE matches, one
 * caller gets a row back, and everybody else gets an empty array and fires
 * nothing. Doing this as a read-then-write in application code would let both
 * tabs read null and both send a conversion.
 */
export async function markReportOpened(id: number): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    UPDATE scans SET report_opened_at = now()
    WHERE id = ${id} AND report_opened_at IS NULL
    RETURNING id`) as { id: number }[];
  return rows.length > 0;
}

const SCAN_SELECT = `
  s.id, s.token, s.lead_id, s.domain, s.url, s.category, s.status, s.score, s.grade,
  s.report, s.raw, s.error, s.attempts, s.created_at, s.completed_at,
  s.report_emailed_at, s.report_opened_at, s.handover, s.outreach,
  l.email, l.fbp, l.fbc`;

interface RawScanRow {
  id: number | string;
  token: string;
  lead_id: number | string;
  email: string;
  domain: string;
  url: string;
  category: string;
  status: ScanStatus;
  score: number | null;
  grade: string | null;
  report: ScanReport | null;
  raw: OraScan | null;
  error: string | null;
  attempts: number;
  created_at: string;
  completed_at: string | null;
  report_emailed_at: string | null;
  report_opened_at: string | null;
  handover: unknown;
  outreach: boolean | null;
  fbp: string | null;
  fbc: string | null;
}

function toScanRow(r: RawScanRow): ScanRow {
  return {
    id: Number(r.id),
    token: r.token,
    leadId: Number(r.lead_id),
    email: r.email,
    domain: r.domain,
    url: r.url,
    // Widened to string on the way out of Postgres, so it is narrowed here
    // rather than trusted. A row written before this column existed carries the
    // default, and anything unrecognised falls back rather than throwing.
    category: isBusinessCategory(r.category) ? r.category : DEFAULT_CATEGORY,
    status: r.status,
    score: r.score,
    grade: r.grade,
    report: r.report,
    raw: r.raw,
    error: r.error,
    attempts: r.attempts,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    handover: (r.handover as Handover | null) ?? null,
    // Explicit rather than truthy: a row written before the column existed
    // reads as null, and null is not outreach.
    outreach: r.outreach === true,
    reportEmailedAt: r.report_emailed_at,
    reportOpenedAt: r.report_opened_at,
    fbp: r.fbp,
    fbc: r.fbc,
  };
}

export async function getScanById(id: number): Promise<ScanRow | null> {
  const db = sql();
  const rows = (await db.query(
    `SELECT ${SCAN_SELECT} FROM scans s JOIN scan_leads l ON l.id = s.lead_id WHERE s.id = $1`,
    [id]
  )) as RawScanRow[];
  return rows[0] ? toScanRow(rows[0]) : null;
}

export async function getScanByToken(token: string): Promise<ScanRow | null> {
  const db = sql();
  const rows = (await db.query(
    `SELECT ${SCAN_SELECT} FROM scans s JOIN scan_leads l ON l.id = s.lead_id WHERE s.token = $1`,
    [token]
  )) as RawScanRow[];
  return rows[0] ? toScanRow(rows[0]) : null;
}

/**
 * Scans that need another go.
 *
 * Covers two failure shapes: something queued that nothing ever picked up (the
 * invocation died before `after()` ran), and something that went `running` and
 * stayed there (the invocation was killed mid-scan). Both look identical to a
 * waiting customer, so both are swept.
 */
export async function findStuckScans(limit = 5): Promise<ScanRow[]> {
  const db = sql();
  const rows = (await db.query(
    `SELECT ${SCAN_SELECT}
       FROM scans s JOIN scan_leads l ON l.id = s.lead_id
      WHERE s.attempts < 3
        AND (
          (s.status = 'queued'  AND s.created_at < now() - INTERVAL '2 minutes')
          OR (s.status = 'running' AND s.started_at < now() - INTERVAL '10 minutes')
          OR (s.status = 'failed'  AND s.created_at > now() - INTERVAL '24 hours')
        )
      ORDER BY s.created_at
      LIMIT $1`,
    [limit]
  )) as RawScanRow[];
  return rows.map(toScanRow);
}

/** Completed scans whose report never went out — the sweeper retries these. */
export async function findUnemailedScans(limit = 10): Promise<ScanRow[]> {
  const db = sql();
  const rows = (await db.query(
    `SELECT ${SCAN_SELECT}
       FROM scans s JOIN scan_leads l ON l.id = s.lead_id
      WHERE s.status = 'complete'
        AND s.report_emailed_at IS NULL
        AND l.unsubscribed_at IS NULL
        -- Outreach scans have no recipient. They hang off an internal lead row
        -- whose only purpose is satisfying the foreign key, and without this
        -- the sweeper would post a prospect's report to ourselves every ten
        -- minutes until it gave up.
        AND NOT s.outreach
      ORDER BY s.completed_at
      LIMIT $1`,
    [limit]
  )) as RawScanRow[];
  return rows.map(toScanRow);
}

/**
 * The most recent scan belonging to an email address.
 *
 * Purchases made from the nurture sequence carry no scan token: the link is in
 * an email, not on a report page, so all it can pass is who clicked it. Orders
 * still have to hang off a scan, because that is what `scan_orders` references
 * and what the unlock is granted against.
 *
 * Most recent rather than first: someone who scanned two sites and then bought
 * is far more likely to mean the one they looked at last.
 */
export async function findLatestScanForEmail(
  email: string
): Promise<ScanRow | null> {
  const db = sql();
  const rows = (await db.query(
    `SELECT ${SCAN_SELECT}
       FROM scans s JOIN scan_leads l ON l.id = s.lead_id
      WHERE lower(l.email) = $1
      ORDER BY s.created_at DESC
      LIMIT 1`,
    [email.trim().toLowerCase()]
  )) as RawScanRow[];
  return rows[0] ? toScanRow(rows[0]) : null;
}

/**
 * The most recent completed scan for a domain, whoever ran it.
 *
 * For admin work, where the thing being talked about is a website rather than a
 * token nobody has memorised. Expects an already-normalised hostname — pass it
 * through `normaliseDomain` first, or "www.Example.com/" will not match the
 * "example.com" that was stored.
 *
 * Completed only. An admin correcting a report means the one that exists, not a
 * queued row with nothing in it yet.
 */
export async function findLatestScanForDomain(
  domain: string
): Promise<ScanRow | null> {
  const db = sql();
  const rows = (await db.query(
    // The join is not optional: SCAN_SELECT ends in `l.email`, so omitting it
    // is a "missing FROM-clause entry for table l" at runtime rather than a
    // compile error. Every other query here joins for the same reason.
    `SELECT ${SCAN_SELECT}
       FROM scans s JOIN scan_leads l ON l.id = s.lead_id
      WHERE s.domain = $1 AND s.status = 'complete'
      ORDER BY s.completed_at DESC NULLS LAST, s.created_at DESC
      LIMIT 1`,
    [domain]
  )) as RawScanRow[];
  return rows[0] ? toScanRow(rows[0]) : null;
}

/* ── outreach ─────────────────────────────────────────────────────────────── */

/**
 * The lead row every outreach scan hangs off.
 *
 * `scans.lead_id` is NOT NULL and references `scan_leads`, which is correct for
 * every scan a person asks for. An outreach scan has no person: we picked the
 * domain, and the prospect finds out when the email lands. Making the column
 * nullable would push an `email: string | null` through the report builder, the
 * emailer and both Meta paths to serve one case, so instead there is a single
 * internal row and every outreach scan points at it.
 *
 * On our own domain, so that if anything ever does send to it, it reaches us
 * and not a stranger.
 */
export const OUTREACH_LEAD_EMAIL = "outreach@footholdsystems.com";

/**
 * Finds or creates that row.
 *
 * Written with `unsubscribed_at` set on purpose. Nothing should ever mail this
 * address, and the column every sender in this codebase already checks is the
 * one that says so. `upsertLead` is deliberately not reused: it clears
 * `unsubscribed_at`, which is right for a human asking again and wrong here.
 */
async function outreachLeadId(): Promise<number> {
  const db = sql();
  const rows = (await db`
    INSERT INTO scan_leads (email, consent_text, unsubscribed_at)
    VALUES (
      ${OUTREACH_LEAD_EMAIL},
      'Internal row for admin-run outreach scans. Not a subscriber, never mailed.',
      now()
    )
    ON CONFLICT (lower(email)) DO UPDATE SET email = EXCLUDED.email
    RETURNING id`) as { id: number }[];
  return Number(rows[0].id);
}

/**
 * Queues a scan an admin asked for, on a domain that did not ask for it.
 *
 * Reuses a completed outreach scan for the same domain and category from the
 * last 24 hours, the same way `createScan` does and for the same reason: typing
 * the same prospect in twice should not spend a second provider slot on an
 * answer we already hold. Only ever reuses an outreach row — a visitor's scan
 * of the same domain belongs to them, and its token is their credential.
 */
export async function createOutreachScan(args: {
  domain: string;
  url: string;
  category: BusinessCategory;
}): Promise<{ id: number; token: string; reused: boolean }> {
  const db = sql();

  const existing = (await db`
    SELECT id, token FROM scans
    WHERE outreach
      AND domain = ${args.domain}
      AND category = ${args.category}
      AND status = 'complete'
      AND completed_at > now() - INTERVAL '24 hours'
    ORDER BY completed_at DESC
    LIMIT 1`) as { id: number; token: string }[];

  if (existing.length > 0) {
    return { id: Number(existing[0].id), token: existing[0].token, reused: true };
  }

  const leadId = await outreachLeadId();
  const token = newToken();
  const rows = (await db`
    INSERT INTO scans (token, lead_id, domain, url, category, outreach)
    VALUES (${token}, ${leadId}, ${args.domain}, ${args.url}, ${args.category}, true)
    RETURNING id, token`) as { id: number; token: string }[];

  return { id: Number(rows[0].id), token: rows[0].token, reused: false };
}

/**
 * One line of the outreach panel.
 *
 * A projection rather than a `ScanRow`, because the panel lists twenty-five of
 * them and a `ScanRow` carries two JSONB documents each: the built report and
 * the raw provider payload. Nothing on that screen reads either.
 */
export interface OutreachScanSummary {
  id: number;
  token: string;
  domain: string;
  category: BusinessCategory;
  status: ScanStatus;
  score: number | null;
  grade: string | null;
  error: string | null;
  findingCount: number;
  /** Whether this prospect has bought the build. The number that matters. */
  paid: boolean;
  createdAt: string;
  completedAt: string | null;
}

interface RawOutreachRow {
  id: number | string;
  token: string;
  domain: string;
  category: string;
  status: ScanStatus;
  score: number | null;
  grade: string | null;
  error: string | null;
  finding_count: number | string | null;
  paid: boolean;
  created_at: string;
  completed_at: string | null;
}

const OUTREACH_SELECT = `
  s.id, s.token, s.domain, s.category, s.status, s.score, s.grade, s.error,
  s.created_at, s.completed_at,
  COALESCE(jsonb_array_length(s.report -> 'findings'), 0) AS finding_count,
  EXISTS (
    SELECT 1 FROM scan_orders o
     WHERE o.scan_id = s.id AND o.product = 'done_for_you' AND o.status = 'paid'
  ) AS paid`;

function toOutreachSummary(r: RawOutreachRow): OutreachScanSummary {
  return {
    id: Number(r.id),
    token: r.token,
    domain: r.domain,
    category: isBusinessCategory(r.category) ? r.category : DEFAULT_CATEGORY,
    status: r.status,
    score: r.score,
    grade: r.grade,
    error: r.error,
    findingCount: Number(r.finding_count ?? 0),
    paid: r.paid === true,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

/** The outreach scans, newest first. The whole content of the admin panel. */
export async function listOutreachScans(
  limit = 25
): Promise<OutreachScanSummary[]> {
  const db = sql();
  const rows = (await db.query(
    `SELECT ${OUTREACH_SELECT}
       FROM scans s
      WHERE s.outreach
      ORDER BY s.created_at DESC
      LIMIT $1`,
    [limit]
  )) as RawOutreachRow[];
  return rows.map(toOutreachSummary);
}

/**
 * Outreach scans still waiting to run.
 *
 * The panel runs these itself rather than waiting on the sweeper. A ten-minute
 * cron is the right answer for a customer who has already been told the report
 * is coming by email, and the wrong one for an admin sitting in front of the
 * screen that queued it.
 *
 * Includes rows left `running` by an invocation that died, on the same
 * ten-minute rule `findStuckScans` uses, so a killed scan is recoverable from
 * the panel and not only by cron.
 */
export async function findQueuedOutreachScans(
  limit = 8
): Promise<{ id: number; domain: string }[]> {
  const db = sql();
  const rows = (await db`
    SELECT id, domain FROM scans
     WHERE outreach
       AND attempts < 3
       AND (
         status = 'queued'
         OR (status = 'running' AND started_at < now() - INTERVAL '10 minutes')
         OR (status = 'failed' AND created_at > now() - INTERVAL '24 hours')
       )
     ORDER BY created_at
     LIMIT ${limit}`) as { id: number | string; domain: string }[];
  return rows.map((r) => ({ id: Number(r.id), domain: r.domain }));
}

/* ── orders ───────────────────────────────────────────────────────────────── */

/** Has this scan paid for this product? The paywall's only question. */
export async function isPaid(
  scanId: number,
  product: OrderProduct
): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    SELECT 1 AS ok FROM scan_orders
    WHERE scan_id = ${scanId} AND product = ${product} AND status = 'paid'
    LIMIT 1`) as { ok: number }[];
  return rows.length > 0;
}

/**
 * Removes a SIMULATED payment, so a test can be re-run.
 *
 * Scoped to provider = 'simulated' in the query itself rather than checked in
 * the caller: this deletes a row that grants paid access, and the guarantee
 * that it can never touch a real Whop order should live where it cannot be
 * forgotten. A caller passing a real order's ids simply deletes nothing.
 */
export async function removeSimulatedPayment(
  scanId: number,
  product: OrderProduct
): Promise<boolean> {
  const db = sql();
  const rows = (await db`
    DELETE FROM scan_orders
    WHERE scan_id = ${scanId} AND product = ${product} AND provider = 'simulated'
    RETURNING id`) as { id: number }[];
  return rows.length > 0;
}

/**
 * Records a completed payment.
 *
 * Idempotent by design — payment providers retry webhooks, and Whop is no
 * exception. The partial unique index makes the second delivery a no-op rather
 * than a duplicate row, and `RETURNING` tells the caller which one this was so
 * it can decide whether to send a receipt.
 */
export async function recordPayment(args: {
  scanId: number;
  product: OrderProduct;
  amountCents: number;
  provider: string;
  providerRef: string;
}): Promise<{ alreadyPaid: boolean }> {
  const db = sql();
  const rows = (await db`
    INSERT INTO scan_orders (scan_id, product, amount_cents, status, provider, provider_ref, paid_at)
    VALUES (${args.scanId}, ${args.product}, ${args.amountCents}, 'paid', ${args.provider}, ${args.providerRef}, now())
    ON CONFLICT (scan_id, product) WHERE status = 'paid' DO NOTHING
    RETURNING id`) as { id: number }[];

  return { alreadyPaid: rows.length === 0 };
}
