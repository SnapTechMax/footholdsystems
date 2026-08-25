/**
 * Types for the Ora agent-readiness API and the report we build from it.
 *
 * Modelled on the live response from `GET https://ora.ai/api/score/{domain}`
 * rather than the prose docs, because the docs describe a `topFixes` array the
 * cached endpoint does not actually return. We derive our own ranking from the
 * checks instead, which works on either shape.
 *
 * Everything from Ora is treated as untrusted input: it is a third-party API
 * whose response shape can change under us, and half of it gets rendered into
 * an email. Fields are optional wherever the API could plausibly omit them, and
 * `parseOraScan` in ora.ts is the only place allowed to assert otherwise.
 */

/** Check outcomes. Note it is "warning", not "warn" — confirmed against live data. */
export type OraCheckStatus = "pass" | "fail" | "warning" | "na" | "error";

/** How much Ora expects you to care. "required" is the floor. */
export type OraCheckTier = "required" | "recommended" | "emerging";

export interface OraCheck {
  id: string;
  name: string;
  description?: string;
  status: OraCheckStatus;
  score: number;
  maxScore: number;
  /** What Ora actually found, e.g. "No /.well-known/ai-catalog.json". */
  details?: string;
  /** Ora's own fix instruction. This is the paid half of our report. */
  recommendation?: string;
  /** Bonus checks never cost points, so they must never be sold as a "problem". */
  bonus?: boolean;
  specUrl?: string;
  maturity?: string;
  tier?: OraCheckTier;
  /** Points recovered by fixing this. Our ranking signal. */
  estScoreGain?: number;
}

export interface OraLayer {
  id: string;
  name: string;
  description?: string;
  checks: OraCheck[];
  score: number;
  maxScore: number;
}

export interface OraScan {
  domain: string;
  url: string;
  finalUrl?: string;
  score: number;
  maxScore: number;
  grade: string;
  ctaMessage?: string;
  ctaTier?: string;
  layers: OraLayer[];
  scannedAt?: string;
  durationMs?: number;
  agenticSummary?: string;
  category?: string;
  /** "complete" | "partial" | "stuck". Partial results are still worth sending. */
  analysisStatus?: string;
  pendingChecks?: unknown[];
}

/* ── our report ───────────────────────────────────────────────────────────── */

/**
 * One problem, in the two halves the paywall splits on.
 *
 * `problem` is free: what is wrong and what it costs. `fix` is paid: how to
 * actually do it. They are separate fields rather than one blob precisely so
 * the server can send one without the other — a paywall that ships the answer
 * to the browser and hides it with CSS is not a paywall.
 */
export interface ReportFinding {
  checkId: string;
  /** Plain-English title, rewritten from Ora's engineer-facing check name. */
  title: string;
  /** What we found, in the customer's language. Free. */
  problem: string;
  /** Why it costs them. Free. */
  consequence: string;
  /** How to fix it. PAID — never serialise this to an unpaid client. */
  fix: string;
  /** Points back on the board. */
  pointsBack: number;
  layer: string;
  tier: OraCheckTier;
  /** Ora's spec link, where one exists. Paid, since it is part of the fix. */
  specUrl?: string;
}

import type { BusinessCategory } from "./categories";

/**
 * Report grade. A, B, C, D, F — the American school scale, no E.
 *
 * Distinct from `OraScan.grade`, which is Ora's own letter over its own score
 * (it does use A+ and E) and is not comparable to this one.
 */
export type Grade = "A" | "B" | "C" | "D" | "F";

export interface ScanReport {
  domain: string;
  score: number;
  maxScore: number;
  grade: Grade;
  /**
   * Why the grade is lower than the score alone implies, or null when it isn't.
   *
   * Set when a required check is failing. Without it a reader sees 91/100 next
   * to a B and concludes the grading is broken, which is a worse outcome than
   * the contradiction it was introduced to fix.
   */
  gradeCappedBecause: string | null;
  /** One-line verdict in our voice, not Ora's. */
  verdict: string;
  /** The 2-3 sentence plain-English summary that opens the email. */
  summary: string;
  /** Ranked, worst first. */
  findings: ReportFinding[];
  /** Counts for the "here's the damage" band. */
  totals: {
    passed: number;
    failed: number;
    warnings: number;
    /** Total points recoverable across every finding we surfaced. */
    pointsAvailable: number;
  };
  /** The category the reader picked, which decided the check set. */
  businessCategory: BusinessCategory;
  /** Human label for it, so renderers don't each map the enum themselves. */
  categoryLabel: string;
  /** Ora's own sector guess, where it has one. Usually absent. */
  category?: string;
  scannedAt: string;
  /** True when Ora returned before every check finished. */
  partial: boolean;
}
