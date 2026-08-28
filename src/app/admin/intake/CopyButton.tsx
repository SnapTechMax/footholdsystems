"use client";

import { useState } from "react";

/**
 * Puts one submission on the clipboard as markdown.
 *
 * The point of the whole intake is that the answers end up somewhere usable
 * rather than in a database nobody opens, and the shortest route from here to
 * a brief, a prompt or a notes app is a paste. The markdown is rendered on the
 * server and handed down as a prop, so this component holds no opinion about
 * what a submission looks like.
 */
export function CopyButton({ markdown }: { markdown: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(markdown);
          setState("copied");
        } catch {
          // Denied permission, or an insecure origin. Saying so beats a button
          // that looks like it worked.
          setState("failed");
        }
        setTimeout(() => setState("idle"), 2500);
      }}
      className="rounded border border-[#3a3a35] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#cfccc2] transition-colors hover:border-[#f6be00] hover:text-[#f6be00]"
    >
      {state === "copied"
        ? "Copied"
        : state === "failed"
          ? "Copy failed"
          : "Copy as markdown"}
    </button>
  );
}
