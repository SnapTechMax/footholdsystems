import { cookies } from "next/headers";
import type { VariantKey } from "./types";

/**
 * Sticky 50/50 assignment.
 *
 * A visitor keeps the same arm across visits, otherwise the same person can
 * convert against a variant they never saw. The id is a random opaque value —
 * it identifies a browser for the length of the test and carries nothing about
 * the person.
 */

export const VISITOR_COOKIE = "fh_vid";
export const VARIANT_COOKIE_PREFIX = "fh_exp_";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export function variantCookieName(experimentId: number): string {
  return `${VARIANT_COOKIE_PREFIX}${experimentId}`;
}

function randomId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 20);
}

/**
 * This visitor's id, minted if they don't have one yet.
 *
 * Needed even with no experiment running, so views and conversions still count
 * towards the baseline rate rather than vanishing between tests.
 */
export async function ensureVisitorId(): Promise<string> {
  const jar = await cookies();
  return jar.get(VISITOR_COOKIE)?.value || randomId();
}

/**
 * Resolve this visitor's arm for an experiment, reading existing cookies where
 * present. Returns the values to set, since a Server Component cannot write
 * cookies itself — the route handler or middleware does that.
 */
export async function resolveAssignment(experimentId: number): Promise<{
  visitorId: string;
  variant: VariantKey;
  isNew: boolean;
}> {
  const jar = await cookies();
  const existingVisitor = jar.get(VISITOR_COOKIE)?.value;
  const existingVariant = jar.get(variantCookieName(experimentId))?.value;

  const visitorId = existingVisitor || randomId();
  if (existingVariant === "a" || existingVariant === "b") {
    return { visitorId, variant: existingVariant, isNew: false };
  }

  // Bucket off the visitor id so the split is stable for a given browser.
  const variant: VariantKey = hashToBucket(visitorId) < 0.5 ? "a" : "b";
  return { visitorId, variant, isNew: true };
}

/** FNV-1a to a 0-1 float. Cheap and evenly distributed for this purpose. */
export function hashToBucket(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % 10_000) / 10_000;
}

export const COOKIE_OPTIONS = {
  maxAge: COOKIE_MAX_AGE,
  path: "/",
  sameSite: "lax" as const,
  httpOnly: false,
};
