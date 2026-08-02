"use client";

import { useState, useTransition } from "react";
import { updateSettings } from "./actions";
import type { Settings } from "@/lib/cro/types";

const field =
  "w-full rounded-md border border-[#3a3a37] bg-[#1b1b1b] px-3 py-2 text-sm text-[#f2efe6] focus:border-[#f6be00] focus:outline-none";
const label =
  "block font-mono text-[10px] uppercase tracking-[0.14em] text-[#8a887f]";

export function SettingsPanel({ initial }: { initial: Settings }) {
  const [settings, setSettings] = useState(initial);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [saving, startSaving] = useTransition();

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setState("idle");
  };

  const save = () => {
    startSaving(async () => {
      const result = await updateSettings(settings);
      if (result.ok) {
        setSettings(result.settings);
        setState("saved");
        setMessage("Saved. Values are clamped to safe ranges on the server.");
      } else {
        setState("error");
        setMessage(result.error);
      }
    });
  };

  return (
    <div className="rounded-lg border border-[#33332f] bg-[#232320] p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-[0.16em] text-[#f6be00]">
          Settings
        </h2>
        <label className="flex items-center gap-2 text-sm text-[#cfccc2]">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
            className="h-4 w-4 accent-[#f6be00]"
          />
          Engine enabled
        </label>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <span className={label}>Run every (hours)</span>
          <input
            type="number"
            min={3}
            max={720}
            value={settings.intervalHours}
            onChange={(e) => update("intervalHours", Number(e.target.value))}
            className={`${field} mt-1.5`}
          />
          <p className="mt-1 text-[11px] text-[#7a786f]">
            Cron fires every 3 hours via GitHub Actions, plus once daily from
            Vercel. This is the minimum gap between actions; each run spends one
            of Clarity&apos;s 10 daily calls, so 3 is the floor.
          </p>
        </div>

        <div>
          <span className={label}>Page</span>
          <input
            type="text"
            value={settings.pagePath}
            onChange={(e) => update("pagePath", e.target.value)}
            className={`${field} mt-1.5`}
          />
        </div>

        <div>
          <span className={label}>Conversion source</span>
          <select
            value={settings.conversionSource}
            onChange={(e) =>
              update("conversionSource", e.target.value as Settings["conversionSource"])
            }
            className={`${field} mt-1.5`}
          >
            <option value="meta">Meta Pixel</option>
            <option value="internal">Server-side (exact)</option>
          </select>
          <p className="mt-1 text-[11px] text-[#7a786f]">
            Meta undercounts by whatever ad blockers strip.
          </p>
        </div>

        <div>
          <span className={label}>Min impressions per arm</span>
          <input
            type="number"
            min={100}
            value={settings.minImpressionsPerArm}
            onChange={(e) => update("minImpressionsPerArm", Number(e.target.value))}
            className={`${field} mt-1.5`}
          />
          <p className="mt-1 text-[11px] text-[#7a786f]">
            Below this, no winner is ever called.
          </p>
        </div>

        <div>
          <span className={label}>Significance level</span>
          <input
            type="number"
            step={0.01}
            min={0.01}
            max={0.2}
            value={settings.significanceLevel}
            onChange={(e) => update("significanceLevel", Number(e.target.value))}
            className={`${field} mt-1.5`}
          />
        </div>

        <div>
          <span className={label}>Auto-revert if worse by (%)</span>
          <input
            type="number"
            min={10}
            max={90}
            value={settings.rollbackDropPct}
            onChange={(e) => update("rollbackDropPct", Number(e.target.value))}
            className={`${field} mt-1.5`}
          />
          <p className="mt-1 text-[11px] text-[#7a786f]">
            Bails out early on a clearly losing variant.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-[#f6be00] px-5 py-2 text-sm font-bold text-[#1b1b1b] transition-colors hover:bg-[#ffd23d] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {message && (
          <span
            className={`text-xs ${state === "error" ? "text-[#ff9d7a]" : "text-[#8a887f]"}`}
          >
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
