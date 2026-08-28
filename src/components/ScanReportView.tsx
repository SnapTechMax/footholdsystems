import type { ReportFinding, ScanReport } from "@/lib/scan/types";

/**
 * The report, rendered. Shared by the two pages that show one.
 *
 * `/scan/<token>` is what a lead reads, with the fixes behind the $49 paywall.
 * `/audit/<token>` is what a cold prospect reads, with nothing behind anything.
 * The score header and the findings are identical on both, and they were about
 * to be identical twice — which is how the score panel on one page ends up
 * explaining a capped grade that the other page still renders as a
 * contradiction.
 *
 * THE PAYWALL SPLIT IS THE CALLER'S JOB, NOT THIS FILE'S. `Finding` takes an
 * `unlocked` flag and a finding whose `fix` is optional, and renders the locked
 * placeholder when it has no fix to show. It never decides whether the reader
 * paid. The page selects the paid text — see `toPublicReport` — and a locked
 * finding simply arrives here without one, so there is nothing in the rendered
 * payload to reveal.
 */

/** The small yellow label above a heading. Used on both report pages. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
      {children}
    </p>
  );
}

/**
 * Stand-in for locked text.
 *
 * Deterministic line lengths from the finding's own id, so the blocks look like
 * real paragraphs of differing length rather than an obviously repeating
 * pattern, and so they do not reflow between renders.
 */
function LockedBlock({ seed }: { seed: string }) {
  const widths = [96, 88, 92, 74];
  const offset = seed.length % widths.length;
  return (
    <div aria-hidden="true" className="mt-3 select-none space-y-2">
      {widths.map((_, i) => (
        <div
          key={i}
          className="h-3 rounded-full bg-[var(--line)] blur-[2px]"
          style={{ width: `${widths[(i + offset) % widths.length]}%` }}
        />
      ))}
    </div>
  );
}

export function ScoreHeader({ report }: { report: ScanReport }) {
  const tone =
    report.grade === "A" || report.grade === "B"
      ? "text-[var(--accent)]"
      : report.grade === "F"
        ? "text-[var(--danger)]"
        : "text-[var(--text)]";

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-7 sm:p-10">
      <Eyebrow>AI visibility score</Eyebrow>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className={`font-display text-6xl font-black leading-none sm:text-7xl ${tone}`}>
          {report.score}
        </span>
        <span className="font-display text-2xl font-bold text-[var(--dim)]">
          / {report.maxScore}
        </span>
        <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--dim)]">
          Grade {report.grade}
        </span>
      </div>
      {/* Says what the score was measured against. A number with no stated
          basis invites the obvious comparison against a raw Ora score, which is
          computed over a different set of checks entirely. */}
      <div className="mt-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dim)]">
          Scored as: {report.categoryLabel}
        </span>
      </div>
      {/* Only rendered when the cap actually moved the letter. A high score
          sitting next to a middling grade reads as a broken scale unless the
          reason is right there. */}
      {report.gradeCappedBecause && (
        <div className="mt-4 flex gap-3 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3">
          <span aria-hidden="true" className="text-[var(--danger)]">
            !
          </span>
          <p className="max-w-[54ch] text-[14px] leading-[1.55] text-[var(--muted)]">
            <span className="font-semibold text-[var(--text)]">
              Your grade is held at {report.grade} despite a score of{" "}
              {report.score}.{" "}
            </span>
            {report.gradeCappedBecause}
          </p>
        </div>
      )}
      <p className="mt-6 max-w-[42ch] font-display text-xl font-extrabold uppercase leading-[1.15] tracking-[-0.01em] text-[var(--text)] sm:text-2xl">
        {report.verdict}
      </p>
      <p className="mt-5 max-w-[54ch] text-[16px] leading-[1.65] text-[var(--muted)] sm:text-[17px]">
        {report.summary}
      </p>
      <div className="mt-7 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--line)] pt-6">
        {[
          { label: "Passed", value: report.totals.passed },
          { label: "Failed", value: report.totals.failed },
          { label: "Warnings", value: report.totals.warnings },
        ].map((s) => (
          <div key={s.label}>
            <p className="font-display text-2xl font-extrabold text-[var(--text)]">
              {s.value}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--dim)]">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Finding({
  finding,
  index,
  unlocked,
}: {
  // Typed as the full finding only when unlocked; the caller passes the
  // stripped shape otherwise, so there is nothing here to leak.
  finding: Omit<ReportFinding, "fix" | "specUrl"> &
    Partial<Pick<ReportFinding, "fix" | "specUrl">>;
  index: number;
  unlocked: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-7">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm font-bold tracking-[0.18em] text-[var(--accent)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        {finding.tier === "required" && (
          <span className="rounded-full border border-[var(--danger)]/60 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--danger)]">
            Critical
          </span>
        )}
      </div>

      <h3 className="mt-3 font-display text-xl font-extrabold uppercase leading-[1.1] tracking-[-0.01em] text-[var(--text)] sm:text-2xl">
        {finding.title}
      </h3>

      <p className="mt-4 text-[15px] leading-[1.6] text-[var(--muted)]">
        <span className="font-semibold text-[var(--text)]">What we found: </span>
        {finding.problem}
      </p>

      <p className="mt-3 max-w-[56ch] text-[16px] leading-[1.65] text-[var(--muted)]">
        {finding.consequence}
      </p>

      {/* Set apart rather than appended. A reader who checks this in their own
          browser and sees a different answer concludes the report is wrong, so
          the explanation has to be impossible to skim past. */}
      {finding.caveat && (
        <p className="mt-4 border-l-2 border-[var(--line)] py-1 pl-4 text-[13px] leading-[1.6] text-[var(--dim)]">
          {finding.caveat}
        </p>
      )}

      <div className="mt-5 border-t border-[var(--line)] pt-5">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          How to fix it
        </p>
        {unlocked && finding.fix ? (
          <>
            <p className="mt-3 max-w-[58ch] text-[16px] leading-[1.7] text-[var(--text)]">
              {finding.fix}
            </p>
            {finding.specUrl && (
              <a
                href={finding.specUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-[14px] text-[var(--accent)] underline underline-offset-4"
              >
                Reference &rarr;
              </a>
            )}
          </>
        ) : (
          <LockedBlock seed={finding.checkId} />
        )}
      </div>
    </div>
  );
}
