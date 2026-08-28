"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  type BusinessCategory,
} from "@/lib/scan/categories";
import { metaEventId } from "@/lib/meta-event-id";
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
 *
 * IT IS ALSO A WEBMCP TOOL. The 2026-08-27 agent-readiness scan scored webmcp
 * 0/5 — the single largest deduction on the whole site, and the most awkward
 * one to be carrying, since the pitch is that a business should be reachable by
 * an agent and the only action on ours was reachable exclusively by a human
 * with a mouse. Two mechanisms, because they are read by different things:
 *
 *   toolname / tooldescription attributes on the <form>, which survive into the
 *   server-rendered HTML and so are visible to a crawler that never runs our
 *   JavaScript;
 *
 *   document.modelContext.registerTool(), which gives an agent that *is* in the
 *   page a typed call with a schema instead of a form to fill in by hand.
 *
 * Both drive the same `submitScan` below. An agent-facing path that could drift
 * from the human one would eventually validate differently, count differently,
 * or record consent differently, and the third of those is not a bug we get to
 * fix afterwards.
 */

type FieldName = "url" | "email" | "consent" | "category";

export function ScanForm({ entryPoint = "scan" }: { entryPoint?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  /**
   * Preselected rather than left empty.
   *
   * The check set has to be decided one way or another, and most people
   * arriving from a cold ad are a service business. An empty select is one more
   * decision between a visitor and a conversion, and the cost of a wrong
   * default is a slightly generic report rather than a broken one.
   */
  const [category, setCategory] = useState<BusinessCategory>(DEFAULT_CATEGORY);
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

  /**
   * Posts one scan request and handles everything that follows a success.
   *
   * Split out of the submit handler so the WebMCP tool can reach it. It takes
   * its values as an argument rather than reading the state above, because the
   * tool has its own — an agent calling with a url and an email must not depend
   * on React having re-rendered the inputs first, and a tool that silently
   * scanned whatever was left in the box would be worse than one that failed.
   *
   * `source` distinguishes the two callers in analytics. Same event either way;
   * an agent-driven scan is a real scan and should be counted as one.
   */
  async function submitScan(
    values: {
      url: string;
      email: string;
      category: BusinessCategory;
      consent: boolean;
    },
    source: string
  ): Promise<
    | { ok: true; token?: string }
    | { ok: false; error: string; field?: FieldName }
  > {
    let response: Response;
    try {
      response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: values.url,
          email: values.email,
          category: values.category,
          consent: values.consent,
          consentText: CONSENT_TEXT,
          attribution: attribution.current,
          elapsedMs:
            renderedAt.current === null
              ? undefined
              : Date.now() - renderedAt.current,
          [HONEYPOT_FIELD]: honeypotRef.current?.value ?? "",
        }),
      });
    } catch {
      return {
        ok: false,
        error:
          "We couldn't reach the server. Check your connection and try again.",
      };
    }

    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      token?: string;
      error?: string;
      field?: FieldName;
    };

    if (!response.ok || !data.ok) {
      return {
        ok: false,
        error: data.error ?? "Something went wrong. Please try again.",
        field: data.field,
      };
    }

    window.gtag?.("event", "scan_requested", {
      event_category: "scan",
      event_label: source,
    });

    // Meta's Lead fires on the thank-you page now, not here — see LeadPixel.
    // Except for the WebMCP path, which deliberately does not navigate, so
    // nothing downstream would ever fire it. Same event, same derived eventID,
    // so an agent-driven scan is still deduplicated against the Conversions
    // API's half and still counted exactly once.
    if (source === "webmcp" && data.token) {
      window.fbq?.(
        "track",
        "Lead",
        { content_name: "ai-visibility-scan" },
        { eventID: metaEventId.lead(data.token) }
      );
    }

    return { ok: true, token: data.token };
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);
    setErrorField(null);

    const result = await submitScan(
      { url, email, category, consent },
      entryPoint
    );

    if (!result.ok) {
      setError(result.error);
      setErrorField(result.field ?? null);
      setPending(false);
      return;
    }

    router.push(
      result.token ? `/scan/thanks?t=${result.token}` : "/scan/thanks"
    );
  }

  /**
   * Registers the scan as a WebMCP tool.
   *
   * Deliberately does NOT navigate on success. The human path routes to the
   * thank-you page because a person needs to see that something happened; an
   * agent needs a value back, and yanking the document out from under it
   * mid-call would destroy the answer it asked for. So the tool returns the
   * report URL as text and leaves the page where it is.
   *
   * `consent` is a required parameter with no default, and the tool refuses
   * without it. The route stores CONSENT_TEXT verbatim against the address as a
   * legal record, and a tool that passed `true` because passing `false` fails
   * would be manufacturing that record on behalf of somebody who never saw the
   * sentence. See CONSENT_TEXT in lib/site.ts for why the stored wording is the
   * only thing that makes the record worth anything.
   *
   * The whole body is wrapped: this is a draft API in one browser, and a
   * conversion form is not the place to find out that a shape changed.
   */
  useEffect(() => {
    const context = document.modelContext ?? navigator.modelContext;
    if (!context?.registerTool) return;

    let unregister: (() => void) | void;
    try {
      unregister = context.registerTool({
        name: "run_ai_visibility_scan",
        description:
          "Run a free AI visibility scan of a business website and email the " +
          "report. Returns a score out of 100 for how readable and " +
          "recommendable the site is to AI assistants such as ChatGPT, " +
          "Gemini, Perplexity and Copilot, plus every finding ranked worst " +
          "first. Requires the visitor's own explicit consent to be emailed.",
        inputSchema: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description:
                "The business website to scan, e.g. yourbusiness.com. A bare " +
                "domain is fine; the scheme and any path are ignored.",
            },
            email: {
              type: "string",
              description: "Where to send the report. The scan is emailed, not returned inline.",
            },
            category: {
              type: "string",
              enum: CATEGORIES.map((c) => c.value),
              description:
                "What kind of business this is. Decides which checks are run " +
                "and which are skipped as inapplicable. " +
                CATEGORIES.map((c) => `${c.value}: ${c.hint}`).join(" "),
            },
            consent: {
              type: "boolean",
              description:
                "Must be true, and must come from the person whose email " +
                "address this is, having been shown this exact sentence: " +
                CONSENT_TEXT,
            },
          },
          required: ["url", "email", "consent"],
        },
        execute: async (args) => {
          const requestedUrl = typeof args.url === "string" ? args.url : "";
          const requestedEmail =
            typeof args.email === "string" ? args.email : "";
          const requestedCategory = CATEGORIES.some(
            (c) => c.value === args.category
          )
            ? (args.category as BusinessCategory)
            : DEFAULT_CATEGORY;

          if (args.consent !== true) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "Refused: the scan is emailed, so it needs the recipient's " +
                    "own consent. Ask them to confirm this sentence and call " +
                    `again with consent set to true — "${CONSENT_TEXT}"`,
                },
              ],
              isError: true,
            };
          }

          const result = await submitScan(
            {
              url: requestedUrl,
              email: requestedEmail,
              category: requestedCategory,
              consent: true,
            },
            "webmcp"
          );

          if (!result.ok) {
            return {
              content: [{ type: "text", text: result.error }],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "text",
                text: result.token
                  ? `Scan started for ${requestedUrl}. The report is emailed to ` +
                    `${requestedEmail} within a few minutes and will be readable at ` +
                    `${window.location.origin}/scan/${result.token}.`
                  : `Scan started for ${requestedUrl}. The report is emailed to ${requestedEmail} within a few minutes.`,
              },
            ],
          };
        },
      });
    } catch (error) {
      // A draft API that threw is a browser problem, not a customer problem.
      console.warn("WebMCP: could not register the scan tool —", error);
    }

    return () => {
      try {
        unregister?.();
      } catch {
        // Nothing useful to do on the way out.
      }
    };
    // Empty deps, once, on mount. submitScan closes over `attribution` and
    // `renderedAt`, both refs, and over nothing that changes per render. The
    // alternative is re-registering the tool on every keystroke, and an agent
    // holding a handle to a tool that is torn down as the user types is worse
    // than a stale closure over two refs.
  }, []);

  const fieldBase =
    "w-full rounded-lg border bg-[var(--ink)] px-4 py-3.5 text-[16px] text-[var(--text)] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="mt-10"
      /* WebMCP form annotation. Lowercase and unprefixed because that is what
         the draft specifies and what React passes straight through to the DOM —
         and, more to the point, because these have to be legible in the HTML
         itself. The registerTool call above is richer but only exists once our
         JavaScript has run, and a crawler that never runs it still needs to be
         able to see that this page has an action on it. */
      toolname="run_ai_visibility_scan"
      tooldescription="Run a free AI visibility scan of a business website. Takes the site URL, the business category, and an email address to send the report to. Returns a score out of 100 and every place the site is unreadable or ambiguous to an AI assistant."
    >
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
            htmlFor="scan-category"
            className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]"
          >
            What kind of business
          </label>
          <select
            id="scan-category"
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value as BusinessCategory)}
            aria-describedby="scan-category-hint"
            className={`${fieldBase} appearance-none bg-[image:var(--select-caret)] bg-[length:12px] bg-[position:right_1rem_center] bg-no-repeat pr-12 ${
              errorField === "category"
                ? "border-[var(--danger)]"
                : "border-[var(--line)]"
            }`}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {/* The hint changes with the selection rather than listing all three,
              so the field stays one line tall and still disambiguates. */}
          <p
            id="scan-category-hint"
            className="mt-2 text-[13px] leading-snug text-[var(--dim)]"
          >
            {CATEGORIES.find((c) => c.value === category)?.hint}
          </p>
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
