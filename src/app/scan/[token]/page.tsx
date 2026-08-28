import type { Metadata } from "next";
import { after } from "next/server";
import { notFound, redirect } from "next/navigation";
import { BookKickoff } from "@/components/BookKickoff";
import { BuildOffer } from "@/components/BuildOffer";
import { BuyButton } from "@/components/BuyButton";
import { ReportOpenedPixel } from "@/components/ReportOpenedPixel";
import { Eyebrow, Finding, ScoreHeader } from "@/components/ScanReportView";
import { ScanPoller } from "@/components/ScanPoller";
import { getScanByToken, isPaid, markReportOpened } from "@/lib/scan/db";
import { sendReportOpened } from "@/lib/meta-capi";
import { SOLUTIONS_PRICE, checkoutUrl, reportUrl } from "@/lib/scan/pricing";
import { buildReport, toPublicReport } from "@/lib/scan/report";
import { CONTACT_EMAIL } from "@/lib/site";

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

/* ── pieces ───────────────────────────────────────────────────────────────── */

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
        <BuyButton
          token={token}
          product="solutions"
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
        </BuyButton>
        <p className="mt-4 text-[14px] leading-relaxed text-[var(--dim)]">
          One payment. Instant access on this page. {SOLUTIONS_PRICE} is less than
          an hour of most people&apos;s billable time, and the answer only has
          room for one name.
        </p>
      </div>
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

  /**
   * An outreach scan is read somewhere else, so send them there.
   *
   * Nothing links here with one of those tokens, but two things can produce
   * one: an admin copying a link out of habit, and /api/go/checkout, which
   * bounces a failed checkout back to `reportUrl` for every product. Rendering
   * it here would show a cold prospect the $49 paywall over fixes the email
   * they clicked promised them for nothing, which is the worst possible first
   * impression of a business selling clarity. The query is carried across so
   * the checkout=failed notice survives the hop.
   */
  if (scan.outreach) {
    redirect(
      `/audit/${scan.token}${checkoutFailed ? "?checkout=failed" : ""}`
    );
  }

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

  /**
   * Claim the first read of this report, and report it as a conversion.
   *
   * The strongest quality signal this funnel produces. Lead means somebody
   * typed an email into a form on a cold ad; this means they opened the email,
   * followed the link and looked at the answer. Those two populations are not
   * the same, and the second is the one worth buying more of — which is the
   * whole reason it is a standard `ViewContent` rather than a custom event, so
   * it can be selected as an ad set's optimisation event without wrapping it in
   * a custom conversion first.
   *
   * Only once, decided by the database rather than the browser: `markReportOpened`
   * is a conditional UPDATE and returns true for exactly one caller, so two tabs
   * opened at once produce one event and a re-read next week produces none.
   *
   * Only when there is something to read. A visitor who lands here while the
   * scan is still running gets the poller, not a report, and counting that as a
   * read would teach delivery that the signal is cheaper to produce than it is.
   * `report` is non-null past the notFound above, so this is really asking
   * whether the scan finished.
   *
   * Failure is swallowed on purpose. This is a marketing event on the critical
   * path of the page a paying customer came to read, and there is no version of
   * a Meta outage that should cost somebody their report.
   */
  const openedNow =
    scan.status === "complete"
      ? await markReportOpened(scan.id).catch(() => false)
      : false;

  if (openedNow) {
    after(async () => {
      try {
        await sendReportOpened({
          token: scan.token,
          email: scan.email,
          // Stored on the lead at scan time. The request that got here usually
          // came from an email link on another device and carries no Meta
          // cookies of its own — see the columns' note in db.ts.
          fbp: scan.fbp,
          fbc: scan.fbc,
          sourceUrl: reportUrl(scan.token),
          category: scan.category,
          score: report.score,
        });
      } catch (error) {
        console.error("[report] ViewContent not sent:", error);
      }
    });
  }

  return (
    <Shell>
      {/* The browser half, sharing the event id above so Meta collapses the
          pair. Rendered only on the request that won the claim. */}
      <ReportOpenedPixel
        token={scan.token}
        category={scan.category}
        score={report.score}
        fire={openedNow}
      />
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
              <BuildOffer
                token={scan.token}
                domain={report.domain}
                findingCount={findings.length}
              />
            ) : (
              <>
                <Paywall
                  token={scan.token}
                  findingCount={findings.length}
                  failed={checkoutFailed}
                />
                {/* The build, offered to someone who has bought nothing yet.
                    offer.md argued against this on the grounds that stacking
                    both offers devalues the cheap one, which is why this is the
                    brief variant and sits below: the $49 stays the primary
                    action, and this is the door for a reader who would rather
                    hand the whole thing over than work a checklist. */}
                <BuildOffer
                  token={scan.token}
                  domain={report.domain}
                  findingCount={findings.length}
                  variant="brief"
                />
              </>
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
            can see. If you want a human to look at that, email me.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-7 inline-flex items-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-colors hover:bg-[var(--accent-hot)]"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      )}
    </Shell>
  );
}
