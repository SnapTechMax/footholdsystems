"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CONSENT_TEXT, THANKS_PATH } from "@/lib/site";

export function LeadMagnetForm({
  submitLabel = "Send me the guide →",
  footnote = "Free. One email. No spam, no drip sequence you can't escape.",
  experimentId = null,
  variant = null,
}: {
  submitLabel?: string;
  footnote?: string;
  /** Set when a CRO experiment is running, so conversions can be attributed. */
  experimentId?: number | null;
  variant?: "a" | "b" | null;
} = {}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  // Unticked, and required to submit. Pre-ticking it would remove the
  // affirmative action that makes the stored consent record worth anything.
  const [optIn, setOptIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "error">("idle");

  // Warm the thank-you route so the redirect after submit is instant.
  useEffect(() => {
    router.prefetch(THANKS_PATH);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus("idle");

    try {
      const response = await fetch("/api/lead-magnet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          source: "Foothold Systems - 5 Levels of AI",
          experimentId,
          variant,
          optIn,
          consentText: CONSENT_TEXT,
        }),
      });

      if (!response.ok) throw new Error("Submission failed");

      // Microsoft UET conversion event (no-op if UET isn't loaded)
      window.uetq = window.uetq || [];
      window.uetq.push("event", "other", {
        event_category: "lead-magnet",
        event_label: "5 Levels of AI",
      });
      // GA4 recommended lead event — powers GA4's built-in lead-gen reports.
      // Fires only on a successful submission (guide actually delivered).
      window.gtag?.("event", "generate_lead", {
        event_category: "lead-magnet",
        event_label: "5 Levels of AI",
      });
      // Meta Pixel lead conversion. `variant` is sent as custom data so the
      // pixel's conversions can be split by experiment arm via the Graph API's
      // custom_data_field aggregation — see lib/cro/meta.ts.
      window.fbq?.("track", "Lead", {
        content_name: "5 Levels of AI",
        ...(variant ? { variant, experiment_id: experimentId } : {}),
      });

      // Soft-navigate to the thank-you page. A client-side push (rather than a
      // full page load) means the conversion hits above are never cut off by an
      // unload. isSubmitting stays true so the button keeps its spinner and the
      // form can't be double-submitted while the route transitions.
      router.push(THANKS_PATH);
    } catch {
      setStatus("error");
      setIsSubmitting(false);
    }
  };

  // Fire analytics the moment the "Send me the guide" button is clicked.
  // This tracks click intent on every click (even before validation), and is
  // separate from the conversion events that fire once delivery succeeds.
  const trackGuideClick = () => {
    window.gtag?.("event", "send_guide_click", {
      event_category: "lead-magnet",
      event_label: "5 Levels of AI",
    });
    window.uetq = window.uetq || [];
    window.uetq.push("event", "send_guide_click", {
      event_category: "lead-magnet",
      event_label: "5 Levels of AI",
    });
    window.fbq?.("trackCustom", "SendGuideClick", {
      content_name: "5 Levels of AI",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          type="text"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First name (optional)"
          autoComplete="given-name"
          className="w-full rounded-lg border border-[#3a3a37] bg-[#f2efe6] px-4 py-3.5 text-[#1b1b1b] placeholder-[#8a887f] focus:border-[#f6be00] focus:outline-none focus:ring-2 focus:ring-[#f6be00] sm:max-w-[38%]"
        />
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourbusiness.com"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-[#3a3a37] bg-[#f2efe6] px-4 py-3.5 text-[#1b1b1b] placeholder-[#8a887f] focus:border-[#f6be00] focus:outline-none focus:ring-2 focus:ring-[#f6be00]"
        />
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="optIn"
          required
          checked={optIn}
          onChange={(e) => setOptIn(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#f6be00]"
        />
        <span className="font-serif text-[14px] leading-relaxed text-[#cfccc2]">
          {CONSENT_TEXT}
        </span>
      </label>

      <button
        type="submit"
        onClick={trackGuideClick}
        disabled={isSubmitting}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#f6be00] px-8 py-4 text-lg font-bold text-[#1b1b1b] transition-colors hover:bg-[#ffd23d] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <>
            <svg className="-ml-1 mr-1 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Sending&hellip;
          </>
        ) : (
          submitLabel
        )}
      </button>

      {status === "error" && (
        <p className="mt-3 text-sm text-[#ff9d7a]">
          Something went wrong. Please try again, or email max@footholdsystems.com and we&apos;ll send it over.
        </p>
      )}

      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[#8a887f]">
        {footnote}
      </p>
    </form>
  );
}
