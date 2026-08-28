"use client";

import { useEffect } from "react";
import { metaEventId } from "@/lib/meta-event-id";

/**
 * Fires the Lead conversion once, on the thank-you page.
 *
 * It used to fire inside ScanForm the moment /api/scan returned ok, before the
 * router pushed here. That counted a lead the instant the request succeeded,
 * which is earlier than the thing worth optimising toward: a visitor who
 * actually landed on the page telling them the scan is running. Firing on
 * arrival also anchors the event to a real page load, so it sits alongside the
 * PageView for that document rather than in the tail of the page before it.
 *
 * GA4's `scan_requested` deliberately stays in the form. It fires for the
 * WebMCP path too, which never navigates here, and it carries the entry point
 * as a label — both of which would be lost by moving it.
 *
 * TWO GUARDS, because a Lead that fires twice teaches delivery that a cohort
 * converts at double its real rate, and the spend follows:
 *
 *   1. No token, no event. The thank-you URL is refreshable and shareable, and
 *      a Lead without a token has no `eventID`, so Meta cannot collapse it
 *      against the Conversions API's half and counts the pair as two. The scan
 *      route always returns a token; anyone arriving here without one did not
 *      come from a submission we can attribute, and a missing event is the
 *      cheaper mistake.
 *   2. localStorage, keyed by token, catches the refresh and the bookmark. Same
 *      shape as PurchasePixel's third guard, and the same limitation: it is
 *      per-browser, so the same link opened on a second device fires again. The
 *      shared `eventID` makes the browser-versus-server pair safe; two browsers
 *      is a corner we accept.
 */

const STORAGE_PREFIX = "fh_lead";

export function LeadPixel({ token }: { token?: string }) {
  useEffect(() => {
    if (!token) return;

    const key = `${STORAGE_PREFIX}:${token}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, String(Date.now()));
    } catch {
      // Private browsing, or storage disabled. Firing once too often is a
      // better failure here than never recording the lead at all.
    }

    // eventID must match the Conversions API's id for this same lead, or Meta
    // counts the browser event and the server event as two. See
    // meta-event-id.ts — the string is derived from the token, never random,
    // for exactly this reason.
    window.fbq?.(
      "track",
      "Lead",
      { content_name: "ai-visibility-scan" },
      { eventID: metaEventId.lead(token) }
    );
  }, [token]);

  return null;
}
