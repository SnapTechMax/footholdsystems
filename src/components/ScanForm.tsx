"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CONSENT_TEXT } from "@/lib/site";
import { HONEYPOT_FIELD } from "@/lib/spam";

/**
 * The scan capture form — the only conversion point on the site.
 *
 * Two fields and one checkbox. Every additional field on a cold-traffic form
 * costs conversions, and everything else we need (the domain, the business
 * name, the category) comes out of the scan itself.
 *
 * Validation messages land under the field they belong to, which the route
 * supports by returning a `field` alongside the error. That is the difference
 * between "fix this" and "something went wrong".
 */

type FieldName = "url" | "email" | "consent";

export function ScanForm({ entryPoint = "scan" }: { entryPoint?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<FieldName | null>(null);

  /**
   * When the form mounted, so the route can reject instant submissions.
   *
   * Set in the effect rather than as the ref's initial value: calling Date.now()
   * during render is impure and gives an unstable result if React re-renders
   * the component. Null until mount, and a null elapsed time is simply omitted
   * rather than sent as 0, which would look like a bot to the route.
   */
  const renderedAt = useRef<number | null>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);

  // Campaign parameters, read once on mount. Attribution has to survive the
  // trip or there is no way to tell which ad paid for a scan.
  const attribution = useRef<Record<string, string> | null>(null);
  useEffect(() => {
    renderedAt.current = Date.now();
    try {
      const params = new URLSearchParams(window.location.search);
      const out: Record<string, string> = {};
      for (const key of [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "fbclid",
        "gclid",
      ]) {
        const value = params.get(key);
        if (value) out[key] = value;
      }
      if (document.referrer) out.referrer = document.referrer;
      out.landing_page = window.location.pathname;
      attribution.current = out;
    } catch {
      // Attribution is nice to have. It is never worth breaking the form for.
    }
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setErrorField(null);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          email,
          consent,
          consentText: CONSENT_TEXT,
          attribution: attribution.current,
          elapsedMs:
            renderedAt.current === null
              ? undefined
              : Date.now() - renderedAt.current,
          [HONEYPOT_FIELD]: honeypotRef.current?.value ?? "",
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        token?: string;
        error?: string;
        field?: FieldName;
      };

      if (!response.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setErrorField(data.field ?? null);
        setPending(false);
        return;
      }

      // Fire before navigating: the thank-you page is a different document and
      // an event queued here would not survive the transition.
      window.gtag?.("event", "scan_requested", {
        event_category: "scan",
        event_label: entryPoint,
      });
      window.fbq?.("track", "Lead", { content_name: "ai-visibility-scan" });

      router.push(data.token ? `/scan/thanks?t=${data.token}` : "/scan/thanks");
    } catch {
      setError(
        "We couldn't reach the server. Check your connection and try again."
      );
      setPending(false);
    }
  }

  const fieldBase =
    "w-full rounded-lg border bg-[var(--ink)] px-4 py-3.5 text-[16px] text-[var(--text)] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

  return (
    <form onSubmit={onSubmit} noValidate className="mt-10">
      {/* Decoy. Off-screen rather than display:none — some bots skip hidden
          fields, and a positioned input still gets filled. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Company</label>
        <input
          ref={honeypotRef}
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="scan-url"
            className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]"
          >
            Your website
          </label>
          <input
            id="scan-url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourbusiness.com"
            aria-invalid={errorField === "url"}
            className={`${fieldBase} ${
              errorField === "url"
                ? "border-[var(--danger)]"
                : "border-[var(--line)]"
            }`}
          />
        </div>

        <div>
          <label
            htmlFor="scan-email"
            className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]"
          >
            Where to send the results
          </label>
          <input
            id="scan-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourbusiness.com"
            aria-invalid={errorField === "email"}
            className={`${fieldBase} ${
              errorField === "email"
                ? "border-[var(--danger)]"
                : "border-[var(--line)]"
            }`}
          />
        </div>
      </div>

      <label
        htmlFor="scan-consent"
        className="mt-5 flex cursor-pointer items-start gap-3 text-left"
      >
        <input
          id="scan-consent"
          name="consent"
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          aria-invalid={errorField === "consent"}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
        />
        <span
          className={`text-[14px] leading-[1.5] ${
            errorField === "consent" ? "text-[var(--danger)]" : "text-[var(--muted)]"
          }`}
        >
          {CONSENT_TEXT}
        </span>
      </label>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-4 py-3 text-[14px] leading-relaxed text-[var(--text)]"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="group mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-all duration-150 hover:bg-[var(--accent-hot)] hover:shadow-[0_0_34px_0_rgba(246,190,0,0.35)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-lg"
      >
        {pending ? "Starting your scan…" : "Run my free scan"}
        {!pending && (
          <span
            aria-hidden="true"
            className="transition-transform duration-150 group-hover:translate-x-1"
          >
            &rarr;
          </span>
        )}
      </button>

      <p className="mt-4 text-center text-[13px] leading-relaxed text-[var(--dim)]">
        Free. No card. Results land in your inbox in a couple of minutes.
      </p>
    </form>
  );
}
