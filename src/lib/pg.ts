import "server-only";
import { neon } from "@neondatabase/serverless";

/**
 * Postgres connection resolution, in one place.
 *
 * The connection string arrives under a different name depending on how the
 * database was attached — Neon's Vercel integration, the older Vercel Postgres
 * integration, or a hand-added variable — and the integrations let you
 * namespace what they create. Getting this wrong is invisible until something
 * 503s in production, which is why the list is exhaustive rather than the two
 * names that happened to work on the day.
 *
 * Pooled URLs come first: every caller is a short-lived serverless invocation,
 * so the pooler is what should absorb them. POSTGRES_URL_NO_SSL is deliberately
 * absent — Neon requires TLS.
 *
 * `src/lib/tracking.ts` predates this and carries its own
 * copies. They work, so they are left alone; new code should use this.
 */

const BASE_NAMES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

const NAME_PREFIXES = ["", "STORAGE_", "NEON_"] as const;

export const CONNECTION_ENV_VARS: string[] = BASE_NAMES.flatMap((base) =>
  NAME_PREFIXES.map((prefix) => `${prefix}${base}`)
);

export function connectionString(): string | undefined {
  for (const name of CONNECTION_ENV_VARS) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export const DATABASE_CONFIGURED = Boolean(connectionString());

/**
 * Neon's HTTP driver, not a pooled TCP client: every caller here is a
 * short-lived serverless invocation, where a connection pool is a liability.
 */
export function sql() {
  const url = connectionString();
  if (!url) {
    throw new Error(
      `No Postgres connection string found. Looked for: ${CONNECTION_ENV_VARS.join(", ")}. ` +
        "Vercel only exposes environment variables to deployments built after they were added, so a redeploy is often the fix."
    );
  }
  return neon(url);
}
