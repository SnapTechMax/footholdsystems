import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BuildGuarantee } from "@/components/BuildOffer";
import { BuyButton } from "@/components/BuyButton";
import { Eyebrow } from "@/components/ScanReportView";
import { getScanByToken, isPaid } from "@/lib/scan/db";
import {
  DONE_FOR_YOU_PRICE,
  checkoutUrl,
} from "@/lib/scan/pricing";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * The link that goes in a cold email when the email sells the build directly.
 *
 * IT EXISTS TO ABSORB PREFETCHES. `/api/go/checkout` is a GET with two side
 * effects: it sends `InitiateCheckout` to Meta and it creates a real checkout
 * configuration at Whop. Outlook Safe Links, Proofpoint, Mimecast and every
 * other mail scanner opens every URL in an inbound cold email before a human
 * sees it, so pasting that route into outbound would have manufactured a few
 * hundred checkout starts against real prospect tokens and buried the ratio
 * that says whether outbound works. A page render costs nothing to prefetch,
 * and the button on it is the only thing that reaches the route.
 *
 * Attribution is identical either way. This carries the same token, so the
 * checkout still goes out with `scan_token` in its metadata and the payment
 * still lands on this prospect's row. See /api/go/checkout.
 *
 * Outreach only, and 404 otherwise, for the same reason /audit/<token> is: the
 * token is the same string a paying customer's report uses, and this page
 * names a price without a paywall in front of it.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Start the build",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Same sanitizer as /api/go/checkout, and it has to stay the same.
 *
 * Whatever survives here is handed to that route, which puts it in Whop's
 * metadata as `email_key`. A character it would strip is a character that
 * should never have been in the link, and letting one through here would only
 * move the problem one hop.
 */
function tag(value: string | undefined, max: number): string | null {
  const cleaned = (value ?? "")
    .trim()
    .slice(0, max)
    .replace(/[^a-zA-Z0-9._-]/g, "");
  return cleaned || null;
}

export default async function StartBuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string; c?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;

  const scan = await getScanByToken(token).catch(() => null);
  if (!scan) notFound();
  if (!scan.outreach) notFound();

  // Nothing to sell to someone who already bought. The audit page renders the
  // kickoff block in that state, which is the action they actually have left.
  const bought = await isPaid(scan.id, "done_for_you").catch(() => false);
  if (bought) redirect(`/audit/${scan.token}`);

  // A link sent before the scan finished, or one that failed. The audit page
  // owns both of those states already, including the poller.
  if (scan.status !== "complete" || !scan.report) {
    redirect(`/audit/${scan.token}`);
  }

  const findingCount = scan.report.findings.length;

  // The batch tag from the cold email, passed straight through so it reaches
  // Whop's metadata alongside the token.
  const campaign = tag(query.e, 80);
  const link = tag(query.c, 60);
  const pay = (() => {
    const base = new URL(checkoutUrl(scan.token, "done_for_you"));
    if (campaign) base.searchParams.set("e", campaign);
    base.searchParams.set("c", link ?? "cold-start");
    return base.toString();
  })();

  return (
    <main className="bg-[var(--bg)]">
      <div className="mx-auto max-w-2xl px-5 py-16 sm:px-6 sm:py-24">
        <Eyebrow>The build</Eyebrow>

        <h1 className="mt-5 text-balance font-display text-4xl font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-5xl">
          Start the build on {scan.domain}.
        </h1>

        <p className="mt-6 text-[17px] leading-[1.7] text-[var(--muted)]">
          One payment, then we start. Two to three weeks from today you have a
          second website built for machines, on its own domain, and every fix in
          your audit applied to {scan.domain} itself.
        </p>

        <div className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
            What you get
          </p>
          <ul className="mt-5 space-y-3.5">
            {[
              "A second website on its own domain, built to be read by models rather than people. You own it.",
              `Every fix in your audit implemented on ${scan.domain}. ${
                findingCount === 1 ? "There is one." : `All ${findingCount} of them.`
              }`,
              "Your pages rewritten, positioning first, in your voice.",
              "Your listings made to agree with each other.",
              "A written record of everything that changed and why.",
            ].map((item) => (
              <li key={item} className="flex gap-3.5">
                <span
                  aria-hidden="true"
                  className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                />
                <span className="text-[16px] leading-[1.7] text-[var(--muted)]">
                  {item}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-7 border-t border-[var(--line)] pt-6 text-[17px] font-semibold leading-[1.6] text-[var(--text)]">
            {DONE_FOR_YOU_PRICE}, once. Not a retainer, not a monthly, not a
            contract you have to get out of later.
          </p>
        </div>

        {/* Risk reversal immediately above the button, same as on the audit
            page. A stranger deciding to send four figures to a business they
            met by email needs this at the decision, not further down. */}
        <BuildGuarantee />

        <div className="mt-9">
          <BuyButton
            token={scan.token}
            product="done_for_you"
            href={pay}
            className="group inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-all duration-150 hover:bg-[var(--accent-hot)] hover:shadow-[0_0_34px_0_rgba(246,190,0,0.35)] sm:w-auto sm:text-lg"
          >
            Pay and start &mdash; {DONE_FOR_YOU_PRICE}
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-hover:translate-x-1"
            >
              &rarr;
            </span>
          </BuyButton>
          <p className="mt-5 text-[14px] leading-relaxed text-[var(--dim)]">
            Card payment through Whop. You get a receipt, then a short form
            asking what we need to know about your business.
          </p>
        </div>

        <div className="mt-14 border-t border-[var(--line)] pt-8">
          <p className="text-[16px] leading-[1.7] text-[var(--muted)]">
            <span className="font-semibold text-[var(--text)]">
              Want to read the audit first?{" "}
            </span>
            It is free, nothing is held back, and the fixes are all in it.
          </p>
          <a
            href={`/audit/${scan.token}`}
            className="mt-4 inline-block text-[16px] font-semibold text-[var(--accent)] underline underline-offset-4"
          >
            Read the full audit on {scan.domain}
          </a>
          <p className="mt-8 text-[14px] leading-relaxed text-[var(--dim)]">
            Questions before you pay, or you would rather not hear from us
            again: reply to the email, or write to{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[var(--muted)] underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
