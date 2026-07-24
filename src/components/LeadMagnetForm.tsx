"use client";

import { useState } from "react";

declare global {
  interface Window {
    uetq?: unknown[];
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

const GUIDE_PATH = "/downloads/foothold-5-levels-of-ai.pdf";

export function LeadMagnetForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

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
        }),
      });

      if (!response.ok) throw new Error("Submission failed");

      setStatus("success");
      // Microsoft UET conversion event (no-op if UET isn't loaded)
      window.uetq = window.uetq || [];
      window.uetq.push("event", "other", {
        event_category: "lead-magnet",
        event_label: "5 Levels of AI",
      });
      // Meta Pixel lead conversion
      window.fbq?.("track", "Lead", { content_name: "5 Levels of AI" });
    } catch {
      setStatus("error");
    } finally {
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

  if (status === "success") {
    return (
      <div className="rounded-xl bg-[#f6be00] p-8 text-[#1b1b1b] sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#1b1b1b]/70">
          You&apos;re in
        </p>
        <h3 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Check your inbox.
        </h3>
        <p className="mt-3 max-w-md font-serif text-[15px] leading-relaxed text-[#1b1b1b]/80">
          The 5 Levels of AI is on its way{email ? ` to ${email}` : ""}. It can take a
          minute. If it&apos;s not there, check spam, or grab it directly below.
        </p>
        <a
          href={GUIDE_PATH}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-lg border-2 border-[#1b1b1b] px-6 py-3 font-semibold transition-colors hover:bg-[#1b1b1b] hover:text-[#f6be00]"
        >
          Download it now &rarr;
        </a>
      </div>
    );
  }

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
          "Send me the guide →"
        )}
      </button>

      {status === "error" && (
        <p className="mt-3 text-sm text-[#ff9d7a]">
          Something went wrong. Please try again, or email hello@footholdsystems.com and we&apos;ll send it over.
        </p>
      )}

      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[#8a887f]">
        Free. One email. No spam, no drip sequence you can&apos;t escape.
      </p>
    </form>
  );
}
