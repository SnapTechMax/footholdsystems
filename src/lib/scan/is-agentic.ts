import "server-only";
import { OraError, parseOraScan } from "./ora";
import type { OraScan } from "./types";

/**
 * Client for the Is Agentic scan stream (https://is-agentic.com), the Vercel
 * front end to Ora's scanner.
 *
 * WHY THIS EXISTS: Ora's own `POST /api/scan` is capped at 30 scans per rolling
 * 24 hours per IP, and on Vercel the outbound IP is shared across the whole
 * deployment — so that is thirty scans a day for every visitor combined, not
 * each. We hit that ceiling. Is Agentic proxies the same scanner and advertises
 * only a burst policy (`"site-scan";q=10;w=60`) with no daily counter, because
 * Vercel absorbs the Ora cost behind their own partner key. Same scan, same
 * payload, without the quota that was blocking the form.
 *
 * The payload is Ora's, field for field, which is why this reuses
 * `parseOraScan` rather than defining a second parser. Verified against a live
 * scan: all 44 checks on our allowlist come back, 43 of them carrying the
 * `recommendation` string the paid half of the report is built from.
 *
 * THIS ENDPOINT IS UNDOCUMENTED ON is-agentic.com. Their public docs describe
 * only the read-only `GET /api/v1/report`, which serves already-stored reports
 * and 404s on anything nobody has scanned — useless for a form where strangers
 * type in their own domain. The streaming endpoint is what their own CLI calls,
 * so it is real and supported in practice, but it carries no version pin and no
 * deprecation promise the way `/api/v1/` does. That is the whole reason
 * `scanDomain` in source.ts keeps Ora underneath as a fallback: if this changes
 * shape or starts demanding a key, scans get slower and quota-bound again, but
 * they do not stop.
 */

const BASE_URL = process.env.IS_AGENTIC_BASE_URL || "https://is-agentic.com";

/**
 * Generous, because this is a live crawl rather than a cache read.
 *
 * A cold scan of a small business site measured ~13s across 124 checks. Slow
 * hosts and redirect chains take longer, and the cost of giving up early is a
 * scan we already paid for in wall-clock time and then threw away.
 */
const STREAM_TIMEOUT_MS = 120_000;

/**
 * Pulls the JSON out of one SSE frame.
 *
 * A frame may carry several `data:` lines that concatenate into one payload,
 * and may also carry `event:`/`id:` lines we have no use for. Returns null on
 * anything unparseable rather than throwing: a single malformed progress frame
 * in the middle of a good scan is not a reason to fail the scan, and the caller
 * only actually needs the terminal frame.
 */
function ssePayload(frame: string): Record<string, unknown> | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Runs a scan and returns it in Ora's shape.
 *
 * `force` asks the proxy to ignore its stored result. It is forwarded on a
 * best-effort basis — Ora documents `force=1` on its own stream endpoint, but
 * whether Is Agentic passes it through is not something their docs state and
 * not something we can assert from the outside. Callers that genuinely require
 * a fresh number (the admin refresh, not the public form) should treat the Ora
 * path as the one that guarantees it.
 */
export async function streamScan(
  domain: string,
  options: { force?: boolean } = {}
): Promise<OraScan> {
  const endpoint = new URL("/api/scan/stream", BASE_URL);
  // Their proxy names this `target`; Ora's own endpoint calls the same thing
  // `domain`. Confirmed against the CLI, which is the only working reference.
  endpoint.searchParams.set("target", domain);
  if (options.force) endpoint.searchParams.set("force", "1");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
    });
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === "AbortError") {
      throw new OraError(
        `Is Agentic did not respond within ${STREAM_TIMEOUT_MS / 1000}s`
      );
    }
    throw new OraError(
      `Could not reach Is Agentic: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!response.ok || !response.body) {
    clearTimeout(timer);
    const retryAfter = Number(response.headers.get("retry-after"));
    const body = await response.text().catch(() => "");
    throw new OraError(
      `Is Agentic responded ${response.status}${
        body ? `: ${body.slice(0, 300)}` : ""
      }`,
      response.status,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: unknown = null;
  let failed = false;

  /** Returns true once the terminal frame has been seen. */
  function handleFrame(frame: string): boolean {
    const event = ssePayload(frame);
    if (!event) return false;
    if (event.type === "scan_complete") {
      result = event.result;
      return true;
    }
    if (event.type === "error") {
      failed = true;
      return true;
    }
    // Everything else is progress — check_start, check_complete, layer_complete
    // and friends. We have no UI streaming this, so they are read and dropped.
    return false;
  }

  try {
    reading: for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        // Stop at the terminal frame rather than draining to end-of-stream. The
        // server keeps the connection open to emit `scan_archived` afterwards,
        // and waiting for it holds a serverless invocation open for a message
        // we do not read.
        if (handleFrame(frame)) break reading;
      }
    }

    // A stream that ended mid-frame can still have a complete final frame in
    // the buffer with no trailing blank line to close it.
    if (!result && !failed) {
      buffer += decoder.decode();
      if (buffer.trim()) handleFrame(buffer);
    }
  } catch (error) {
    throw new OraError(
      `Is Agentic stream broke: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    clearTimeout(timer);
    // Closes the connection, which matters when we broke out early. Cancelling
    // an already-finished reader is a no-op, so this needs no guard beyond
    // swallowing the rejection.
    await reader.cancel().catch(() => {});
  }

  if (failed) {
    throw new OraError("Is Agentic reported the scan failed");
  }
  if (!result) {
    // No status to attach, so `isRetryable` treats it as retryable — correct
    // here, since a truncated stream is exactly the sort of thing that works on
    // a second attempt.
    throw new OraError("Is Agentic stream ended before the scan completed");
  }

  return parseOraScan(result);
}
