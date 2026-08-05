/**
 * Shows what the Resend webhook has recorded, and runs the attribution join.
 *
 *   STORAGE_DATABASE_URL=postgres://... node scripts/check-events.mjs
 *
 * Uses @neondatabase/serverless, which the project already depends on, rather
 * than psql — there is no psql on this machine, and the connection string is
 * marked Sensitive in Vercel so `vercel env pull` returns it empty. Copy it from
 * the Neon console instead.
 *
 * Read-only. It creates nothing and deletes nothing.
 */

import { neon } from "@neondatabase/serverless";

// The same list, in the same order, as lib/tracking.ts. If the app can find a
// connection this script can, and vice versa.
const CONNECTION_ENV_VARS = [
  "DATABASE_URL",
  "STORAGE_DATABASE_URL",
  "NEON_DATABASE_URL",
  "POSTGRES_URL",
  "STORAGE_POSTGRES_URL",
];

const url = CONNECTION_ENV_VARS.map((n) => process.env[n]).find(Boolean);
if (!url) {
  console.error(
    `\nNo connection string. Set one of:\n  ${CONNECTION_ENV_VARS.join("\n  ")}\n\n` +
      "Get it from the Neon console — Vercel returns these empty because they\n" +
      "are marked Sensitive.\n"
  );
  process.exit(1);
}

const sql = neon(url);

async function tableExists(name) {
  const rows = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${name}`;
  return rows.length > 0;
}

const exists = await tableExists("email_events");

if (!exists) {
  console.log(
    "\n  email_events does not exist yet.\n\n" +
      "  It is created on the first write, so this means the webhook has not\n" +
      "  successfully recorded anything. Check the endpoint answers 401 rather\n" +
      "  than 503:\n\n" +
      "    curl -s -o /dev/null -w '%{http_code}\\n' -X POST \\\n" +
      "      https://www.footholdsystems.com/api/resend/webhook -d '{}'\n"
  );
  process.exit(0);
}

const recent = await sql`
  SELECT event_type, email_key, recipient, link, occurred_at
  FROM email_events ORDER BY id DESC LIMIT 10`;

console.log(`\n  Last ${recent.length} event(s):\n`);
if (recent.length === 0) {
  console.log("    (table exists but is empty)\n");
} else {
  for (const r of recent) {
    const when = new Date(r.occurred_at).toISOString().replace("T", " ").slice(0, 19);
    console.log(`    ${when}  ${(r.event_type ?? "").padEnd(20)} ${r.email_key ?? "(unattributed)"}`);
    console.log(`      to    ${r.recipient ?? "(none)"}`);
    if (r.link) console.log(`      link  ${r.link}`);
  }
  console.log("");
}

// Anything that arrived but could not be tied to a step. A steady trickle here
// means the resolution order needs another identifier, not that people are not
// clicking, so it is worth seeing separately rather than as a missing row.
const orphans = await sql`
  SELECT event_type, COUNT(*)::int AS n
  FROM email_events WHERE email_key IS NULL
  GROUP BY event_type ORDER BY n DESC`;
if (orphans.length > 0) {
  console.log("  Events that resolved to no sequence step:\n");
  for (const o of orphans) console.log(`    ${o.event_type.padEnd(22)} ${o.n}`);
  console.log("");
}

const byType = await sql`
  SELECT event_type, COUNT(*)::int AS n FROM email_events
  GROUP BY event_type ORDER BY n DESC`;
if (byType.length > 0) {
  console.log("  Totals:\n");
  for (const t of byType) console.log(`    ${t.event_type.padEnd(22)} ${t.n}`);
  console.log("");
}

if (!(await tableExists("sequence_bookings"))) {
  console.log("  sequence_bookings does not exist yet, so there is nothing to join to.\n");
  process.exit(0);
}

const joined = await sql`
  WITH clicks AS (
    SELECT recipient AS email, email_key, occurred_at
    FROM email_events
    WHERE event_type = 'clicked' AND email_key IS NOT NULL AND recipient IS NOT NULL
  ),
  bookings AS (
    SELECT email, MIN(created_at) AS booked_at
    FROM sequence_bookings WHERE status = 'booked' GROUP BY email
  ),
  last_touch AS (
    SELECT DISTINCT ON (b.email) b.email, b.booked_at, c.email_key, c.occurred_at
    FROM bookings b
    JOIN clicks c ON c.email = b.email AND c.occurred_at <= b.booked_at
    ORDER BY b.email, c.occurred_at DESC
  ),
  assisted AS (
    SELECT DISTINCT b.email, c.email_key
    FROM bookings b
    JOIN clicks c ON c.email = b.email AND c.occurred_at <= b.booked_at
  )
  SELECT s.email_key                        AS step,
         COUNT(DISTINCT s.email)::int       AS clickers,
         COALESCE(lt.n, 0)::int             AS booked_last_touch,
         COALESCE(a.n, 0)::int              AS booked_assisted,
         ROUND(lt.median_hours::numeric, 1) AS median_hours_to_book
  FROM clicks s
  LEFT JOIN (
    SELECT email_key, COUNT(*)::int AS n,
           PERCENTILE_CONT(0.5) WITHIN GROUP (
             ORDER BY EXTRACT(EPOCH FROM (booked_at - occurred_at)) / 3600
           ) AS median_hours
    FROM last_touch GROUP BY email_key
  ) lt ON lt.email_key = s.email_key
  LEFT JOIN (
    SELECT email_key, COUNT(*)::int AS n FROM assisted GROUP BY email_key
  ) a ON a.email_key = s.email_key
  GROUP BY s.email_key, lt.n, a.n, lt.median_hours
  ORDER BY booked_last_touch DESC, clickers DESC`;

console.log("  Step to booking:\n");
if (joined.length === 0) {
  console.log("    (no attributed clicks yet)\n");
} else {
  console.log("    step            clickers  last-touch  assisted  median hrs");
  for (const r of joined) {
    console.log(
      `    ${r.step.padEnd(15)} ${String(r.clickers).padStart(8)}` +
        ` ${String(r.booked_last_touch).padStart(11)}` +
        ` ${String(r.booked_assisted).padStart(9)}` +
        ` ${String(r.median_hours_to_book ?? "-").padStart(11)}`
    );
  }
  console.log("");
}
