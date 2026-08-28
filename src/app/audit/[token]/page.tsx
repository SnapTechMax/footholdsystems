import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookKickoff } from "@/components/BookKickoff";
import { BuildOffer } from "@/components/BuildOffer";
import { Eyebrow, Finding, ScoreHeader } from "@/components/ScanReportView";
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
        <Eyebrow>Scan running</Eyebrow>
        <h1 className="mt-5 text-balance font-display text-4xl font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-5xl">
          Still reading {scan.domain}.
        </h1>
        <p className="mt-6 max-w-[46ch] text-[17px] leading-[1.65] text-[var(--muted)]">
          This page updates itself. It usually takes a minute or two. Leave it
          open, or come back to this link later and it will be here.
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
          one of the things we fix.
        </p>
        <p className="mt-6 text-[15px] leading-relaxed text-[var(--dim)]">
          Reply to the email, or write to{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-[var(--muted)] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
          , and we&apos;ll run it by hand.
        </p>
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

      {/* The stranger's actual first question, answered before the score. A
          report that opens with a grade and no explanation of where it came
          from reads as a scare tactic, which is the one thing that would make
          the rest of the page unreadable. */}
      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-7">
        <p className="text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
          <span className="font-semibold text-[var(--text)]">
            You did not ask for this, so here is what it is.{" "}
          </span>
          We run a scan that checks whether AI assistants can read a website
          well enough to recommend it. We ran ours on {report.domain}, and this
          page is the whole result. Nothing is held back and there is nothing to
          pay.
        </p>
        <p className="mt-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
          Every problem below comes with the fix for it. Take the list to
          whoever runs your website. If you would rather we did it, that offer
          is at the bottom, and it is the only thing on this page we are
          selling.
        </p>
      </div>

      <div className="mt-6">
        <ScoreHeader report={report} />
      </div>

      {report.partial && (
        <p className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-5 py-4 text-[14px] leading-relaxed text-[var(--dim)]">
          Some checks didn&apos;t finish on this run, so this report is slightly
          incomplete. Everything shown is accurate.
        </p>
      )}

      {checkoutFailed && (
        <p className="mt-6 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3 text-[14px] leading-relaxed text-[var(--muted)]">
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

      {report.findings.length > 0 ? (
        <>
          <h2 className="mt-14 font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
            What&apos;s wrong
          </h2>
          <p className="mt-4 max-w-[48ch] text-[16px] leading-[1.65] text-[var(--muted)]">
            Worst first, with the fix under each one. Every one of these is
            fixable, and none of them require you to rebuild your website.
          </p>

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
        <div className="mt-14 rounded-xl border border-[var(--accent)]/40 bg-[var(--panel)] p-7 sm:p-10">
          <h2 className="font-display text-3xl font-black uppercase leading-[0.98] text-[var(--text)]">
            Nothing to sell you.
          </h2>
          <p className="mt-5 max-w-[52ch] text-[16px] leading-[1.7] text-[var(--muted)]">
            You passed every check we run, which is genuinely rare and means the
            technical half is already done. Whoever looks after your site knows
            what they are doing. What&apos;s left is whether an AI picks you over
            the competitor down the road, which no scanner can see. That is the
            only thing we would have to talk about, and it is not something to
            pitch on a page you did not ask for.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-7 inline-flex items-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-colors hover:bg-[var(--accent-hot)]"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      )}

      {/* Not a legal unsubscribe link, because there is nothing to unsubscribe
          from: this page has no list behind it and sends nothing on its own. It
          is here because a cold email that offers no way to say stop is the
          kind that gets marked as spam, and the reply goes to a person. */}
      <p className="mt-16 border-t border-[var(--line)] pt-8 text-[14px] leading-relaxed text-[var(--dim)]">
        We ran this on our own initiative and nobody is on a list. If you would
        rather not hear from us again, reply to the email or write to{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-[var(--muted)] underline underline-offset-4"
        >
          {CONTACT_EMAIL}
        </a>{" "}
        and that is the end of it.
      </p>
    </Shell>
  );
}
