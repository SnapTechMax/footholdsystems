import "server-only";
import { Resend } from "resend";
import {
  claimScan,
  completeScan,
  failScan,
  getScanById,
  markReportEmailed,
  type ScanRow,
} from "./db";
import { buildReportEmail } from "./email";
import { OraError, isRetryable, runScan, scanDomain } from "./ora";
import { buildReport } from "./report";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * Runs one queued scan end to end: call Ora, build the report, store it, email it.
 *
 * Called from two places — `after()` on the request that created the scan, and
 * the cron sweeper that picks up anything the first attempt dropped. Both can
 * be in flight at once, which is why the first thing it does is claim the row.
 *
 * Never throws. Every caller is a background context where an exception is a
 * log line nobody reads and a customer who waits forever, so failures are
 * recorded on the row instead and the sweeper decides whether to try again.
 */

/**
 * Envelope sender. Deliberately its own constant rather than CONTACT_EMAIL,
 * even though the two currently hold the same address: this one has to be on a
 * domain Resend has verified, and CONTACT_EMAIL is wherever we want replies to
 * land. Collapsing them means a future change to the contact address silently
 * breaks sending. The report email sets replyTo: CONTACT_EMAIL separately.
 */
const FROM_EMAIL =
  process.env.CONTACT_FROM_EMAIL || "maximilian@footholdsystems.com";
const BRAND = "FootHold AEO";

export type RunOutcome =
  | { status: "done" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string; retryable: boolean };

export async function runScanJob(scanId: number): Promise<RunOutcome> {
  // Claim first. If another worker already has it, stop — doing the work twice
  // means two Ora calls against a 30-a-day ceiling and two identical emails.
  const claimed = await claimScan(scanId);
  if (!claimed) {
    return { status: "skipped", reason: "already claimed or complete" };
  }

  const scan = await getScanById(scanId);
  if (!scan) return { status: "skipped", reason: "scan row disappeared" };

  let report;
  let raw;
  try {
    raw = await scanDomain(scan.domain);
    report = buildReport(raw, scan.category);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await failScan(scanId, reason);
    // A 4xx from Ora will fail identically forever; a 429 or a 5xx will not.
    return { status: "failed", reason, retryable: isRetryable(error) };
  }

  try {
    await completeScan({
      id: scanId,
      score: report.score,
      grade: report.grade,
      report,
      raw,
    });
  } catch (error) {
    // The scan itself succeeded, so this is worth retrying — but do not mark it
    // failed, or the sweeper will spend another Ora call re-running a scan we
    // already have.
    const reason = error instanceof Error ? error.message : String(error);
    return { status: "failed", reason: `storing report: ${reason}`, retryable: true };
  }

  // Email is deliberately after the write and outside its try. A report that is
  // stored but unsent is recoverable by the sweeper; a report that was emailed
  // but never stored leaves a customer holding a link to nothing.
  const sent = await sendReportEmail({ ...scan, report });
  if (!sent.ok) {
    return { status: "failed", reason: sent.reason, retryable: true };
  }

  return { status: "done" };
}

/**
 * Sends the report and marks the row.
 *
 * `markReportEmailed` runs only on a confirmed send. Marking it optimistically
 * would mean a Resend outage silently costs a customer their report, and the
 * sweeper would never notice.
 */
export async function sendReportEmail(
  scan: ScanRow & { report: NonNullable<ScanRow["report"]> }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, reason: "RESEND_API_KEY is not set" };

  const { subject, html, text } = buildReportEmail({
    report: scan.report,
    token: scan.token,
    email: scan.email,
  });

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${BRAND} <${FROM_EMAIL}>`,
      to: [scan.email],
      replyTo: CONTACT_EMAIL,
      subject,
      html,
      text,
    });
    if (error) {
      return { ok: false, reason: `Resend: ${error.message ?? String(error)}` };
    }
  } catch (error) {
    return {
      ok: false,
      reason: `Resend threw: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  await markReportEmailed(scan.id);
  return { ok: true };
}

/**
 * Re-runs Ora for a scan that has already completed, updating the row in place.
 *
 * The point is that the token does not change. A customer has the report link
 * already, quite possibly bookmarked or forwarded, and minting a new row would
 * leave them looking at the old data on the old URL while the fresh version sat
 * somewhere they had never seen.
 *
 * Does not email by default. A refresh is usually us correcting something on
 * our side rather than news for them, and a second identical report landing in
 * their inbox is a worse outcome than a quietly updated page. `sendEmail` is
 * there for the case where the numbers really have moved.
 *
 * Calls Ora directly rather than through `scanDomain`, which is cache-first: a
 * refresh that returns the data we already hold is not a refresh.
 */
export async function refreshScanJob(
  scanId: number,
  options: { force?: boolean; sendEmail?: boolean } = {}
): Promise<
  | { status: "done"; before: number | null; after: number; emailed: boolean }
  | { status: "failed"; reason: string }
> {
  const scan = await getScanById(scanId);
  if (!scan) return { status: "failed", reason: "no such scan" };

  let raw;
  let report;
  try {
    raw = await runScan(scan.domain, { force: options.force });
    report = buildReport(raw, scan.category);
  } catch (error) {
    // Deliberately does not call failScan. The existing report is still good
    // and still being served; a refresh that could not reach Ora is no reason
    // to mark a completed scan failed and have the sweeper redo it.
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  const before = scan.score;
  await completeScan({
    id: scanId,
    score: report.score,
    grade: report.grade,
    report,
    raw,
  });

  let emailed = false;
  if (options.sendEmail) {
    const sent = await sendReportEmail({ ...scan, report });
    emailed = sent.ok;
  }

  return { status: "done", before, after: report.score, emailed };
}

/** Whether an error should be shown to a visitor or swallowed into a generic message. */
export function customerFacingError(error: unknown): string {
  if (error instanceof OraError && error.status === 429) {
    return "We're running more scans than usual right now. Yours is queued and we'll email it shortly.";
  }
  return "Your scan is queued. We'll email the results shortly.";
}
