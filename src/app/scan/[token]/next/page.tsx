import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PurchasePixel } from "@/components/PurchasePixel";
import { ScanPoller } from "@/components/ScanPoller";
import { getScanByToken, isPaid } from "@/lib/scan/db";
import {
  DONE_FOR_YOU_PRICE,
  PURCHASE_MARKER,
  SOLUTIONS_PRICE_CENTS,
  checkoutUrl,
} from "@/lib/scan/pricing";
import { buildReport } from "@/lib/scan/report";
import { CONTACT_EMAIL, calendlyUrl } from "@/lib/site";

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

/** One line of what the engagement actually includes. */
function Deliverable({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span
        aria-hidden="true"
        className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
      />
      <span className="text-[16px] leading-[1.7] text-[var(--muted)]">
        <span className="font-semibold text-[var(--text)]">{title}.</span>{" "}
        {children}
      </span>
    </li>
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
  const pay = checkoutUrl(scan.token, "done_for_you");

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
              unlocked on your report now — what to change, where, and which one
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
              We&apos;re unlocking the fixes on your report — it takes a few
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
        <div className="mt-14 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-7 sm:p-10">
          <Eyebrow>Already booked</Eyebrow>
          <h2 className="mt-4 text-balance font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
            We&apos;re already building yours.
          </h2>
          <p className="mt-6 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
            You&apos;ve paid for the {DONE_FOR_YOU_PRICE} build, so there&apos;s
            nothing to buy on this page. If you haven&apos;t heard from us yet,
            email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-semibold text-[var(--accent)] underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and we&apos;ll get you scheduled.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-16">
            <Eyebrow>Before you start</Eyebrow>
            <h2 className="mt-4 text-balance font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
              That list gets you level. It doesn&apos;t get you ahead.
            </h2>

            <div className="mt-6 space-y-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
              <p>
                Be straight with yourself about what you just bought. Every fix
                on it is something a scanner can detect, which means every
                competitor who runs the same scan gets the same list. Do all of
                it and you are level with the best-prepared business in your
                category.
              </p>
              <p>
                Level is a good place to be. It is not the same as being the one
                that gets named.
              </p>
              <p>
                The things that decide that last part are the things no scanner
                sees. Whether your specifics are sharp enough for a model to
                match you to a situation rather than a category. Whether the rest
                of the web corroborates what your site claims. Whether the words
                on your service pages are the words your customers actually use
                when they describe the problem to an assistant. That is
                judgement, and it is the half we do by hand.
              </p>
            </div>
          </div>

          <div className="mt-12 rounded-xl border-2 border-[var(--accent)]/40 bg-[var(--panel)] p-7 sm:p-10">
            <Eyebrow>We do it for you &mdash; {DONE_FOR_YOU_PRICE}</Eyebrow>
            <h2 className="mt-4 text-balance font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
              You send us the keys. We hand back two sites.
            </h2>

            <ul className="mt-8 space-y-5">
              <Deliverable title="Every fix on your list, implemented">
                All{" "}
                {findingCount === 1 ? "one of them" : `${findingCount} of them`}
                , done on {domain} itself. You don&apos;t brief a developer, you
                don&apos;t check whether it was done right, and you don&apos;t
                find out in six months that half of it was skipped.
              </Deliverable>
              <Deliverable title="Your pages rewritten">
                Positioning decided first, then the words. In your voice, saying
                what you actually do and who for, specific enough that a model
                can match you to a situation instead of filing you under a
                category.
              </Deliverable>
              <Deliverable title="Your listings made to agree">
                Google Business Profile, the trade directories and the profiles
                you already own, lined up so the name, address, phone and claims
                match. Contradictions between them are the cheapest reason to get
                dropped, and the easiest to miss from the inside.
              </Deliverable>
              <Deliverable title="A second site, on its own domain">
                Built for machines only. {domain} has a job already — it has to
                sell to people, carry your brand, look right. All of that pulls
                against being maximally readable to a model, which is why fixing
                it is always a compromise between two audiences. The second
                domain has one audience and none of the compromises. It
                doesn&apos;t have to look like anything. It has to be findable
                and unambiguous.
              </Deliverable>
              <Deliverable title="You keep all of it">
                Both domains, and a written record of everything that changed and
                why. If you never speak to us again, none of it stops working.
              </Deliverable>
            </ul>

            <div className="mt-9 border-t border-[var(--line)] pt-7">
              <p className="text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
                <span className="font-semibold text-[var(--text)]">
                  {DONE_FOR_YOU_PRICE}, once. Two to three weeks.
                </span>{" "}
                Not a retainer, not a monthly, not a contract you have to get out
                of later. One payment, the work gets done, you keep everything.
                For most businesses this is built for, it is less than what one
                commercial job is worth.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a
                href={pay}
                className="group inline-flex items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-all duration-150 hover:bg-[var(--accent-hot)] hover:shadow-[0_0_34px_0_rgba(246,190,0,0.35)] sm:text-lg"
              >
                Start now &mdash; {DONE_FOR_YOU_PRICE}
                <span
                  aria-hidden="true"
                  className="transition-transform duration-150 group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </a>
              <a
                href={calendlyUrl("scan-upsell-dfy")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-lg border border-[var(--line)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--text)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                Twenty minutes first
              </a>
            </div>

            <p className="mt-5 text-[14px] leading-relaxed text-[var(--dim)]">
              Twenty minutes, no pitch deck, and if your list is short enough to
              handle yourself we&apos;ll tell you that on the call rather than
              sell you something you don&apos;t need.
            </p>
          </div>

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
