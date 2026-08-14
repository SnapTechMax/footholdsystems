/**
 * Where a lead actually came from.
 *
 * The sequence has per-email attribution — every booking link goes through
 * /api/go/book, which writes a click row, and Calendly hands the campaign back
 * through the webhook so a call can be traced to the email that caused it. The
 * inbound half had none of that. Every lead was stored with the same constant
 * string, `"Foothold Systems - 5 Levels of AI"`, so the question "which ad
 * produced this person" had no answer in our own data.
 *
 * GA4 and Meta both attribute in aggregate, which tells you a campaign produced
 * eleven leads but never which eleven. That gap stops mattering the moment more
 * than one ad is running.
 *
 * Read on the client, because the landing query string only exists in the
 * browser — the form posts to an API route, and by then the referrer is our own
 * page. Cheap to collect and it travels with the consent record, which is
 * already the row that knows who someone is.
 */

/** Parameters worth keeping. Anything else in the query string is discarded. */
const TRACKED_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  // Click ids. These are what let a lead be matched back to a specific ad click
  // in each platform's own reporting, and to upload offline conversions later.
  "fbclid", // Meta
  "gclid", // Google
  "msclkid", // Microsoft
] as const;

/**
 * Values are attacker-controllable — anyone can append anything to the URL —
 * and end up in a database row and an email we send ourselves. Capped rather
 * than trusted.
 */
const MAX_VALUE_LENGTH = 200;

const STORAGE_KEY = "fh_attribution";

export type Attribution = Record<string, string>;

/**
 * Attribution for this visit, or null if there is nothing worth recording.
 *
 * Persisted to sessionStorage on first sight. Someone can land on `/guide` from
 * an ad, click through to the privacy policy, come back, and submit — by which
 * point the query string is long gone from the URL. Without this the lead most
 * likely to be careful about their data is the one that loses its attribution.
 */
export function captureAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;

  const stored = readStored();
  const fromUrl = readFromUrl();

  // The URL wins when it has anything: a second ad click in the same session is
  // newer information than what was stored on the first.
  if (Object.keys(fromUrl).length > 0) {
    const record: Attribution = {
      ...fromUrl,
      landing_path: window.location.pathname.slice(0, MAX_VALUE_LENGTH),
    };
    const referrer = externalReferrer();
    if (referrer) record.referrer = referrer;
    writeStored(record);
    return record;
  }

  if (stored) return stored;

  // No campaign parameters at all — organic, direct, or a link someone shared.
  // The referrer is still worth having, since it is the only signal left.
  //
  // A record is returned either way. This used to return null for a direct visit
  // with no referrer, which meant the one column that is always knowable — the
  // page the form was actually on — was missing from precisely the leads there
  // was least other information about. `landing_path` costs nothing and the
  // spreadsheet has a column for it.
  const record: Attribution = {
    landing_path: window.location.pathname.slice(0, MAX_VALUE_LENGTH),
  };
  const referrer = externalReferrer();
  if (referrer) record.referrer = referrer;
  writeStored(record);
  return record;
}

function readFromUrl(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const out: Attribution = {};
  for (const key of TRACKED_PARAMS) {
    const value = params.get(key)?.trim();
    if (value) out[key] = value.slice(0, MAX_VALUE_LENGTH);
  }
  return out;
}

/** Our own pages are not a referrer worth storing. */
function externalReferrer(): string | null {
  const referrer = document.referrer;
  if (!referrer) return null;
  try {
    if (new URL(referrer).host === window.location.host) return null;
  } catch {
    return null;
  }
  return referrer.slice(0, MAX_VALUE_LENGTH);
}

function readStored(): Attribution | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Attribution) : null;
  } catch {
    // Private browsing, storage disabled, or corrupted JSON. Attribution is a
    // nice-to-have; it may never be the reason a form stops working.
    return null;
  }
}

function writeStored(record: Attribution): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* see readStored */
  }
}

/** One-line summary for the lead notification email. */
export function describeAttribution(record: Attribution | null | undefined): string {
  if (!record) return "direct / unknown";
  const parts: string[] = [];
  if (record.utm_source) parts.push(record.utm_source);
  if (record.utm_medium) parts.push(record.utm_medium);
  if (record.utm_campaign) parts.push(record.utm_campaign);
  if (record.utm_content) parts.push(`(${record.utm_content})`);
  if (parts.length === 0 && record.referrer) return `referrer: ${record.referrer}`;
  if (parts.length === 0) return "direct / unknown";
  return parts.join(" / ");
}
