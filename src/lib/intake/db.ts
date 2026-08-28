import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "@/lib/pg";
import type { IntakeAnswers } from "./questions";

/**
 * Storage for the build intake.
 *
 * One table. A submission is a snapshot of what a customer told us on one day,
 * not a record that gets edited afterwards, so a second submission from the
 * same person is a second row rather than an update — the earlier answers are
 * evidence of what we were told, and overwriting them destroys that.
 *
 * The answers live in a JSONB column rather than in thirty-odd columns of their
 * own. The questionnaire is expected to change: adding a question should not be
 * a migration, and a question removed later should not take answered data with
 * it. Everything the admin list needs to show at a glance is denormalized into
 * real columns beside it.
 */

export interface IntakeRow {
  id: number;
  token: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string | null;
  answers: IntakeAnswers;
  declarationText: string;
  scanToken: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  notifiedAt: string | null;
  createdAt: string;
}

/**
 * Unguessable, for the same reason a scan token is: it is the handle on one
 * customer's answers, and those answers include their supplier relationships,
 * their pricing, and who holds their accounts.
 */
function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Create the table if it isn't there. Safe to call on every request. */
export async function initIntakeSchema(): Promise<void> {
  const db = sql();

  await db`
    CREATE TABLE IF NOT EXISTS build_intakes (
      id               BIGSERIAL PRIMARY KEY,
      token            TEXT NOT NULL UNIQUE,
      business_name    TEXT NOT NULL,
      contact_name     TEXT NOT NULL,
      email            TEXT NOT NULL,
      phone            TEXT,
      answers          JSONB NOT NULL,
      declaration_text TEXT NOT NULL,
      scan_token       TEXT,
      ip_address       TEXT,
      user_agent       TEXT,
      notified_at      TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  // The admin list is always newest first, and the per-IP throttle reads the
  // same column with an address alongside it.
  await db`
    CREATE INDEX IF NOT EXISTS build_intakes_created_idx
      ON build_intakes (created_at DESC)`;
  await db`
    CREATE INDEX IF NOT EXISTS build_intakes_ip_created_idx
      ON build_intakes (ip_address, created_at)`;

  /**
   * Deliberately NOT a foreign key to `scans`.
   *
   * Someone can reach this form without ever having run a scan — the customer
   * this was built for replied to an email, not to a report — and a constraint
   * would turn a nice-to-have cross-reference into a reason a real submission
   * gets rejected. It is stored as text and resolved on read, and a token that
   * matches nothing just means there is no scan to link to.
   */
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toRow(record: any): IntakeRow {
  return {
    id: Number(record.id),
    token: record.token,
    businessName: record.business_name,
    contactName: record.contact_name,
    email: record.email,
    phone: record.phone ?? null,
    answers: (record.answers ?? {}) as IntakeAnswers,
    declarationText: record.declaration_text,
    scanToken: record.scan_token ?? null,
    ipAddress: record.ip_address ?? null,
    userAgent: record.user_agent ?? null,
    notifiedAt: record.notified_at ? new Date(record.notified_at).toISOString() : null,
    createdAt: new Date(record.created_at).toISOString(),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function createIntake(args: {
  answers: IntakeAnswers;
  declarationText: string;
  scanToken: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<IntakeRow> {
  const db = sql();
  const token = newToken();

  // The three denormalized columns come out of the answers rather than being
  // passed separately, so the list view and the digest cannot disagree about
  // who a submission is from.
  const businessName = args.answers.business_name?.trim() || "Unnamed business";
  const contactName = args.answers.contact_name?.trim() || "";
  const email = args.answers.email?.trim().toLowerCase() || "";
  const phone = args.answers.phone?.trim() || null;

  const rows = await db`
    INSERT INTO build_intakes
      (token, business_name, contact_name, email, phone, answers,
       declaration_text, scan_token, ip_address, user_agent)
    VALUES
      (${token}, ${businessName}, ${contactName}, ${email}, ${phone},
       ${JSON.stringify(args.answers)}::jsonb, ${args.declarationText},
       ${args.scanToken}, ${args.ipAddress}, ${args.userAgent})
    RETURNING *`;

  return toRow(rows[0]);
}

/** Stamped only once the notification email is confirmed sent. */
export async function markIntakeNotified(id: number): Promise<void> {
  const db = sql();
  await db`
    UPDATE build_intakes SET notified_at = now()
     WHERE id = ${id} AND notified_at IS NULL`;
}

export async function getIntakeByToken(token: string): Promise<IntakeRow | null> {
  const db = sql();
  const rows = await db`SELECT * FROM build_intakes WHERE token = ${token} LIMIT 1`;
  return rows.length > 0 ? toRow(rows[0]) : null;
}

/** Newest first. The admin screen reads everything; there will never be many. */
export async function listIntakes(limit = 50): Promise<IntakeRow[]> {
  const db = sql();
  const rows = await db`
    SELECT * FROM build_intakes
     ORDER BY created_at DESC
     LIMIT ${limit}`;
  return rows.map(toRow);
}

/**
 * Submissions from one address in the last hour.
 *
 * The route emails two people off the back of a public form, one of them at an
 * address supplied in the form itself. That is worth a ceiling even though
 * nothing has ever abused it, because the cost of being wrong lands on the
 * sending reputation the rest of this codebase protects.
 */
export async function recentIntakeCountForIp(ip: string): Promise<number> {
  const db = sql();
  const rows = await db`
    SELECT count(*)::int AS count
      FROM build_intakes
     WHERE ip_address = ${ip}
       AND created_at > now() - interval '1 hour'`;
  return Number(rows[0]?.count ?? 0);
}
