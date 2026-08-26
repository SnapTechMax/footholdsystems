import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookKickoff } from "@/components/BookKickoff";
import { BuildOffer } from "@/components/BuildOffer";
import { PurchasePixel } from "@/components/PurchasePixel";
import { ScanPoller } from "@/components/ScanPoller";
import { getScanByToken, isPaid } from "@/lib/scan/db";
import {
  PURCHASE_MARKER,
  SOLUTIONS_PRICE_CENTS,
} from "@/lib/scan/pricing";
import { buildReport } from "@/lib/scan/report";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * Where a buyer lands the moment the {SOLUTIONS_PRICE} payment clears.
 *
 * This is the one page in the funnel that gets a reader at peak commitment:
 * they have just paid, the problem is fresh, and they have not yet started the
 * work. That is the only moment the {DONE_FOR_YOU_PRICE} engagement is an easy
 * yes, so it gets a page rather than a block at the bottom of the report.
 *
 * IT MUST NOT READ AS A BAIT AND SWITCH. They paid for a list, and the link to
 * that list is above the pitch, not below it — someone who ignores this page
 * entirely still got exactly what they bought, in one click, without scrolling
 * past an upsell to find it. An upsell that hides the purchase is how you earn
 * a chargeback, and a chargeback costs more than this page can make.
 *
 * Access is the token, same as the report. No login exists.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "What the list can't do",
  // Carries a scan token and a purchase state. Never a search result.
  robots: { index: false, follow: false, nocache: true },
};

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

export default async function ScanNextPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const scan = await getScanByToken(token).catch(() => null);
  if (!scan) notFound();

  const report = (() => {
    if (!scan.raw) return scan.report;
    try {
      return buildReport(scan.raw, scan.category);
    } catch {
      return scan.report;
    }
  })();
  if (!report) notFound();

  // Whop redirects the buyer here the instant it takes the money, which can be
  // a moment before its webhook reaches us. So a `false` here usually means
  // "not yet", not "never" — the page renders either way and the poller picks
  // the unlock up when it lands, rather than telling somebody who has just paid
  // that they have not.
  const unlocked = await isPaid(scan.id, "solutions").catch(() => false);
  const alreadyBoughtBuild = await isPaid(scan.id, "done_for_you").catch(
    () => false
  );

  const domain = report.domain;
  const findingCount = report.findings.length;

  return (
    <Shell>
      {/* Only while the webhook is in flight. Stops once it lands. */}
      {!unlocked && <ScanPoller intervalMs={3_000} maxAttempts={20} />}

      {/* Rendered only once the payment is recorded, so the conversion cannot
          be produced by visiting this URL with the marker appended. */}
      {unlocked && (
        <PurchasePixel
          token={scan.token}
          product="solutions"
          value={SOLUTIONS_PRICE_CENTS / 100}
          justPurchased={query[PURCHASE_MARKER] === "1"}
        />
      )}

      <Eyebrow>{unlocked ? "Payment received" : "Payment processing"}</Eyebrow>

      <h1 className="mt-5 text-balance font-display text-4xl font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-5xl">
        Your list is ready.
      </h1>

      {/* The thing they paid for, above everything else on the page. */}
      <div className="mt-8 rounded-xl border-2 border-[var(--accent)]/40 bg-[var(--panel)] p-6 sm:p-7">
        {unlocked ? (
          <>
            <p className="text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
              All{" "}
              {findingCount === 1
                ? "one fix is"
                : `${findingCount} fixes are`}{" "}
              unlocked on your report now. What to change, where, and which one
              to do first. The link never expires, and it&apos;s in your inbox
              too.
            </p>
            <Link
              href={`/scan/${scan.token}`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-colors hover:bg-[var(--accent-hot)] sm:w-auto"
            >
              Open my list &rarr;
            </Link>
          </>
        ) : (
          <>
            <p className="text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
              <span className="font-semibold text-[var(--text)]">
                Your payment went through.
              </span>{" "}
              We&apos;re unlocking the fixes on your report. It takes a few
              seconds and this page will update on its own. Nothing else is
              needed from you.
            </p>
            <Link
              href={`/scan/${scan.token}`}
              className="mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--line)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] sm:w-auto"
            >
              Go to my report &rarr;
            </Link>
          </>
        )}
      </div>

      {alreadyBoughtBuild ? (
        <BookKickoff domain={domain} />
      ) : (
        <>
          <BuildOffer
            token={scan.token}
            domain={domain}
            findingCount={findingCount}
          />

          <p className="mt-10 text-[15px] leading-relaxed text-[var(--dim)]">
            Not now? Nothing happens. Your list stays on{" "}
            <Link
              href={`/scan/${scan.token}`}
              className="text-[var(--muted)] underline underline-offset-4"
            >
              your report
            </Link>{" "}
            and the offer is still there when you get to it. Questions first:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[var(--muted)] underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </>
      )}
    </Shell>
  );
}
