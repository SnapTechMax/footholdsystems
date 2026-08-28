"use client";

import { useState, useTransition } from "react";
import { CATEGORIES } from "@/lib/scan/categories";
import type { OutreachScanSummary } from "@/lib/scan/db";
import {
  queueOutreachScans,
  refreshOutreachScans,
  type QueuedScan,
} from "./actions";

/**
 * Paste domains in, get audit links out.
 *
 * The list below the form is the working surface, not the form. An outbound
 * session is: paste ten prospects, wait, then copy ten links into ten emails —
 * so the finished scans have to be one click from the clipboard, and a scan
 * that failed has to say so on the same screen rather than silently producing
 * a link to an error page.
 */

const field =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--ink)] px-4 py-3 text-[15px] text-[var(--text)] placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";
const label =
  "mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--dim)]";
const mono = "font-mono text-[10px] uppercase tracking-[0.14em]";

/** Colour and wording for each scan state, in one place. */
function statusChip(scan: OutreachScanSummary): {
  text: string;
  className: string;
} {
  if (scan.status === "complete") {
    return {
      text: `${scan.score}/100 · ${scan.grade} · ${scan.findingCount} ${
        scan.findingCount === 1 ? "fix" : "fixes"
      }`,
      className: "border-[#f6be00]/50 text-[#f6be00]",
    };
  }
  if (scan.status === "failed") {
    return { text: "Failed", className: "border-[#ff9d7a]/50 text-[#ff9d7a]" };
  }
  return {
    text: scan.status === "running" ? "Running" : "Queued",
    className: "border-[#4a4a44] text-[#8a887f]",
  };
}

/**
 * Copies a link, and says so.
 *
 * The whole point of this screen is getting a URL into an email, and a copy
 * button with no feedback makes you paste somewhere to check it worked.
 */
function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard access can be refused, and the link is on screen anyway.
          setCopied(false);
        }
      }}
      className={`${mono} rounded border border-[#33332f] px-2.5 py-1 text-[#8a887f] transition-colors hover:border-[#f6be00] hover:text-[#f6be00]`}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

function ScanRow({ scan, origin }: { scan: OutreachScanSummary; origin: string }) {
  const chip = statusChip(scan);
  const url = `${origin}/audit/${scan.token}`;

  return (
    <div className="border-t border-[#33332f] px-5 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-semibold text-[#f2efe6]">{scan.domain}</span>
        <span
          className={`${mono} rounded-full border px-2.5 py-0.5 ${chip.className}`}
        >
          {chip.text}
        </span>
        {scan.paid && (
          <span
            className={`${mono} rounded-full border border-[#7fbf9f]/60 px-2.5 py-0.5 text-[#7fbf9f]`}
          >
            Bought the build
          </span>
        )}
        <span className={`${mono} ml-auto text-[#5f5e58]`}>
          {new Date(scan.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      {scan.status === "complete" ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <a
            href={`/audit/${scan.token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-mono text-[12px] text-[#f6be00] underline underline-offset-4"
          >
            {url}
          </a>
          <CopyLink url={url} />
        </div>
      ) : (
        <p className="mt-2 text-[13px] leading-snug text-[#7a786f]">
          {scan.status === "failed"
            ? // The provider's own message. Usually "the site blocks automated
              // readers", which is itself a thing worth saying in the email.
              (scan.error ?? "No reason recorded.")
            : "No link until the scan finishes. Press Run the queued ones."}
        </p>
      )}
    </div>
  );
}

export function OutreachPanel({
  initialScans,
  origin,
}: {
  initialScans: OutreachScanSummary[];
  /** Passed from the server so the copied link is the real public URL. */
  origin: string;
}) {
  const [urls, setUrls] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].value as string);
  const [scans, setScans] = useState(initialScans);
  const [justQueued, setJustQueued] = useState<QueuedScan[] | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const queue = () =>
    start(async () => {
      setError("");
      setNote("");
      setJustQueued(null);
      setRejected([]);

      const response = await queueOutreachScans({ urls, category });
      if (!response.ok) {
        setError(response.error);
        return;
      }

      setScans(response.scans);
      setJustQueued(response.queued);
      setRejected(response.rejected);
      setUrls("");

      const waiting = response.queued.filter(
        (q) => !q.reused && response.ran === 0
      ).length;
      setNote(
        response.ran > 0
          ? `${response.ran} finished. Anything still queued is below.`
          : waiting > 0
            ? "Queued. Give it a minute and press Run the queued ones."
            : "Already had these from the last 24 hours, so nothing was re-scanned."
      );
    });

  const refresh = () =>
    start(async () => {
      setError("");
      const response = await refreshOutreachScans();
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setScans(response.scans);
      setNote(
        response.ran > 0
          ? `${response.ran} finished on that pass.`
          : "Nothing left waiting."
      );
    });

  const stillWaiting = scans.filter(
    (s) => s.status === "queued" || s.status === "running"
  ).length;

  return (
    <>
      <div className="rounded-xl border border-[#33332f] bg-[#232320] p-6 sm:p-8">
        <div>
          <label htmlFor="ob-urls" className={label}>
            Their websites, one per line
          </label>
          <textarea
            id="ob-urls"
            rows={6}
            className={field}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={"joesplumbing.com\nwww.harborlaw.co.uk\nhttps://bellavistadental.com"}
          />
          <p className="mt-2 text-[13px] leading-snug text-[#7a786f]">
            Fifteen at a time. Commas and spaces work as well as line breaks,
            and a domain you scanned in the last 24 hours hands back the link
            you already have instead of scanning it again.
          </p>
        </div>

        <div className="mt-5">
          <label htmlFor="ob-category" className={label}>
            Score them as
          </label>
          <select
            id="ob-category"
            className={field}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.hint}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[13px] leading-snug text-[#7a786f]">
            This picks the check set, so it decides the score. A plumber scored
            as SaaS gets marked down for having no API, which is the fastest way
            to send a prospect a report they can dismiss. One category per batch.
          </p>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={queue}
            disabled={pending || !urls.trim()}
            className="inline-flex items-center justify-center rounded-lg bg-[#f6be00] px-7 py-3.5 font-display text-[15px] font-extrabold uppercase tracking-[0.02em] text-[#08080a] transition-colors hover:bg-[#ffd23d] disabled:opacity-50"
          >
            {pending ? "Scanning…" : "Scan them"}
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={pending}
            className={`${mono} text-[#8a887f] underline underline-offset-4 transition-colors hover:text-[#cfccc2] disabled:opacity-50`}
          >
            {stillWaiting > 0
              ? `Run the queued ones (${stillWaiting})`
              : "Refresh"}
          </button>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-[#7a786f]">
          Scans run while you wait, about twenty seconds each, and a long batch
          hands the rest back queued rather than timing out. Nothing is emailed
          to anyone: the link is yours to send.
        </p>

        {error && (
          <p className="mt-6 rounded-lg border border-[#ff9d7a]/40 bg-[#ff9d7a]/5 px-4 py-3 text-[14px] leading-relaxed text-[#cfccc2]">
            {error}
          </p>
        )}

        {note && !error && (
          <p className="mt-6 text-[14px] leading-relaxed text-[#a8a599]">{note}</p>
        )}

        {rejected.length > 0 && (
          <ul className="mt-4 space-y-1">
            {rejected.map((line) => (
              <li key={line} className="text-[13px] leading-snug text-[#ff9d7a]">
                {line}
              </li>
            ))}
          </ul>
        )}

        {justQueued && justQueued.length > 0 && (
          <div className="mt-6 rounded-lg border-2 border-[#f6be00]/40 bg-[#1b1b1b] px-5 py-4">
            <p className={`${mono} text-[#f6be00]`}>Just queued</p>
            <ul className="mt-3 space-y-1.5">
              {justQueued.map((q) => (
                <li key={q.token} className="text-[13px] text-[#a8a599]">
                  <span className="font-semibold text-[#f2efe6]">{q.domain}</span>
                  {q.reused && " — reused the scan from the last 24 hours"}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] leading-snug text-[#7a786f]">
              Links are in the list below, once each one finishes.
            </p>
          </div>
        )}
      </div>

      <h2 className={`${mono} mt-10 mb-3 text-[#f6be00]`}>
        Prospects scanned
        {scans.length > 0 && (
          <span className="ml-2 normal-case tracking-normal text-[#7a786f]">
            {scans.length} most recent
          </span>
        )}
      </h2>

      {scans.length === 0 ? (
        <p className="rounded-xl border border-[#33332f] bg-[#232320] px-5 py-6 text-[14px] leading-relaxed text-[#7a786f]">
          Nothing yet. Paste some domains above.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#33332f] bg-[#232320]">
          {scans.map((scan) => (
            <ScanRow key={scan.token} scan={scan} origin={origin} />
          ))}
        </div>
      )}
    </>
  );
}
