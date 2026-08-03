"use client";

import { calendlyUrl } from "@/lib/site";

/**
 * Calendly CTA that reports which entry point it was clicked from.
 *
 * The booking window itself (max 7 days out, 1–4pm PT) is set on the Calendly
 * event type, not here — see BOOKING.md.
 */
export function BookCallButton({
  entryPoint,
  className,
  children,
}: {
  /** Short slug for where this button lives, e.g. "guide-thanks" or "header". */
  entryPoint: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const track = () => {
    window.gtag?.("event", "book_call_click", {
      event_category: "booking",
      event_label: entryPoint,
    });
    window.fbq?.("trackCustom", "BookCallClick", { content_name: entryPoint });
  };

  return (
    <a
      href={calendlyUrl(entryPoint)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={track}
      className={className}
    >
      {children ?? "Book a call →"}
    </a>
  );
}
