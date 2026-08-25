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

  await db`CREATE INDEX IF NOT EXISTS scans_status_idx ON scans (status, created_at)`;
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
    INSERT INTO scan_leads (email, consent_text, ip_address, user_agent, attribution)
    VALUES (
      ${email}, ${input.consentText}, ${input.ipAddress}, ${input.userAgent},
      ${input.attribution ? JSON.stringify(input.attribution) : null}::jsonb
    )
    ON CONFLICT (lower(email)) DO UPDATE SET
      consent_text    = EXCLUDED.consent_text,
      consent_at      = now(),
      ip_address      = COALESCE(EXCLUDED.ip_address, scan_leads.ip_address),
      user_agent      = COALESCE(EXCLUDED.user_agent, scan_leads.user_agent),
      attribution     = COALESCE(EXCLUDED.attribution, scan_leads.attribution),
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

/** Total scans started today, against Ora's rolling 24-hour budget. */
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

export async function failScan(id: number, error: string): Promise<void> {
  const db = sql();
  // Truncated: this is third-party error text of unbounded length and it is
  // only ever read by us.
  await db`
    UPDATE scans SET status = 'failed', error = ${error.slice(0, 2000)}
    WHERE id = ${id}`;
}

export async function markReportEmailed(id: number): Promise<void> {
  const db = sql();
  await db`UPDATE scans SET report_emailed_at = now() WHERE id = ${id}`;
}

const SCAN_SELECT = `
  s.id, s.token, s.lead_id, s.domain, s.url, s.category, s.status, s.score, s.grade,
  s.report, s.raw, s.error, s.attempts, s.created_at, s.completed_at,
  s.report_emailed_at, l.email`;

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
    reportEmailedAt: r.report_emailed_at,
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
