"use client";

import { useEffect, useRef } from "react";

/**
 * Reports that someone actually reached the thank-you page.
 *
 * This is a named event rather than a page_view because the form soft-navigates
 * here (so the guide's conversion hits aren't cut off by a page unload), and a
 * soft navigation does not re-run gtag's config / page_view. One event name that
 * fires on both soft nav and a direct hit is easier to read than a half-tracked
 * page_view.
 */
export function ThanksAnalytics() {
  // Guard against a second send: React StrictMode re-runs effects in dev, and a
  // remount shouldn't inflate a conversion count.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    window.gtag?.("event", "guide_thanks_view", {
      event_category: "lead-magnet",
      event_label: "5 Levels of AI",
    });
  }, []);

  return null;
}
