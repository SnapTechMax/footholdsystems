/**
 * The scan payload and the report built from it.
 *
 * The payload shape — four layers of checks, each with a status, a score out
 * of a maximum, a tier and a details string — is the one Ora's API returned
 * while it ran the scans. It was kept when the scanner moved in-house
 * (lib/scan/scanner) so that every row stored before the switch is still a
 * valid payload and rebuilds into the same report. Fields are optional
 * wherever an older row could plausibly lack them.
 */

/** Check outcomes. Note it is "warning", not "warn". */
export type CheckStatus = "pass" | "fail" | "warning" | "na" | "error";

/** How much the reader is expected to care. "required" is the floor. */
export type CheckTier = "required" | "recommended" | "emerging";

export interface ScanCheck {
  id: string;
  name: string;
  description?: string;
  status: CheckStatus;
  score: number;
  maxScore: number;
  /** What the check actually found, e.g. "No /llms.txt found". Quoted in the free half of a finding. */
  details?: string;
  /** Bonus checks never cost points, so they must never be sold as a "problem". */
  bonus?: boolean;
  specUrl?: string;
  maturity?: string;
  tier?: CheckTier;
  /** Points recovered by fixing this. Our ranking signal. */
  estScoreGain?: number;
}

export interface ScanLayer {
  id: string;
  name: string;
  description?: string;
  checks: ScanCheck[];
  score: number;
  maxScore: number;
}

export interface ScanPayload {
  domain: string;
  url: string;
  finalUrl?: string;
  /** Raw score over every check that ran. Informational: report.ts rescores over the category's subset. */
  score: number;
  maxScore: number;
  grade: string;
  layers: ScanLayer[];
  scannedAt?: string;
  durationMs?: number;
  /** "complete" | "partial" | "stuck". Partial results are still worth sending. */
  analysisStatus?: string;
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
  /** Plain-English title, rewritten from the check's engineer-facing name. */
  title: string;
  /** What we found, in the customer's language. Free. */
  problem: string;
  /** Why it costs them. Free. */
  consequence: string;
  /**
   * How the result was measured, where that changes how it should be read.
   *
   * Free, deliberately. It qualifies a claim made in the free half, so putting
   * it behind the paywall would mean charging someone to find out that the
   * thing we alarmed them with was measured differently from how they would
   * check it.
   */
  caveat?: string;
  /** How to fix it. PAID — never serialise this to an unpaid client. */
  fix: string;
  /** Points back on the board. */
  pointsBack: number;
  layer: string;
  tier: CheckTier;
  /** The check's spec link, where one exists. Paid, since it is part of the fix. */
  specUrl?: string;
}

import type { BusinessCategory } from "./categories";

/**
 * Report grade. A, B, C, D, F — the American school scale, no E.
 *
 * Distinct from `ScanPayload.grade`, which is the scanner's letter over its raw
 * score across every check (it uses A+) and is not comparable to this one.
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
  /** One-line verdict in our voice. */
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
  scannedAt: string;
  /** True when the payload was stored before every check finished. */
  partial: boolean;
}
