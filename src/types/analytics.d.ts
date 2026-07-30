// Analytics globals injected by the tag snippets in app/layout.tsx.
// All three are optional — they are no-ops when a tag is blocked or not yet loaded.
declare global {
  interface Window {
    /** Microsoft UET (Bing Ads) event queue. */
    uetq?: unknown[];
    /** Meta (Facebook) Pixel. */
    fbq?: (...args: unknown[]) => void;
    /** Google Analytics 4. */
    gtag?: (...args: unknown[]) => void;
    /** Microsoft Clarity. */
    clarity?: (...args: unknown[]) => void;
  }
}

export {};
