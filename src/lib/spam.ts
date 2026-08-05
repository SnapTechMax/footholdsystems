/**
 * Cheap screening for automated form submissions.
 *
 * The capture form is a public endpoint that emails a PDF to any address it is
 * given. Nothing has abused it yet — every address in the send log so far is a
 * real, deliverable mailbox — but the exposure is not really the wasted sends.
 * It is that junk signups become bounces, and a bounce rate is the one thing
 * that genuinely damages the sending reputation the rest of this codebase goes
 * to some trouble to protect.
 *
 * Three checks, chosen because none of them asks a visitor to do anything: no
 * captcha, no puzzle, no third-party script, and nothing at all for a real
 * person to notice. That matters on a page carrying paid traffic, where every
 * added step is paid for twice.
 *
 * None of them is individually strong. A determined attacker reads this file
 * and walks past all three. They are here to stop the indiscriminate bots that
 * fill every field on every form they find, which is what actually turns up.
 *
 * Deliberately client-safe — no server-only import — so the form and the route
 * share one definition of the field name and the threshold rather than keeping
 * two copies that can drift.
 */

/**
 * Name of the decoy input.
 *
 * Chosen to look like a field worth completing. A bot filling everything will
 * fill this; a human never sees it. Renaming it is free and occasionally worth
 * doing, but the name must match on both sides.
 */
export const HONEYPOT_FIELD = "company";

/**
 * Minimum time on the form before a submission is believable, in milliseconds.
 *
 * Set low on purpose. A script posts in single-digit milliseconds, so anything
 * above a second already separates the two populations completely — while a
 * real person using password-manager autofill can be quicker than you would
 * think. The cost of being wrong is asymmetric: turning away a real lead is far
 * worse than accepting a bot, so this errs heavily toward letting people in.
 */
export const MIN_FILL_MS = 1200;

/** Submissions allowed from one IP per hour before it is treated as a script. */
export const MAX_SUBMISSIONS_PER_IP_PER_HOUR = 10;

export interface SubmissionSignals {
  /** Contents of the decoy field. Anything non-empty is automated. */
  honeypot?: unknown;
  /** Milliseconds between the form mounting and the submission. */
  elapsedMs?: unknown;
}

export type ScreenResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Screen the signals that need no database.
 *
 * Returns a reason rather than a boolean so the caller can log *why* something
 * was turned away. A silent rejection here would be the same class of mistake as
 * the silently dropped conversions — if this ever starts refusing real people,
 * the logs are the only place that will show it.
 */
export function screenSubmission(signals: SubmissionSignals): ScreenResult {
  // 1. The decoy. Empty or absent is what a real browser sends.
  if (typeof signals.honeypot === "string" && signals.honeypot.trim() !== "") {
    return { ok: false, reason: "honeypot field was filled" };
  }

  // 2. Time on form. Absent is treated as fine rather than suspicious: an older
  // cached page, or a client that failed to send it, is not evidence of a bot,
  // and refusing on a missing field would turn a deploy into an outage.
  if (typeof signals.elapsedMs === "number" && Number.isFinite(signals.elapsedMs)) {
    if (signals.elapsedMs >= 0 && signals.elapsedMs < MIN_FILL_MS) {
      return {
        ok: false,
        reason: `submitted after ${Math.round(signals.elapsedMs)}ms, under the ${MIN_FILL_MS}ms floor`,
      };
    }
  }

  return { ok: true };
}
