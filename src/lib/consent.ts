import "server-only";
import { neon } from "@neondatabase/serverless";

/**
 * Marketing consent records.
 *
 * The guide itself is transactional: someone asked for it, so sending it needs
 * no separate permission. The nurture sequence is marketing, and that does. This
 * records the second one.
 *
 * The point is to be able to answer "prove they agreed" months later, which is
 * the question an ESP asks when it reviews an account, and the one there is no
 * good answer to without a record. So it stores the exact wording shown, not a
 * boolean: consent text changes over time, and "they ticked a box" is worth
 * little if nobody can say what the box said at the time.
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

export const CONSENT_STORAGE_CONFIGURED = Boolean(connectionString());

export interface ConsentRecord {
  email: string;
  granted: boolean;
  /** Wording shown at the moment they agreed. */
  text: string;
  /** Page the form was on. */
  source: string;
  ipAddress: string | null;
  userAgent: string | null;
  /**
   * Campaign parameters from the landing URL — which ad, campaign or referrer
   * produced this person. Stored here rather than in a table of its own because
   * this is already the row that knows who they are, and the two are written in
   * the same request.
   */
  attribution?: Record<string, string> | null;
}

export async function initConsentSchema(): Promise<void> {
  const url = connectionString();
  if (!url) return;
  const sql = neon(url);
  await sql`
    CREATE TABLE IF NOT EXISTS marketing_consent (
      id          BIGSERIAL PRIMARY KEY,
      email       TEXT NOT NULL,
      granted     BOOLEAN NOT NULL,
      consent_text TEXT NOT NULL,
      source      TEXT NOT NULL,
      ip_address  TEXT,
      user_agent  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
  // Append-only by design: a withdrawal is a new row, so the history of what
  // someone agreed to and when stays intact rather than being overwritten.
  await sql`
    CREATE INDEX IF NOT EXISTS marketing_consent_email
      ON marketing_consent (email, created_at DESC)`;

  // Added after the table existed, so it arrives as an ALTER rather than in the
  // CREATE above — an existing install would never see a changed CREATE TABLE
  // IF NOT EXISTS. Idempotent, so it stays safe to run on every write.
  //
  // JSONB rather than columns per parameter: the set of things worth keeping
  // changes with whatever platform is being advertised on, and a schema
  // migration per new click id would be a poor trade for a field nothing joins.
  await sql`
    ALTER TABLE marketing_consent
      ADD COLUMN IF NOT EXISTS attribution JSONB`;
}

export async function recordConsent(record: ConsentRecord): Promise<void> {
  const url = connectionString();
  if (!url) return;
  const sql = neon(url);
  await initConsentSchema();
  await sql`
    INSERT INTO marketing_consent
      (email, granted, consent_text, source, ip_address, user_agent, attribution)
    VALUES (
      ${record.email}, ${record.granted}, ${record.text}, ${record.source},
      ${record.ipAddress}, ${record.userAgent},
      ${record.attribution ? JSON.stringify(record.attribution) : null}::jsonb
    )`;
}
