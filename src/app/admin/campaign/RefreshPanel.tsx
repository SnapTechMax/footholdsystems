"use client";

import { useState, useTransition } from "react";
import { refreshCampaignSnapshotAction } from "./actions";

/**
 * Recomputes the stored snapshot on demand.
 *
 * Sequence progress is read from a snapshot refreshed on a schedule rather than
 * rebuilt on every page load — it costs roughly 53 Resend requests, fifty of
 * them one per run, because step detail is only returned on an individual run.
 * Doing that on load is what made the dashboard take seconds.
 *
 * So the trade is explicit: the page is fast and the numbers are as old as the
 * last run, and this is the way to get current ones when that matters. It is
 * slow by nature, which is the whole reason it is a button.
 */
/**
 * `ageMinutes` is computed on the server and passed in rather than derived from
 * a timestamp here. Reading the clock during render is impure: the server and
 * the client would read it at different moments, produce different text, and
 * hydration would mismatch. The page is force-dynamic, so a server-computed age
 * is fresh on every load anyway.
 */
export function RefreshPanel({ ageMinutes }: { ageMinutes: number }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [running, startRunning] = useTransition();

  const run = () => {
    startRunning(async () => {
      setError("");
      const response = await refreshCampaignSnapshotAction();
      if (response.ok) setDone(true);
      else setError(response.error);
    });
  };

  // After a refresh the snapshot is current by definition, so the age passed in
  // at render time no longer describes it.
  const minutes = done ? 0 : ageMinutes;
  const stale = minutes >= 180;

  const howOld =
    minutes < 1
      ? "just now"
      : minutes < 60
        ? `${minutes} min ago`
        : `${Math.floor(minutes / 60)}h ago`;

  return (
    <div className="mt-10 rounded-lg border border-[#33332f] bg-[#232320] p-5">
      <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-[#7a786f]">
        Sequence snapshot
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#cfccc2]">
        Progress figures were computed <strong>{howOld}</strong> and are read
        from storage, so the page does not wait on Resend. Clicks, opens and
        bookings are read live and are always current.
      </p>
      {stale && (
        <p className="mt-2 text-sm text-[#f6be00]">
          Nothing has refreshed this in over three hours. If that keeps up, the
          scheduled run is not firing — check the campaign-refresh workflow.
        </p>
      )}
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="mt-3 rounded bg-[#f6be00] px-4 py-2 text-sm font-bold text-[#1b1b1b] disabled:opacity-40"
      >
        {running ? "Refreshing…" : "Refresh now"}
      </button>
      <p className="mt-2 text-[11px] text-[#7a786f]">
        Takes a few seconds — it is about 53 requests to Resend.
      </p>
      {done && !error && (
        <p className="mt-2 text-sm text-[#7fbf9f]">Snapshot updated.</p>
      )}
      {error && <p className="mt-2 text-sm text-[#ff9d7a]">{error}</p>}
    </div>
  );
}
