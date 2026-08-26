"use client";

import { useState, useTransition } from "react";
import { publishHandover, unpublishHandover } from "./actions";

/**
 * The form an admin fills in once a build is delivered.
 *
 * Publishing is what makes /scan/<token>/complete exist. Until then that URL
 * 404s, so a half-finished job cannot be found by guessing.
 */

const field =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-[15px] text-[var(--text)] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const label =
  "mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]";

export function HandoverForm() {
  const [lookup, setLookup] = useState("");
  const [secondDomain, setSecondDomain] = useState("");
  const [notes, setNotes] = useState("");
  // Defaults to today. An admin publishing a handover is almost always doing it
  // the day the work landed, and a wrong date is visible on the page.
  const [deliveredAt, setDeliveredAt] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [result, setResult] = useState<{
    url: string;
    domain: string;
    warning?: string;
  } | null>(null);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const publish = () =>
    start(async () => {
      setError("");
      setResult(null);
      setRemoved(false);
      const response = await publishHandover({
        lookup,
        secondDomain,
        notes,
        deliveredAt: new Date(deliveredAt).toISOString(),
      });
      if (response.ok) {
        setResult({
          url: response.url,
          domain: response.domain,
          warning: response.warning,
        });
      } else {
        setError(response.error);
      }
    });

  const unpublish = () =>
    start(async () => {
      setError("");
      setResult(null);
      setRemoved(false);
      const response = await unpublishHandover(lookup);
      if (response.ok) setRemoved(true);
      else setError(response.error);
    });

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
      <div className="space-y-5">
        <div>
          <label htmlFor="ho-lookup" className={label}>
            Scan token or their domain
          </label>
          <input
            id="ho-lookup"
            className={field}
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
            placeholder="joesplumbing.com"
          />
          <p className="mt-2 text-[13px] leading-snug text-[var(--dim)]">
            A domain finds their most recent completed scan. A token is exact,
            and is the part of their report URL after /scan/.
          </p>
        </div>

        <div>
          <label htmlFor="ho-second" className={label}>
            The second site you built
          </label>
          <input
            id="ho-second"
            className={field}
            value={secondDomain}
            onChange={(e) => setSecondDomain(e.target.value)}
            placeholder="joesplumbing-answers.com"
          />
        </div>

        <div>
          <label htmlFor="ho-notes" className={label}>
            What changed
          </label>
          <textarea
            id="ho-notes"
            rows={7}
            className={field}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              "Written to them, not about them. Blank line between paragraphs.\n\nRewrote your five service pages so each one answers the question a customer actually asks…\n\nAdded structured data across the site and lined up your Google Business Profile with…"
            }
          />
          <p className="mt-2 text-[13px] leading-snug text-[var(--dim)]">
            They read this. Paragraphs split on a blank line.
          </p>
        </div>

        <div>
          <label htmlFor="ho-date" className={label}>
            Delivered
          </label>
          <input
            id="ho-date"
            type="date"
            className={field}
            value={deliveredAt}
            onChange={(e) => setDeliveredAt(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={publish}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-7 py-3.5 font-display text-[15px] font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-colors hover:bg-[var(--accent-hot)] disabled:opacity-50"
        >
          {pending ? "Working…" : "Publish handover"}
        </button>
        <button
          type="button"
          onClick={unpublish}
          disabled={pending}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dim)] underline underline-offset-4 transition-colors hover:text-[var(--muted)] disabled:opacity-50"
        >
          Take it back down
        </button>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3 text-[14px] leading-relaxed text-[var(--muted)]">
          {error}
        </p>
      )}

      {removed && (
        <p className="mt-6 rounded-lg border border-[var(--line)] px-4 py-3 text-[14px] leading-relaxed text-[var(--muted)]">
          Handover removed. That URL 404s again.
        </p>
      )}

      {result && (
        <div className="mt-6 rounded-lg border-2 border-[var(--accent)]/40 bg-[var(--ink)] px-5 py-4">
          <p className="text-[14px] leading-relaxed text-[var(--muted)]">
            Published for{" "}
            <span className="font-semibold text-[var(--text)]">
              {result.domain}
            </span>
            . Send them this:
          </p>
          <p className="mt-3 break-all font-mono text-[13px] text-[var(--accent)]">
            {result.url}
          </p>
          {result.warning && (
            <p className="mt-4 border-t border-[var(--line)] pt-3 text-[13px] leading-relaxed text-[var(--dim)]">
              {result.warning}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
