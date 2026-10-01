"use client";

import { useState } from "react";

/**
 * Puts one report URL on the clipboard, and says whether it worked.
 *
 * The URL is on screen next to it as well, so a refused clipboard is an
 * inconvenience rather than a dead end.
 */
export function CopyLinkButton({ url }: { url: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setState("copied");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 1600);
      }}
      className="shrink-0 rounded border border-[#3a3a35] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#cfccc2] transition-colors hover:border-[#f6be00] hover:text-[#f6be00]"
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy link"}
    </button>
  );
}
