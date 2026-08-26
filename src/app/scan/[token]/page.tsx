import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookKickoff } from "@/components/BookKickoff";
import { ScanPoller } from "@/components/ScanPoller";
import { getScanByToken, isPaid } from "@/lib/scan/db";
import {
  DONE_FOR_YOU_PRICE,
  SOLUTIONS_PRICE,
  checkoutUrl,
} from "@/lib/scan/pricing";
import { buildReport, toPublicReport } from "@/lib/scan/report";
import type { ReportFinding, ScanReport } from "@/lib/scan/types";
import { CONTACT_EMAIL, calendlyUrl } from "@/lib/site";

/**
 * The scan report, with the fixes behind a paywall.
 *
 * A server component on purpose. The paid half of the report is selected here
 * and simply never reaches an unpaid browser — the blurred blocks below are
 * generated placeholders, not the real text with a CSS filter over it. A blur
 * you can defeat with devtools is decoration, not a paywall.
 *
 * Access is the token in the URL and nothing else. It is 32 bytes of CSPRNG,
 * which is doing real work here: there is no login, so the link is the
 * credential.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your AI visibility report",
  // Every one of these URLs contains somebody's report. None of them should
  // ever appear in a search result.
  robots: { index: false, follow: false, nocache: true },
};

/* ── shells ───────────────────────────────────────────────────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-[var(--bg)]">
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24">{children}</div>
    </main>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
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
 * pattern — and so they do not reflow between renders.
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

/* ── pieces ───────────────────────────────────────────────────────────────── */

function ScoreHeader({ report }: { report: ScanReport }) {
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
      <div>
      </div>
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

function Finding({
  finding,
  index,
  unlocked,
}: {
  // Typed as the full finding only when unlocked; the caller passes the
  // stripped shape otherwise, so there is nothing here to leak.
  finding: Omit<ReportFinding, "fix" | "specUrl"> & Partial<Pick<ReportFinding, "fix" | "specUrl">>;
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

function Paywall({
  token,
  findingCount,
  failed,
}: {
  token: string;
  findingCount: number;
  /** Set when a checkout attempt just bounced back here. */
  failed: boolean;
}) {
  const pay = checkoutUrl(token, "solutions");

  return (
    <div className="rounded-xl border-2 border-[var(--accent)]/40 bg-[var(--panel)] p-7 sm:p-10">
      <Eyebrow>The fixes</Eyebrow>
      <h2 className="mt-4 text-balance font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
        You know what&apos;s broken. This is how you fix it.
      </h2>

      <div className="mt-6 space-y-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
        <p>
          Everything above is free and it&apos;s yours to keep. The diagnosis is
          the easy half, because a scanner can do that. Knowing what to actually
          change, in what order, without breaking the rankings you already have,
          is the part that took us the time.
        </p>
        <p>
          For {SOLUTIONS_PRICE} you get the exact fix for all{" "}
          {findingCount === 1 ? "one problem" : `${findingCount} problems`} above.
          What to change, where it goes, what to write, and which one to do first.
          Written so you or whoever runs your website can just go and do it.
        </p>
        <p className="font-semibold text-[var(--text)]">
          It reads like a checklist, because that is what it is.
        </p>
      </div>

      {failed && (
        <p className="mt-7 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3 text-[14px] leading-relaxed text-[var(--muted)]">
          <span className="font-semibold text-[var(--text)]">
            That didn&apos;t reach the payment page.{" "}
          </span>
          Nothing was charged. Try again, and if it happens twice email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          and we&apos;ll send you a payment link directly.
        </p>
      )}

      <div className="mt-8">
        <a
          href={pay}
          className="group inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-all duration-150 hover:bg-[var(--accent-hot)] hover:shadow-[0_0_34px_0_rgba(246,190,0,0.35)] sm:w-auto sm:text-lg"
        >
          Unlock the fixes &mdash; {SOLUTIONS_PRICE}
          <span
            aria-hidden="true"
            className="transition-transform duration-150 group-hover:translate-x-1"
          >
            &rarr;
          </span>
        </a>
        <p className="mt-4 text-[14px] leading-relaxed text-[var(--dim)]">
          One payment. Instant access on this page. {SOLUTIONS_PRICE} is less than
          an hour of most people&apos;s billable time, and the answer only has
          room for one name.
        </p>
      </div>
    </div>
  );
}

/**
 * The $1,497 offer, shown only after the fixes are unlocked.
 *
 * Deliberately not on the unpaid page. Someone who has not bought the
 * {SOLUTIONS_PRICE} report has no reason to believe a {DONE_FOR_YOU_PRICE}
 * engagement, and stacking both offers in front of a cold visitor devalues the
 * cheap one.
 */
function DoneForYou({ token, domain }: { token: string; domain: string }) {
  const pay = checkoutUrl(token, "done_for_you");

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--ink)] p-7 sm:p-10">
      <Eyebrow>One more thing</Eyebrow>
      <h2 className="mt-4 text-balance font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
        That list gets you level. It doesn&apos;t get you ahead.
      </h2>

      <div className="mt-6 space-y-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
        <p>
          Be straight with yourself about what you just bought. Every fix above
          is something a scanner can detect, which means every competitor who
          runs the same scan gets the same list. Do all of it and you are level
          with the best-prepared business in your category.
        </p>
        <p>
          Level is a good place to be. It is not the same as being the one that
          gets named.
        </p>
        <p>
          The things that decide that last part are the things no scanner sees.
          Whether your specifics are sharp enough for a model to match you to a
          situation rather than a category. Whether the rest of the web
          corroborates what your site claims. Whether the words on your service
          pages are the words your customers actually use when they describe the
          problem to an assistant. That is judgement, and it is the half we do by
          hand.
        </p>
        <p className="font-semibold text-[var(--text)]">
          {DONE_FOR_YOU_PRICE}. We implement every fix on your list, rewrite{" "}
          {domain} so a model can tell what you are for, and make your existing
          listings agree with each other.
        </p>
        <p>
          Then we build you a second site, on its own domain, separate from this
          one. {domain} has a job already: it has to sell to people, carry your
          brand, look right. All of that pulls against being maximally readable
          to a model, which is why fixing it is always a compromise between two
          audiences.
        </p>
        <p>
          The second domain has one audience. It sits where models go looking,
          structured the way they want, saying what they need in order to
          recommend you, with none of the compromises. It does not have to look
          like anything. It has to be findable and unambiguous.
        </p>
      </div>

      {/* One button. The call used to sit here as the primary action, which
          turned a ready buyer into someone who had to be sold again on a call.
          Scheduling belongs after the payment — see BookKickoff, which is what
          replaces this block once the build is bought. */}
      <div className="mt-8">
        <a
          href={pay}
          className="group inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-all duration-150 hover:bg-[var(--accent-hot)] hover:shadow-[0_0_34px_0_rgba(246,190,0,0.35)] sm:w-auto sm:text-lg"
        >
          Start now &mdash; {DONE_FOR_YOU_PRICE}
          <span
            aria-hidden="true"
            className="transition-transform duration-150 group-hover:translate-x-1"
          >
            &rarr;
          </span>
        </a>
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-[var(--dim)]">
        One payment, then you pick a time with us and we start. Two to three
        weeks from that day, and you keep everything.
      </p>
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */

export default async function ScanReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { token } = await params;
  // Set by /api/go/checkout when Whop could not be reached, so the buyer lands
  // back on the button they pressed rather than on an error page.
  const query = await searchParams;
  const checkoutFailed = query.checkout === "failed";
  const scan = await getScanByToken(token).catch(() => null);

  // Same 404 for a bad token and a missing one. Distinguishing them would let
  // somebody probe for valid tokens.
  if (!scan) notFound();

  if (scan.status === "queued" || scan.status === "running") {
    return (
      <Shell>
        <ScanPoller />
        <Eyebrow>Scan running</Eyebrow>
        <h1 className="mt-5 text-balance font-display text-4xl font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-5xl">
          Still reading {scan.domain}.
        </h1>
        <p className="mt-6 max-w-[46ch] text-[17px] leading-[1.65] text-[var(--muted)]">
          This page updates itself. It usually takes a minute or two, and the
          report lands in your inbox either way, so you don&apos;t have to sit
          here.
        </p>
      </Shell>
    );
  }

  if (scan.status === "failed" || !scan.report) {
    return (
      <Shell>
        <Eyebrow>Something went wrong</Eyebrow>
        <h1 className="mt-5 text-balance font-display text-4xl font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-5xl">
          We couldn&apos;t finish this one.
        </h1>
        <p className="mt-6 max-w-[48ch] text-[17px] leading-[1.65] text-[var(--muted)]">
          The scan on {scan.domain} didn&apos;t complete. That is usually the
          site blocking automated readers, which is itself worth knowing, and is
          one of the things we fix. We&apos;ll retry automatically.
        </p>
        <p className="mt-6 text-[15px] leading-relaxed text-[var(--dim)]">
          If it still hasn&apos;t arrived tomorrow, email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-[var(--muted)] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          and we&apos;ll run it by hand.
        </p>
      </Shell>
    );
  }

  /**
   * Rebuilt from the stored Ora payload rather than read from the stored report.
   *
   * The report JSON is a rendering of the raw scan, and rendering it fresh means
   * a correction to the copy reaches every report ever produced, including ones
   * already sent. That is not theoretical: a wording bug told a customer his
   * business name did not bring up his website when the scan had actually
   * recorded it appearing at position four, and a frozen snapshot would have
   * left that live on his link forever.
   *
   * Falls back to the stored report for any row written before `raw` was kept,
   * and if rebuilding ever throws, because a slightly stale report is a far
   * better outcome than an error page.
   */
  const report = (() => {
    if (!scan.raw) return scan.report;
    try {
      return buildReport(scan.raw, scan.category);
    } catch {
      return scan.report;
    }
  })();
  if (!report) notFound();
  const unlocked = await isPaid(scan.id, "solutions").catch(() => false);

  // The paid text is selected here and nowhere else. When locked, `fix` and
  // `specUrl` are dropped before the finding is handed to a component, so there
  // is nothing in the rendered payload to reveal.
  const findings = unlocked ? report.findings : toPublicReport(report).findings;

  // Read on every visit, not just on the checkout redirect: it decides what the
  // bottom of the page offers, and a build customer coming back a week later
  // should still find their kickoff link rather than the pitch they already
  // bought.
  const boughtBuild = await isPaid(scan.id, "done_for_you").catch(() => false);

  return (
    <Shell>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow>AI visibility report</Eyebrow>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dim)]">
          {new Date(report.scannedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <h1 className="mt-4 font-display text-4xl font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-5xl">
        {report.domain}
      </h1>

      <div className="mt-8">
        <ScoreHeader report={report} />
      </div>

      {report.partial && (
        <p className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-5 py-4 text-[14px] leading-relaxed text-[var(--dim)]">
          Some checks didn&apos;t finish on this run, so this report is slightly
          incomplete. Everything shown is accurate.
        </p>
      )}

      {findings.length > 0 ? (
        <>
          <h2 className="mt-14 font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
            What&apos;s wrong
          </h2>
          <p className="mt-4 max-w-[48ch] text-[16px] leading-[1.65] text-[var(--muted)]">
            Worst first. Every one of these is fixable, and none of them require
            you to rebuild your website.
          </p>

          <div className="mt-8 space-y-5">
            {findings.map((finding, i) => (
              <Finding
                key={finding.checkId}
                finding={finding}
                index={i}
                unlocked={unlocked}
              />
            ))}
          </div>

          <div className="mt-14">
            {/* Three states, cheapest first: nothing bought, list bought, build
                bought. Once the build is paid for there is nothing left to
                sell, so the pitch is replaced by the one thing still
                outstanding — getting a date in the diary. */}
            {boughtBuild ? (
              <BookKickoff domain={report.domain} />
            ) : unlocked ? (
              <DoneForYou token={scan.token} domain={report.domain} />
            ) : (
              <Paywall
                token={scan.token}
                findingCount={findings.length}
                failed={checkoutFailed}
              />
            )}
          </div>
        </>
      ) : (
        <div className="mt-14 rounded-xl border border-[var(--accent)]/40 bg-[var(--panel)] p-7 sm:p-10">
          <h2 className="font-display text-3xl font-black uppercase leading-[0.98] text-[var(--text)]">
            Nothing to sell you.
          </h2>
          <p className="mt-5 max-w-[52ch] text-[16px] leading-[1.7] text-[var(--muted)]">
            You passed every check we run. That is genuinely rare, and it means
            the technical half is done. What&apos;s left is whether an AI
            actually picks you over the competitor down the road, which no scanner
            can see. If you want a human to look at that, book a call.
          </p>
          <a
            href={calendlyUrl("scan-report-clean")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-colors hover:bg-[var(--accent-hot)]"
          >
            Book a call
          </a>
        </div>
      )}
    </Shell>
  );
}
