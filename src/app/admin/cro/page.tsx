import type { Metadata } from "next";
import {
  DATABASE_CONFIGURED,
  DATABASE_HINT,
  DEFAULT_SETTINGS,
  connectionVarName,
  getBaselineTotals,
  getSettings,
  getTotals,
  initSchema,
  listClaritySnapshots,
  listExperiments,
  listRuns,
} from "@/lib/cro/db";
import { CLARITY_CONFIGURED } from "@/lib/cro/clarity";
import { META_CONFIGURED } from "@/lib/cro/meta";
import { compare, requiredSamplePerArm, verdict } from "@/lib/cro/stats";
import type { Experiment, ExperimentTotals } from "@/lib/cro/types";
import { AdminNav } from "@/components/AdminNav";
import { SettingsPanel } from "./SettingsPanel";
import { ResetPanel } from "./ResetPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "CRO",
  robots: { index: false, follow: false },
};

const mono = "font-mono text-[10px] uppercase tracking-[0.14em]";

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function Missing({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-[#5c4a1f] bg-[#2a2413] p-4">
      <p className={`${mono} text-[#f6be00]`}>Not configured yet</p>
      <ul className="mt-2 space-y-1 text-sm text-[#cfccc2]">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function ExperimentCard({
  experiment,
  totals,
  settings,
}: {
  experiment: Experiment;
  totals: ExperimentTotals | null;
  settings: { minImpressionsPerArm: number; significanceLevel: number; rollbackDropPct: number };
}) {
  const stats = totals ? compare(totals) : null;
  const state = totals ? verdict(totals, settings) : null;

  const diff = Object.keys(experiment.variantB).filter(
    (key) =>
      JSON.stringify(
        (experiment.variantB as Record<string, unknown>)[key]
      ) !==
      JSON.stringify((experiment.variantA as Record<string, unknown>)[key])
  );

  const badge =
    experiment.status === "running"
      ? "bg-[#f6be00] text-[#1b1b1b]"
      : experiment.status === "concluded"
        ? "bg-[#2f6f4f] text-[#f2efe6]"
        : "bg-[#7a3b3b] text-[#f2efe6]";

  return (
    <div className="rounded-lg border border-[#33332f] bg-[#232320] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${badge}`}>
          {experiment.status.replace("_", " ")}
        </span>
        <span className={`${mono} text-[#8a887f]`}>
          #{experiment.id} · {experiment.pagePath} ·{" "}
          {new Date(experiment.createdAt).toLocaleDateString()}
        </span>
        {experiment.winner && (
          <span className={`${mono} text-[#f6be00]`}>
            winner: {experiment.winner.toUpperCase()}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[#e6e3d9]">
        {experiment.hypothesis}
      </p>
      <p className="mt-1.5 text-xs text-[#7a786f]">Triggered by: {experiment.trigger}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(["a", "b"] as const).map((key) => {
          const arm = totals?.[key];
          const content = key === "a" ? experiment.variantA : experiment.variantB;
          const rate = arm && arm.impressions > 0 ? arm.conversions / arm.impressions : null;
          return (
            <div key={key} className="rounded border border-[#3a3a37] p-3">
              <p className={`${mono} text-[#8a887f]`}>
                Variant {key.toUpperCase()} {key === "a" ? "(control)" : "(challenger)"}
              </p>
              <div className="mt-2 space-y-1">
                {diff.map((k) => (
                  <p key={k} className="text-xs text-[#cfccc2]">
                    <span className="text-[#7a786f]">{k}: </span>
                    {String((content as Record<string, unknown>)[k])}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-lg font-bold text-[#f2efe6]">
                {rate !== null ? pct(rate) : "—"}
              </p>
              <p className="text-xs text-[#7a786f]">
                {arm ? `${arm.conversions} of ${arm.impressions}` : "no data"}
              </p>
            </div>
          );
        })}
      </div>

      {stats && stats.pValue !== null && (
        <p className="mt-3 text-xs text-[#8a887f]">
          lift {stats.liftPct !== null ? `${stats.liftPct >= 0 ? "+" : ""}${stats.liftPct.toFixed(1)}%` : "—"} · p={stats.pValue.toFixed(4)}
        </p>
      )}

      <p className="mt-3 rounded bg-[#1b1b1b] p-3 text-xs leading-relaxed text-[#cfccc2]">
        {experiment.decision ?? state?.reason ?? "Awaiting first data."}
      </p>
    </div>
  );
}

export default async function CroDashboard() {
  const missing: string[] = [];
  if (!DATABASE_CONFIGURED) missing.push(DATABASE_HINT);
  if (!CLARITY_CONFIGURED()) missing.push("CLARITY_API_TOKEN — no Clarity signals, so no new experiments.");
  if (!META_CONFIGURED()) missing.push("META_ACCESS_TOKEN / META_PIXEL_ID — falls back to server-side conversion counts.");
  if (!process.env.CRON_SECRET) missing.push("CRON_SECRET — the scheduled run cannot be triggered.");

  if (!DATABASE_CONFIGURED) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-black uppercase tracking-tight text-[#f2efe6]">
          CRO
        </h1>
        <p className="mt-4 text-sm text-[#cfccc2]">
          Waiting on configuration before anything can run.
        </p>
        <div className="mt-6">
          <Missing items={missing} />
        </div>
      </main>
    );
  }

  let settings, experiments, snapshots, runs;
  let baseline = { impressions: 0, conversions: 0 };
  try {
    await initSchema();
    [settings, experiments, snapshots, runs] = await Promise.all([
      getSettings(),
      listExperiments(25),
      listClaritySnapshots(5),
      listRuns(10),
    ]);
    baseline = await getBaselineTotals(settings.pagePath);
  } catch (error) {
    // A connection string that's present but wrong is the likeliest cause, and
    // a blank 500 is useless exactly when you're trying to work out why.
    return (
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-3xl font-black uppercase tracking-tight text-[#f2efe6]">
          CRO
        </h1>
        <p className="mt-4 text-sm text-[#cfccc2]">
          Connected via{" "}
          <code className="text-[#f6be00]">{connectionVarName()}</code>, but the
          database could not be reached.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-[#5c2020] bg-[#2a1313] p-4 text-xs text-[#ff9d7a]">
          {error instanceof Error ? error.message : String(error)}
        </pre>
        <p className="mt-4 text-xs text-[#7a786f]">
          The live site is unaffected — /guide falls back to its shipped copy
          whenever the optimiser is unavailable.
        </p>
      </main>
    );
  }

  const totalsById = new Map<number, ExperimentTotals>();
  for (const experiment of experiments.slice(0, 10)) {
    totalsById.set(experiment.id, await getTotals(experiment.id));
  }

  const latest = snapshots[0];
  const running = experiments.find((e) => e.status === "running") ?? null;
  const runningTotals = running ? totalsById.get(running.id) : null;

  // Honest estimate of how long the current test needs.
  const baselineRate =
    runningTotals && runningTotals.a.impressions > 0
      ? runningTotals.a.conversions / runningTotals.a.impressions
      : 0.1;
  const needed = requiredSamplePerArm(baselineRate || 0.1, 30);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-black uppercase tracking-tight text-[#f2efe6]">
          CRO
        </h1>
        <p className={`${mono} text-[#8a887f]`}>
          db via {connectionVarName() ?? "—"} · last run{" "}
          {settings.lastRunAt
            ? new Date(settings.lastRunAt).toLocaleString()
            : "never"}
        </p>
      </div>

      <AdminNav current="/admin/cro" />

      <div className="space-y-6">
        <Missing items={missing} />

        {/* The control condition. Written only while no experiment is running,
            so it stands still for the length of a test — see the note below. */}
        <div className="rounded-lg border border-[#33332f] bg-[#232320] p-5">
          <h2 className={`${mono} text-[#f6be00]`}>
            {running
              ? `Baseline · paused while experiment #${running.id} runs`
              : "Baseline · live, counting now"}
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              ["Guide views", baseline.impressions.toLocaleString()],
              ["Downloads", baseline.conversions.toLocaleString()],
              [
                "Conversion rate",
                baseline.impressions > 0
                  ? pct(baseline.conversions / baseline.impressions)
                  : "—",
              ],
            ].map(([name, value]) => (
              <div key={name} className="rounded border border-[#3a3a37] p-3">
                <p className={`${mono} text-[#7a786f]`}>{name}</p>
                <p className="mt-1 text-xl font-bold text-[#f2efe6]">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#7a786f]">
            The control these experiments are judged against: the shipped page,
            measured while nothing is being tested. Counted on our own server, so
            unaffected by ad blockers, and deduplicated per visitor, so a reload
            doesn&apos;t count twice.
          </p>
          {running ? (
            <p className="mt-2 text-xs leading-relaxed text-[#cfccc2]">
              <span className="text-[#f6be00]">These figures are standing still.</span>{" "}
              Visits during an experiment are recorded against its arms instead,
              so nothing lands here until #{running.id} concludes. Today&apos;s
              traffic is in the per-arm totals below. This is also why the number
              here can sit below the funnel on the overview, which counts both.
            </p>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-[#7a786f]">
              Updating on every visit, unlike the Clarity figures below.
            </p>
          )}
        </div>

        {/* Clarity snapshot */}
        <div className="rounded-lg border border-[#33332f] bg-[#232320] p-5">
          <h2 className={`${mono} text-[#f6be00]`}>
            Clarity signals · snapshot from the last run
          </h2>
          {latest ? (
            <>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Sessions", latest.sessions],
                  ["Scroll depth", latest.scrollDepth !== null ? `${latest.scrollDepth.toFixed(0)}%` : "—"],
                  ["Engagement", latest.engagementTime !== null ? `${latest.engagementTime.toFixed(0)}s` : "—"],
                  ["Rage clicks", latest.rageClicks],
                  ["Dead clicks", latest.deadClicks],
                  ["Quickbacks", latest.quickbacks],
                  ["Error clicks", latest.errorClicks],
                  ["Script errors", latest.scriptErrors],
                ].map(([name, value]) => (
                  <div key={String(name)} className="rounded border border-[#3a3a37] p-3">
                    <p className={`${mono} text-[#7a786f]`}>{name}</p>
                    <p className="mt-1 text-xl font-bold text-[#f2efe6]">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[#7a786f]">
                Captured {new Date(latest.capturedAt).toLocaleString()} · 3-day window ·
                Clarity allows 10 API calls per day
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-[#8a887f]">
              No snapshot yet. The first scheduled run will fetch one.
            </p>
          )}
        </div>

        {/* Reality check on test duration */}
        {needed && (
          <div className="rounded-lg border border-[#33332f] bg-[#1b1b1b] p-4">
            <p className="text-xs leading-relaxed text-[#cfccc2]">
              At a {pct(baselineRate || 0.1)} baseline, detecting a 30% improvement needs
              about <strong className="text-[#f6be00]">{needed.toLocaleString()}</strong>{" "}
              impressions per arm ({(needed * 2).toLocaleString()} visitors total).
              {latest && latest.sessions > 0 && (
                <>
                  {" "}
                  At {latest.sessions} sessions per 3 days, that is roughly{" "}
                  <strong className="text-[#f6be00]">
                    {Math.ceil((needed * 2) / (latest.sessions / 3) / 7)}
                  </strong>{" "}
                  weeks. Smaller improvements take far longer.
                </>
              )}
            </p>
          </div>
        )}

        <SettingsPanel initial={{ ...DEFAULT_SETTINGS, ...settings }} />

        {/* Experiments */}
        <div>
          <h2 className={`${mono} mb-3 text-[#f6be00]`}>
            Experiments {running ? "· 1 running" : "· none running"}
          </h2>
          <div className="space-y-4">
            {experiments.length === 0 && (
              <p className="rounded-lg border border-[#33332f] bg-[#232320] p-5 text-sm text-[#8a887f]">
                No experiments yet. One will start on the first run that finds enough
                Clarity data.
              </p>
            )}
            {experiments.map((experiment) => (
              <ExperimentCard
                key={experiment.id}
                experiment={experiment}
                totals={totalsById.get(experiment.id) ?? null}
                settings={settings}
              />
            ))}
          </div>
        </div>

        {/* Run log */}
        <div>
          <h2 className={`${mono} mb-3 text-[#f6be00]`}>Run log</h2>
          <div className="space-y-2">
            {runs.length === 0 && (
              <p className="rounded-lg border border-[#33332f] bg-[#232320] p-4 text-sm text-[#8a887f]">
                The engine has not run yet.
              </p>
            )}
            {runs.map((run) => (
              <div
                key={run.id}
                className="rounded-lg border border-[#33332f] bg-[#232320] p-4"
              >
                <p className={`${mono} text-[#8a887f]`}>
                  {new Date(run.startedAt).toLocaleString()} ·{" "}
                  <span
                    className={
                      run.status === "error"
                        ? "text-[#ff9d7a]"
                        : run.status === "skipped"
                          ? "text-[#8a887f]"
                          : "text-[#7fbf9f]"
                    }
                  >
                    {run.status}
                  </span>
                </p>
                <ul className="mt-2 space-y-1">
                  {run.actions.map((action, i) => (
                    <li key={i} className="text-xs leading-relaxed text-[#cfccc2]">
                      • {action}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Last on the page on purpose: it destroys production data, so it
            should be somewhere you arrive at deliberately rather than land on
            while reaching for the settings form. */}
        <ResetPanel />
      </div>
    </main>
  );
}
