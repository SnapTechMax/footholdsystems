import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookKickoff } from "@/components/BookKickoff";
import { BuildOffer } from "@/components/BuildOffer";
import {
  AllPassed,
  CheckoutFailedNotice,
  Eyebrow,
  Finding,
  FindingsIntro,
  PartialNotice,
  ScanFailed,
  ScanRunning,
  ScoreHeader,
} from "@/components/ScanReportView";
import { ScanPoller } from "@/components/ScanPoller";
import { getScanByToken, isPaid } from "@/lib/scan/db";
import { buildReport } from "@/lib/scan/report";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * The audit we ran on somebody who never asked for one.
 *
 * Cold outbound. An admin queues a prospect's domain at /admin/outreach, we
 * scan it, and the link to this page goes out in an email written by hand. The
 * reader arrives with no context at all: no form filled in, no email typed, no
 * memory of us. Everything on this page follows from that.
 *
 * WHAT IS DIFFERENT FROM /scan/<token>, AND WHY
 *
 *  1. Nothing is paywalled. The whole report, fixes included, is free. The $49
 *     list is the thing we are giving away here, because in a cold email the
 *     report is not the product, it is the proof that we did the work before
 *     asking for anything. Selling a stranger a $49 list they did not request
 *     would be a worse business than handing it over and selling the build.
 *  2. No Meta conversions fire. `Lead` and `ViewContent` on the paid funnel
 *     mean somebody typed an address into a form off an ad. Nobody here did,
 *     and reporting these as the same event would teach ad delivery that a
 *     cohort we bought converts at a rate it does not.
 *  3. It says who we are and why this arrived, at the top. A stranger's first
 *     question about an unsolicited report is not "what is my score".
 *
 * Access is still the token and nothing else, and the page is still noindex:
 * this is somebody's site being graded, and it has no business in a search
 * result whether they asked for it or not.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI visibility audit",
  robots: { index: false, follow: false, nocache: true },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-[var(--bg)]">
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24">{children}</div>
    </main>
  );
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { token } = await params;
  // Set by /api/go/checkout when Whop could not be reached, and carried across
  // by the redirect on /scan/<token>, which is where that route bounces every
  // failed checkout back to.
  const checkoutFailed = (await searchParams).checkout === "failed";

  const scan = await getScanByToken(token).catch(() => null);

  // Same 404 for a bad token and a missing one, so this cannot be used to probe
  // for valid ones.
  if (!scan) notFound();

  /**
   * This route serves outreach scans and only outreach scans.
   *
   * It is the entire paywall boundary. Without this check, anybody holding a
   * paying customer's report token could read the $49 fixes for nothing by
   * swapping `/scan/` for `/audit/` in the URL — the token is the same string
   * and the report is the same row. A 404, not a redirect, because a customer's
   * report is not this page's to serve under any circumstances.
   */
  if (!scan.outreach) notFound();

  if (scan.status === "queued" || scan.status === "running") {
    return (
      <Shell>
        <ScanPoller />
        <ScanRunning domain={scan.domain} />
      </Shell>
    );
  }

  if (scan.status === "failed" || !scan.report) {
    return (
      <Shell>
        <ScanFailed domain={scan.domain} />
      </Shell>
    );
  }

  /**
   * Rebuilt from the stored provider payload rather than read from the stored
   * report, for the reason given at length on /scan/<token>: the report JSON is
   * a rendering, and rendering it fresh means a correction to the copy reaches
   * every report ever produced, including links already sent. Falls back to the
   * stored report if anything throws, because slightly stale beats an error
   * page on a link a stranger clicked once.
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

  // A prospect who bought. The pitch has nothing left to say to them, so it is
  // replaced by the one action outstanding, the same as on the paid report.
  const bought = await isPaid(scan.id, "done_for_you").catch(() => false);

  return (
    <Shell>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow>AI visibility audit</Eyebrow>
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

      {/* What the scan is, answered before the score. The reader said yes to
          the report in reply to a cold email, so this does not explain why it
          arrived, only what it measured. A grade with no stated basis reads as
          a scare tactic. */}
      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-7">
        <p className="text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
          We checked whether AI like ChatGPT can read {report.domain}. This is
          the full report, fixes included, free. The fixes are technical, and
          done in the wrong order they can break what already works. Getting
          them right is what we do. That offer is at the bottom.
        </p>
      </div>

      <div className="mt-6">
        <ScoreHeader report={report} />
      </div>

      {report.partial && <PartialNotice />}

      {checkoutFailed && <CheckoutFailedNotice className="mt-6" />}

      {report.findings.length > 0 ? (
        <>
          <FindingsIntro />

          <div className="mt-8 space-y-5">
            {/* `unlocked` is not a decision here, it is a constant. There is no
                paywall on this page, so every finding arrives with its fix and
                the locked placeholder is never rendered. */}
            {report.findings.map((finding, i) => (
              <Finding
                key={finding.checkId}
                finding={finding}
                index={i}
                unlocked
              />
            ))}
          </div>

          <div className="mt-14">
            {bought ? (
              <BookKickoff domain={report.domain} />
            ) : (
              <BuildOffer
                token={scan.token}
                domain={report.domain}
                findingCount={report.findings.length}
                variant="outreach"
              />
            )}
          </div>
        </>
      ) : (
        <AllPassed />
      )}

      {/* Not a legal unsubscribe link, because there is nothing to unsubscribe
          from: this page has no list behind it and sends nothing on its own. It
          is here because a cold email that offers no way to say stop is the
          kind that gets marked as spam, and the reply goes to a person. */}
      <p className="mt-16 border-t border-[var(--line)] pt-8 text-[14px] leading-relaxed text-[var(--dim)]">
        You&apos;re not on any list. To stop hearing from us, reply to the email or write to{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-[var(--muted)] underline underline-offset-4"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </Shell>
  );
}
