"use client";

import { useEffect } from "react";
import { metaEventId } from "@/lib/meta-event-id";

/**
 * The browser half of ReportOpened.
 *
 * Fires `ViewContent` when somebody actually reads their report — the first
 * point in this funnel where a visitor has done something more selective than
 * type an email address. Lead finds people who fill in forms; this finds people
 * who came back for the answer, and those are not the same population.
 *
 * NO GUARD OF ITS OWN, unlike LeadPixel and PurchasePixel, and that is
 * deliberate. The server decides whether this renders at all: the report page
 * claims the first open with a conditional UPDATE on `scans.report_opened_at`
 * and only passes `fire` when its own UPDATE was the one that won. A
 * localStorage guard here would be the wrong instrument anyway — the report
 * link is emailed and permanent, so the same person opens it on a laptop and
 * then a phone, and a per-browser guard would call that two reads. One column
 * in the database is the only place that fact can live truthfully.
 *
 * The matching server event goes out on that same request, sharing this
 * `eventID`, so the pair collapses into one.
 */
export function ReportOpenedPixel({
  token,
  category,
  score,
  fire,
}: {
  token: string;
  category?: string;
  score?: number | null;
  /** True only on the request that claimed the first open. */
  fire: boolean;
}) {
  useEffect(() => {
    if (!fire) return;

    window.fbq?.(
      "track",
      "ViewContent",
      {
        content_name: "ai-visibility-report",
        content_type: "product",
        content_ids: ["ai-visibility-report"],
        ...(category ? { content_category: category } : {}),
        ...(typeof score === "number" ? { report_score: score } : {}),
      },
      { eventID: metaEventId.reportOpened(token) }
    );

    window.gtag?.("event", "report_opened", {
      event_category: "scan",
      ...(category ? { business_category: category } : {}),
      ...(typeof score === "number" ? { value: score } : {}),
    });
  }, [token, category, score, fire]);

  return null;
}
