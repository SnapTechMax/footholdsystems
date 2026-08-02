// Shared shapes for the CRO engine.

/** Which fields of a sales page an experiment is allowed to change. */
export interface VariantContent {
  /** Headline above the capture form. */
  captureHeading?: string;
  /** Supporting line under that headline. */
  captureSubcopy?: string;
  /** Submit button label. */
  submitLabel?: string;
  /** Hero button label. */
  heroCtaLabel?: string;
  /** Put a second capture form high on the page, above the ladder. */
  formAboveFold?: boolean;
}

export type ExperimentStatus =
  | "running"
  | "concluded"
  | "rolled_back"
  | "abandoned";

export type VariantKey = "a" | "b";

export interface Experiment {
  id: number;
  pagePath: string;
  /** Plain-English reason this test exists, shown in the UI. */
  hypothesis: string;
  /** Which Clarity signal triggered it. */
  trigger: string;
  status: ExperimentStatus;
  /** Control — what was already winning. */
  variantA: VariantContent;
  /** Challenger. */
  variantB: VariantContent;
  winner: VariantKey | null;
  /** Why the engine concluded what it did. */
  decision: string | null;
  createdAt: string;
  concludedAt: string | null;
}

/** Impressions and conversions for one arm of a test. */
export interface ArmTotals {
  impressions: number;
  conversions: number;
}

export interface ExperimentTotals {
  a: ArmTotals;
  b: ArmTotals;
}

/** Where conversion counts are read from when deciding a winner. */
export type ConversionSource = "meta" | "internal";

export interface Settings {
  /** How often the engine is allowed to act, in hours. */
  intervalHours: number;
  /** Master switch. Off means the tick does nothing. */
  enabled: boolean;
  /** Page the engine optimises. */
  pagePath: string;
  /** Which numbers decide a winner. */
  conversionSource: ConversionSource;
  /** Minimum impressions per arm before a winner can be called. */
  minImpressionsPerArm: number;
  /** Two-sided significance threshold. */
  significanceLevel: number;
  /** Auto-revert a challenger this much worse, relatively, before significance. */
  rollbackDropPct: number;
  lastRunAt: string | null;
}

/** One row of the Clarity export, flattened to what the rules care about. */
export interface ClaritySignals {
  capturedAt: string;
  pagePath: string;
  sessions: number;
  /** Average scroll depth, 0-100. */
  scrollDepth: number | null;
  /** Average engagement time in seconds. */
  engagementTime: number | null;
  deadClicks: number;
  rageClicks: number;
  quickbacks: number;
  errorClicks: number;
  scriptErrors: number;
  excessiveScroll: number;
}

export interface RunLog {
  id: number;
  startedAt: string;
  status: "ok" | "skipped" | "error";
  /** Human-readable list of what happened, newest run shown in the UI. */
  actions: string[];
  error: string | null;
}
