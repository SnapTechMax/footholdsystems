"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refreshes the report page while a scan is still running.
 *
 * Server-side refresh rather than a client fetch, so the page keeps rendering
 * from the database and the paywall logic stays in one place — a client poller
 * that fetched the report as JSON would need its own copy of the paid/unpaid
 * decision, which is exactly the duplication that eventually leaks the answer.
 *
 * Gives up after a few minutes. A scan that has not finished by then is stuck,
 * and the sweeper is what recovers it; polling forever just burns the visitor's
 * battery while they watch a spinner.
 */
export function ScanPoller({ intervalMs = 10_000, maxAttempts = 24 }) {
  const router = useRouter();

  useEffect(() => {
    let attempts = 0;
    const id = setInterval(() => {
      attempts += 1;
      if (attempts > maxAttempts) {
        clearInterval(id);
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs, maxAttempts]);

  return null;
}
