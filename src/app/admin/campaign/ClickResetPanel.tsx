"use client";

import { useState, useTransition } from "react";
import { resetClickTracking } from "./actions";
import { CLICK_RESET_CONFIRMATION } from "./constants";

/**
 * Clears recorded clicks on the sequence's booking links.
 *
 * A control rather than a one-off, because the situation recurs: the first
 * clicks these links ever get are the operator's own, checking the redirect
 * works, and they are indistinguishable from real ones the moment they land.
 * Same again after any change to the sequence worth testing by hand.
 *
 * Two guards, since this cannot be undone: the button stays inert until the
 * phrase is typed, and the same check runs on the server, where it is the one
 * that counts.
 */
export function ClickResetPanel() {
  const [confirmation, setConfirmation] = useState("");
  const [removed, setRemoved] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [running, startRunning] = useTransition();

  const armed = confirmation.trim().toUpperCase() === CLICK_RESET_CONFIRMATION;

  const run = () => {
    startRunning(async () => {
      setError("");
      const response = await resetClickTracking(confirmation);
      if (response.ok) {
        setRemoved(response.removed);
        setConfirmation("");
      } else {
        setError(response.error);
      }
    });
  };

  return (
    <div className="mt-10 rounded-lg border border-[#5c3a32] bg-[#241d1b] p-5">
      <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-[#ff9d7a]">
        Reset click tracking
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-[#cfccc2]">
        Sets every <strong>clicked</strong> figure back to zero by deleting the
        recorded clicks on the sequence&apos;s booking links.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[#8a887f]">
        Bookings are left alone — each one has a real Calendly appointment behind
        it, and removing it would misreport a call that actually happened. This
        cannot be undone.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={`Type ${CLICK_RESET_CONFIRMATION}`}
          className="w-full rounded border border-[#3a3a37] bg-[#1b1b1b] px-3 py-2 font-mono text-sm text-[#f2efe6] placeholder-[#6a6963] focus:border-[#ff9d7a] focus:outline-none sm:max-w-[220px]"
        />
        <button
          type="button"
          onClick={run}
          disabled={!armed || running}
          className="rounded bg-[#a4462f] px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#f2efe6] transition-colors hover:bg-[#c25439] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? "Clearing…" : "Clear clicks"}
        </button>
      </div>

      {removed !== null && (
        <p className="mt-3 font-mono text-xs text-[#7fbf9f]">
          Cleared {removed} recorded click{removed === 1 ? "" : "s"}. Every
          per-email clicked figure is now zero.
        </p>
      )}
      {error && <p className="mt-3 font-mono text-xs text-[#ff9d7a]">{error}</p>}
    </div>
  );
}
