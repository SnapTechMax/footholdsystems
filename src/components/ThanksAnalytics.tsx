"use client";

import { useEffect, useRef } from "react";
import { PIXEL_HANDOFF_KEY, type PixelLeadPayload } from "@/lib/pixel-handoff";

/**
 * Reports that someone actually reached the thank-you page.
 *
 * Two events, for two audiences.
 *
 * `guide_thanks_view` is a named GA4 event rather than a page_view because the
 * form soft-navigates here (so the guide's conversion hits aren't cut off by a
 * page unload), and a soft navigation does not re-run gtag's config / page_view.
 * One event name that fires on both soft nav and a direct hit is easier to read
 * than a half-tracked page_view.
 *
 * The Meta Pixel `Lead` event fires here rather than in the form. It used to
 * fire on a successful API response, which counted conversions the person never
 * saw the result of; firing on arrival means a Lead in Meta's reporting is a
 * lead that made it all the way through. The custom data — including the
 * experiment arm that lib/cro/meta.ts splits conversions by — is handed over in
 * sessionStorage by the form, since a soft navigation carries no props.
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

    // Read and clear in one go. Left in place it would fire a second Lead on a
    // refresh or a back-and-forward, and a conversion count that inflates when
    // someone reloads is worse than one that occasionally misses.
    let payload: PixelLeadPayload = { content_name: "5 Levels of AI" };
    try {
      const raw = window.sessionStorage.getItem(PIXEL_HANDOFF_KEY);
      if (raw) {
        window.sessionStorage.removeItem(PIXEL_HANDOFF_KEY);
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") payload = parsed as PixelLeadPayload;
      }
    } catch {
      // Storage disabled or corrupted JSON. Fires with the default payload —
      // the conversion is the part that matters, the variant is the nice-to-have.
    }

    window.fbq?.("track", "Lead", payload);
  }, []);

  return null;
}
