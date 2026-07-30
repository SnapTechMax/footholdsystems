"use client";

import { useEffect, useRef } from "react";

/**
 * Registers that this visitor saw a variant.
 *
 * Runs in the browser so the page render isn't blocked on a write, and so
 * fetches that never run JavaScript don't inflate the denominator. Silent by
 * design — a tracking failure must never be visible to a visitor.
 */
export function CroTracker({
  experimentId,
  variant,
  visitorId,
}: {
  experimentId: number;
  variant: "a" | "b";
  visitorId: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    fetch("/api/cro/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experimentId, variant, visitorId }),
      keepalive: true,
    }).catch(() => {
      /* never surface analytics failures */
    });
  }, [experimentId, variant, visitorId]);

  return null;
}
