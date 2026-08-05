"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Reports page views on client-side navigation.
 *
 * Both tag snippets in the layout fire exactly once, on the initial document
 * load: `gtag('config', …)` sends one page_view, and the pixel's `fbq('track',
 * 'PageView')` sends one PageView. Every navigation after that is a soft one —
 * the header, the footer and the homepage all use `next/link` — so the URL
 * changes, React swaps the tree, and neither tag hears about it.
 *
 * Measured rather than assumed: navigating `/` → `/guide` produced no new
 * `config` or `page_view` in the dataLayer and zero `fbq` calls.
 *
 * What that costs is narrower than it first looks, and worth stating precisely.
 * An ad click lands on `/guide` as a full document load, so the landing view a
 * campaign is judged on was always recorded. What went missing is every
 * *internal* journey: someone arriving on `/` and clicking through to `/guide`
 * counted as a single homepage view. GA4 therefore under-reported `/guide`, and
 * any Meta custom audience built on "viewed /guide" silently excluded everyone
 * who came via the homepage — which is the half that matters for retargeting.
 *
 * The first render is skipped on purpose. The tags have already fired by then,
 * and sending again here would double every entry view.
 *
 * Pathname only, deliberately. `useSearchParams` would force this into a
 * Suspense boundary and opt the whole tree into client rendering, and the query
 * string is already on `location.href` below.
 */
export function RouteAnalytics() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    window.gtag?.("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });

    // No parameters: the pixel reads the current URL itself, and PageView is
    // the event Meta's audience rules and campaign optimisation are built on.
    window.fbq?.("track", "PageView");
  }, [pathname]);

  return null;
}
