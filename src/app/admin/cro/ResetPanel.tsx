"use client";

import { useState, useTransition } from "react";
import { resetCroEngine } from "./actions";
import { RESET_CONFIRMATION } from "@/lib/cro/types";
import type { ResetCounts } from "@/lib/cro/types";

/**
 * Wipes the engine's accumulated state.
 *
 * Worth having as a control rather than a one-off script: the measurements the
 * engine holds are measurements *of a page*, so every time the page changes
 * materially they stop describing anything real. That happens again.
 *
 * Two guards, because this cannot be undone: the button does nothing until
 * RESET is typed, and the same check runs again on the server, where it is the
 * one that counts.
 */
export function ResetPanel() {
  const [confirmation, setConfirmation] = useState("");
  const [clearSettings, setClearSettings] = useState(false);
  const [result, setResult] = useState<ResetCounts | null>(null);
  const [error, setError] = useState("");
  const [running, startRunning] = useTransition();

  const armed = confirmation.trim().toUpperCase() === RESET_CONFIRMATION;

  const run = () => {
    startRunning(async () => {
      setError("");
      const response = await resetCroEngine(confirmation.trim().toUpperCase(), {
        clearSettings,
      });
      if (response.ok) {
        setResult(response.counts);
        setConfirmation("");
      } else {
        setError(response.error);
      }
    });
  };

  return (
    <div className="rounded-lg border border-[#5c3a32] bg-[#241d1b] p-5">
      <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-[#ff9d7a]">
        Reset the engine
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-[#cfccc2]">
        Deletes every experiment, all impression and conversion counts, the
        baseline funnel numbers, the Clarity snapshot history and the run log.
        Serving falls back to the copy shipped in{" "}
        <code className="text-[#f6be00]">variants.ts</code>.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[#8a887f]">
        Do this after the page has changed enough that the old numbers describe
        something that no longer exists — they would otherwise become the
        baseline a new test is judged against. The Clarity daily-quota ledger is
        kept, since clearing it would let the engine spend the day&apos;s API
        calls twice over. This cannot be undone.
      </p>

      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={clearSettings}
          onChange={(e) => setClearSettings(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#ff9d7a]"
        />
        <span className="text-sm leading-relaxed text-[#cfccc2]">
          Also reset settings to their defaults
          <span className="block text-xs text-[#8a887f]">
            Interval, conversion source, thresholds and the enabled switch. Leave
            unticked to keep the engine configured as it is now.
          </span>
        </span>
      </label>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={confirmation}
          onChange={(e) => {
            setConfirmation(e.target.value);
            setError("");
          }}
          placeholder={`Type ${RESET_CONFIRMATION} to confirm`}
          aria-label={`Type ${RESET_CONFIRMATION} to confirm the reset`}
          className="w-full rounded-md border border-[#5c3a32] bg-[#1b1b1b] px-3 py-2 font-mono text-sm text-[#f2efe6] placeholder-[#7a5a52] focus:border-[#ff9d7a] focus:outline-none sm:max-w-[16rem]"
        />
        <button
          type="button"
          onClick={run}
          disabled={!armed || running}
          className="rounded-md bg-[#ff9d7a] px-5 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#1b1b1b] transition-colors hover:bg-[#ffb499] disabled:cursor-not-allowed disabled:bg-[#4a3a36] disabled:text-[#8a887f]"
        >
          {running ? "Resetting…" : "Reset everything"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-[#ff9d7a]">{error}</p>}

      {result && (
        <div className="mt-4 rounded-md border border-[#33332f] bg-[#1b1b1b] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7fbf9f]">
            Reset complete
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-[#cfccc2]">
            <li>{result.experiments} experiments</li>
            <li>{result.events} experiment events</li>
            <li>{result.baselineEvents} baseline events</li>
            <li>{result.claritySnapshots} Clarity snapshots</li>
            <li>{result.runs} run log entries</li>
            <li className="text-[#8a887f]">
              settings {result.settingsCleared ? "reset to defaults" : "kept"}
            </li>
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-[#8a887f]">
            Reload to see the dashboard empty. The next scheduled run starts
            gathering again from nothing.
          </p>
        </div>
      )}
    </div>
  );
}
