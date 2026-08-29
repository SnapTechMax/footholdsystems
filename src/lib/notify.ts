import "server-only";

/**
 * Push notifications, for the two things worth interrupting someone about.
 *
 * WHY NOT WHOP'S OWN NOTIFICATION. Whop can tell a phone that $1,497 arrived,
 * and that is worth having switched on as a backstop. What it cannot say is
 * whose money it was. The domain and the cold-email batch exist only in the
 * metadata this system attached to the checkout, so a notification that names
 * them has to come from here.
 *
 * BEST EFFORT, ALWAYS. Every path returns rather than throws. These fire inside
 * a payment webhook, and a notification failing must never be the reason a
 * payment is not recorded.
 *
 * Unconfigured is a normal state, not an error: PUSHOVER_API_TOKEN and
 * PUSHOVER_USER_KEY sat in Vercel for weeks with no code reading them, and a
 * deployment without them should send nothing and say so once, quietly.
 */

const API_URL = "https://api.pushover.net/1/messages.json";
const TIMEOUT_MS = 8_000;

export const PUSH_CONFIGURED = Boolean(
  process.env.PUSHOVER_API_TOKEN && process.env.PUSHOVER_USER_KEY
);

export interface PushMessage {
  title: string;
  message: string;
  /** Opened by tapping the notification. */
  url?: string;
  urlTitle?: string;
  /**
   * 0 is normal. 1 is high, which bypasses the phone's quiet hours.
   *
   * A sale is 0: it is good news and it keeps until morning. A payment that
   * matched nothing is 1, because the customer is waiting and the fix gets
   * harder the longer it sits.
   */
  priority?: 0 | 1;
}

export async function sendPush(push: PushMessage): Promise<void> {
  const token = process.env.PUSHOVER_API_TOKEN;
  const user = process.env.PUSHOVER_USER_KEY;
  if (!token || !user) {
    console.info("[notify] no Pushover credentials set, so nothing was pushed.");
    return;
  }

  const body = new URLSearchParams({
    token,
    user,
    title: push.title,
    message: push.message,
    priority: String(push.priority ?? 0),
  });
  if (push.url) body.set("url", push.url);
  if (push.urlTitle) body.set("url_title", push.urlTitle);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!response.ok) {
      // Pushover puts the reason in the body, and it is usually a bad token.
      const detail = await response.text().catch(() => "");
      console.error(
        `[notify] push rejected ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`
      );
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error(
      `[notify] push failed: ${aborted ? `no response in ${TIMEOUT_MS / 1000}s` : error}`
    );
  } finally {
    clearTimeout(timer);
  }
}
