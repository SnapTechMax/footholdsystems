// Analytics globals injected by the tag snippets in app/layout.tsx.
// All are optional — they are no-ops when a tag is blocked or not yet loaded.
//
// Microsoft UET (Bing Ads) used to be declared here, and four components pushed
// conversions onto `window.uetq`. No UET tag was ever added to layout.tsx, so
// every one of those events went into an array nothing read. The pushes are
// gone; adding UET means adding the tag first, then the events.
declare global {
  interface Window {
    /** Meta (Facebook) Pixel. */
    fbq?: (...args: unknown[]) => void;
    /** Google Analytics 4. */
    gtag?: (...args: unknown[]) => void;
    /** Microsoft Clarity. */
    clarity?: (...args: unknown[]) => void;
  }
}

export {};
