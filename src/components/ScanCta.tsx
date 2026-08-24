"use client";

import { SCAN_ANCHOR } from "@/lib/site";

/**
 * The one call to action on the page.
 *
 * Every CTA is this component pointed at the same anchor, so there is exactly
 * one thing a visitor can do. `entryPoint` is the only thing that varies, and it
 * is what makes the Clarity scroll maps actionable: on a page this long the
 * useful question is not "did they click" but "how far down were they when they
 * did", and that only gets answered if each button reports its own position.
 *
 * A client component because of the click handlers. It renders an anchor, so it
 * still works with JavaScript off — the tracking is the part that degrades, not
 * the navigation.
 */
export function ScanCta({
  entryPoint,
  children,
  variant = "primary",
  className = "",
}: {
  /** Where on the page this button sits, e.g. "hero" or "final-close". */
  entryPoint: string;
  children?: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const track = () => {
    window.gtag?.("event", "scan_cta_click", {
      event_category: "scan",
      event_label: entryPoint,
    });
    // Custom rather than a standard event: the standard Lead fires when the
    // scan form is actually submitted. Conflating the two would teach Meta's
    // optimiser to buy scrollers instead of leads.
    window.fbq?.("trackCustom", "ScanCtaClick", { content_name: entryPoint });
  };

  const base =
    "group inline-flex items-center justify-center gap-2.5 rounded-lg px-8 py-4 text-center font-display text-base font-extrabold uppercase tracking-[0.02em] transition-all duration-150 sm:text-lg";

  const styles =
    variant === "primary"
      ? "bg-[var(--accent)] text-[var(--ink)] shadow-[0_0_0_0_rgba(246,190,0,0.45)] hover:bg-[var(--accent-hot)] hover:shadow-[0_0_34px_0_rgba(246,190,0,0.35)]"
      : "border border-[var(--line)] bg-transparent text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]";

  return (
    <a
      href={SCAN_ANCHOR}
      onClick={track}
      className={`${base} ${styles} ${className}`}
    >
      {children ?? "Scan my site free"}
      <span
        aria-hidden="true"
        className="transition-transform duration-150 group-hover:translate-x-1"
      >
        &rarr;
      </span>
    </a>
  );
}
