import "server-only";

/**
 * Push notification for a new lead.
 *
 * The point is speed to first contact: a lead that gets a call back inside a few
 * minutes is a different lead from one that gets an email the next morning. The
 * notification carries a `tel:` action so the call is one tap from the lock
 * screen, which is the only reason this exists rather than another email.
 *
 * Everything here is best-effort and deliberately incapable of failing the
 * request. A lead is already in the sheet by the time this runs; a phone that
 * didn't buzz is an inconvenience, a 500 back to someone who filled the form in
 * is a lost lead. Every path returns, none throws.
 */

const ENDPOINT = "https://api.pushover.net/1/messages.json";

/**
 * How long to wait before giving up.
 *
 * Short on purpose. This is started before the Resend work and settled after it,
 * so in practice it has the whole email send to complete in — the timeout is the
 * ceiling on how long a hung Pushover can hold the response open, not the budget
 * it normally needs.
 */
const TIMEOUT_MS = 2000;

export const PUSHOVER_CONFIGURED = Boolean(
  process.env.PUSHOVER_USER_KEY && process.env.PUSHOVER_API_TOKEN
);

export interface LeadNotification {
  name: string;
  /** E.164, used both in the body and as the `tel:` action. */
  phone: string;
  email: string;
  /** One-line campaign description, e.g. "meta / cpc / five-levels". */
  campaign: string;
}

/**
 * Send the notification. Never throws, never rejects.
 *
 * Returns whether it went out, so the caller can log the miss. Nothing upstream
 * branches on the result.
 */
export async function notifyNewLead(lead: LeadNotification): Promise<boolean> {
  const user = process.env.PUSHOVER_USER_KEY;
  const token = process.env.PUSHOVER_API_TOKEN;

  if (!user || !token) {
    console.warn(
      "Pushover not configured (PUSHOVER_USER_KEY / PUSHOVER_API_TOKEN unset) — no push sent for this lead."
    );
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const body = new URLSearchParams({
      token,
      user,
      title: `New lead — ${lead.name}`,
      message: [
        lead.phone,
        lead.email,
        `Campaign: ${lead.campaign}`,
      ].join("\n"),
      // Tapping the notification dials. This is the feature.
      url: `tel:${lead.phone}`,
      url_title: "Call now",
    });

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      // Pushover puts the actual complaint in the body; the status alone is
      // usually just 400 and says nothing about which field it disliked.
      const detail = await response.text().catch(() => "");
      console.error(
        `Pushover returned ${response.status} (lead already recorded): ${detail.slice(0, 500)}`
      );
      return false;
    }

    return true;
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error(
      aborted
        ? `Pushover timed out after ${TIMEOUT_MS}ms (lead already recorded).`
        : `Pushover failed (lead already recorded): ${
            error instanceof Error ? error.message : String(error)
          }`
    );
    return false;
  } finally {
    clearTimeout(timer);
  }
}
