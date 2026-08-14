/**
 * The old capture endpoint, kept as an alias.
 *
 * Everything that was here now lives in `/api/lead`, which does the same job
 * plus the spreadsheet row and the push notification. This file is one line of
 * re-export rather than a second copy, because two capture routes that drift
 * apart is exactly the failure this consolidation was meant to prevent.
 *
 * Kept at all because it was a live public endpoint. The form no longer posts
 * here, but a cached page in someone's browser still might, and a lead lost to a
 * 404 is a worse outcome than a redundant file. Safe to delete once the logs go
 * quiet on it.
 */
export { POST } from "../lead/route";

// Declared literally rather than re-exported alongside POST. Next parses the
// route segment config statically at build time, so it has to read these as
// literals in this file — a re-export builds fine as JavaScript and fails the
// build with "it mustn't be reexported". They must stay in step with /api/lead.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
