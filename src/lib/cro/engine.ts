import {
  claimClarityCall,
  concludeExperiment,
  createExperiment,
  getBaselineContent,
  getRunningExperiment,
  getSettings,
  getTotals,
  initSchema,
  listExperiments,
  recordRun,
  saveClaritySnapshot,
  saveSettings,
} from "./db";
import {
  CLARITY_DAILY_LIMIT,
  ClarityError,
  extractSignals,
  fetchClarity,
} from "./clarity";
import { META_CONFIGURED, fetchMetaConversions, withMetaConversions } from "./meta";
import { nextHypothesis } from "./rules";
import { verdict } from "./stats";
import { resolveContent } from "./variants";
import type { ClaritySignals, ExperimentTotals, VariantContent } from "./types";

/**
 * One pass of the optimiser.
 *
 * Deliberately unattended — it never waits for approval. What it will not do is
 * act on data too thin to mean anything, because at this traffic level that
 * amounts to rewriting the page at random. Guardrails here are about decision
 * quality, not permission.
 */
export interface TickResult {
  status: "ok" | "skipped" | "error";
  actions: string[];
  error?: string;
}

export async function tick(options: { force?: boolean } = {}): Promise<TickResult> {
  const actions: string[] = [];

  try {
    await initSchema();
    const settings = await getSettings();

    if (!settings.enabled && !options.force) {
      actions.push("Engine is switched off in settings — nothing done.");
      await recordRun("skipped", actions);
      return { status: "skipped", actions };
    }

    // Respect the UI-configured interval. Vercel's cron fires on a fixed
    // schedule, so the interval is enforced here rather than in the cron.
    if (!options.force && settings.lastRunAt) {
      const elapsedHours =
        (Date.now() - new Date(settings.lastRunAt).getTime()) / 3_600_000;
      if (elapsedHours < settings.intervalHours) {
        actions.push(
          `Only ${elapsedHours.toFixed(1)}h since the last run; interval is ${settings.intervalHours}h. Skipping.`
        );
        await recordRun("skipped", actions);
        return { status: "skipped", actions };
      }
    }

    const pagePath = settings.pagePath;

    /* ── 1. pull Clarity ─────────────────────────────────────────────────── */
    let signals: ClaritySignals | null = null;
    try {
      const allowed = await claimClarityCall(CLARITY_DAILY_LIMIT);
      if (!allowed) {
        actions.push(
          `Clarity budget for today is spent (${CLARITY_DAILY_LIMIT}/day). Continuing without fresh data.`
        );
      } else {
        const raw = await fetchClarity(3);
        signals = extractSignals(raw, pagePath);
        await saveClaritySnapshot(signals, raw);
        actions.push(
          `Clarity: ${signals.sessions} sessions, scroll ${signals.scrollDepth?.toFixed(0) ?? "n/a"}%, ` +
            `${signals.rageClicks} rage / ${signals.deadClicks} dead / ${signals.quickbacks} quickback clicks.`
        );
      }
    } catch (error) {
      const message = error instanceof ClarityError ? error.message : String(error);
      actions.push(`Clarity fetch failed: ${message}`);
    }

    /* ── 2. judge whatever is running ────────────────────────────────────── */
    const running = await getRunningExperiment(pagePath);

    if (running) {
      const internal = await getTotals(running.id);
      const { totals, sourceNote } = await resolveTotals(internal, settings.conversionSource, running.createdAt);
      actions.push(sourceNote);

      const decision = verdict(totals, {
        minImpressionsPerArm: settings.minImpressionsPerArm,
        significanceLevel: settings.significanceLevel,
        rollbackDropPct: settings.rollbackDropPct,
      });

      if (decision.kind === "winner") {
        await concludeExperiment(running.id, "concluded", decision.winner, decision.reason);
        actions.push(`Experiment #${running.id} concluded. ${decision.reason}`);
      } else if (decision.kind === "rollback") {
        // The control is already the baseline, so reverting is just recording
        // A as the winner — the next page render picks it up immediately.
        await concludeExperiment(running.id, "rolled_back", "a", decision.reason);
        actions.push(`Experiment #${running.id} rolled back. ${decision.reason}`);
      } else {
        actions.push(`Experiment #${running.id} still running. ${decision.reason}`);
        await saveSettings({ lastRunAt: new Date().toISOString() });
        await recordRun("ok", actions);
        return { status: "ok", actions };
      }
    }

    /* ── 3. start the next test ──────────────────────────────────────────── */
    if (!signals) {
      actions.push("No Clarity data this run, so no new experiment was started.");
      await saveSettings({ lastRunAt: new Date().toISOString() });
      await recordRun("ok", actions);
      return { status: "ok", actions };
    }

    const baseline = await getBaselineContent(pagePath);
    const history = await listExperiments(100);
    const idea = nextHypothesis(signals, baseline, history);

    if (!idea) {
      actions.push(
        signals.sessions < 30
          ? `Only ${signals.sessions} sessions in the window — too few to base a change on. Waiting for traffic.`
          : "No untested change left in the variant library. Add more options to keep testing."
      );
    } else {
      const variantA = resolveContent(baseline);
      const variantB = resolveContent(baseline, idea.changes);
      const created = await createExperiment({
        pagePath,
        hypothesis: idea.hypothesis,
        trigger: idea.trigger,
        variantA,
        variantB,
      });
      actions.push(
        `Started experiment #${created.id}: ${describeChange(idea.changes)} — ${idea.trigger}.`
      );
    }

    await saveSettings({ lastRunAt: new Date().toISOString() });
    await recordRun("ok", actions);
    return { status: "ok", actions };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    actions.push(`Run failed: ${message}`);
    try {
      await recordRun("error", actions, message);
    } catch {
      // Logging the failure failed too; nothing useful left to do.
    }
    return { status: "error", actions, error: message };
  }
}

/**
 * Conversion counts from the configured source.
 *
 * Meta is the default per the brief. If it isn't configured or errors, this
 * falls back to server-side counts and says so rather than silently reporting
 * zero conversions, which the stats layer would read as "the page stopped
 * working".
 */
export async function resolveTotals(
  internal: ExperimentTotals,
  source: string,
  since: string
): Promise<{ totals: ExperimentTotals; sourceNote: string }> {
  if (source !== "meta") {
    return {
      totals: internal,
      sourceNote: `Conversions from server-side records: A ${internal.a.conversions}/${internal.a.impressions}, B ${internal.b.conversions}/${internal.b.impressions}.`,
    };
  }

  if (!META_CONFIGURED()) {
    return {
      totals: internal,
      sourceNote:
        "Conversion source is Meta but META_ACCESS_TOKEN/META_PIXEL_ID are unset — used server-side counts instead.",
    };
  }

  try {
    const sinceUnix = Math.floor(new Date(since).getTime() / 1000);
    const metaCounts = await fetchMetaConversions(sinceUnix);
    if (!metaCounts) {
      return { totals: internal, sourceNote: "Meta returned no data — used server-side counts." };
    }
    const merged = withMetaConversions(internal, metaCounts);
    return {
      totals: merged,
      sourceNote:
        `Conversions from Meta pixel: A ${metaCounts.a}, B ${metaCounts.b} ` +
        `(server-side saw A ${internal.a.conversions}, B ${internal.b.conversions} — ` +
        `the gap is pixel blocking).`,
    };
  } catch (error) {
    return {
      totals: internal,
      sourceNote: `Meta lookup failed (${error instanceof Error ? error.message : String(error)}) — used server-side counts.`,
    };
  }
}

function describeChange(changes: VariantContent): string {
  const entries = Object.entries(changes) as [string, unknown][];
  const keys = entries.map(([key]) => key);
  if (keys.length === 0) return "no change";
  const [key, value] = entries[0];
  if (typeof value === "boolean") return `${key} → ${value}`;
  return `${key} → "${String(value).slice(0, 60)}"`;
}
