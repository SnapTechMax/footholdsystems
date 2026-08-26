import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookKickoff } from "@/components/BookKickoff";
import { PurchasePixel } from "@/components/PurchasePixel";
import { ScanPoller } from "@/components/ScanPoller";
import { getScanByToken, isPaid } from "@/lib/scan/db";
import {
  DONE_FOR_YOU_PRICE,
  DONE_FOR_YOU_PRICE_CENTS,
  PURCHASE_MARKER,
} from "@/lib/scan/pricing";
import { buildReport } from "@/lib/scan/report";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * Where a build buyer lands the moment the payment clears.
 *
 * This used to be the report page, which was wrong in two ways worth recording
 * so nobody helpfully reverts it.
 *
 * The booking call to action sat below the score and all eight findings, so
 * somebody who had just paid the most expensive thing on offer had to scroll
 * through a document they had already read to find the one action left. The
 * $49 tier got a page that opens with what it bought; the tier worth thirty
 * times more got a footer.
 *
 * And the report never polled for payment state. Whop redirects the instant it
 * takes the money, often before its webhook lands, so `isPaid` could still be
 * false on arrival and the page fell through to the pitch — showing "Start now
 * — {DONE_FOR_YOU_PRICE}" to somebody who had paid ten seconds earlier, with
 * nothing updating until they refreshed by hand. A customer who believes their
 * payment failed is a support ticket at best.
 *
 * So: confirmation first, booking first, report linked rather than scrolled
 * past, and a poller for the webhook gap.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "You're booked in",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ScanBookedPage({
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

  const paid = await isPaid(scan.id, "done_for_you").catch(() => false);
  const domain = report?.domain ?? scan.domain;

  return (
    <main className="bg-[var(--bg)]">
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24">
        {/* Only while the webhook is in flight. Stops once it lands. */}
        {!paid && <ScanPoller intervalMs={3_000} maxAttempts={20} />}

        {/* Needs the payment on record AND the checkout marker, so revisiting
            this URL cannot re-fire the conversion. */}
        {paid && (
          <PurchasePixel
            token={scan.token}
            product="done_for_you"
            value={DONE_FOR_YOU_PRICE_CENTS / 100}
            justPurchased={query[PURCHASE_MARKER] === "1"}
          />
        )}

        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
          {paid ? "Payment received" : "Payment processing"}
        </p>

        <h1 className="mt-5 text-balance font-display text-4xl font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-5xl">
          {paid ? "That's the hard part done." : "Your payment went through."}
        </h1>

        {paid ? (
          <>
            <p className="mt-7 max-w-[52ch] text-[17px] leading-[1.65] text-[var(--muted)] sm:text-[19px]">
              We have your {DONE_FOR_YOU_PRICE} and {domain} is on the board.
              Everything from here is us doing the work, except one thing, and it
              is the thing that sets your start date.
            </p>
            <BookKickoff domain={domain} />
          </>
        ) : (
          <div className="mt-8 rounded-xl border-2 border-[var(--accent)]/40 bg-[var(--panel)] p-6 sm:p-7">
            <p className="text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
              <span className="font-semibold text-[var(--text)]">
                Nothing else is needed from you.
              </span>{" "}
              We&apos;re confirming it with our payment provider, which takes a
              few seconds. This page updates on its own and your booking link
              appears here as soon as it does.
            </p>
            <p className="mt-4 text-[14px] leading-relaxed text-[var(--dim)]">
              Still here after a minute? Email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-[var(--muted)] underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              and we&apos;ll confirm by hand. Your payment is safe either way. It
              is recorded on our side before this page ever changes.
            </p>
          </div>
        )}

        {/* Linked, not scrolled past. The report is still theirs and still the
            reference for what we are about to do, but it is no longer the thing
            standing between a buyer and the only action left. */}
        <p className="mt-10 text-[15px] leading-relaxed text-[var(--dim)]">
          Your scan report is still at{" "}
          <Link
            href={`/scan/${scan.token}`}
            className="text-[var(--muted)] underline underline-offset-4"
          >
            the same link
          </Link>
          , and every fix on it is now ours to implement. Nothing there needs
          doing by you.
        </p>
      </div>
    </main>
  );
}
