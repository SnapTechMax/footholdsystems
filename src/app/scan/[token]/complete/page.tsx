import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getScanByToken } from "@/lib/scan/db";
import { CONTACT_EMAIL, calendlyKickoffUrl } from "@/lib/site";

/**
 * The handover. What a build customer reads once the work is delivered.
 *
 * Renders only when an admin has filled in the handover for this scan, so the
 * URL is dead until the work actually exists. That is deliberate: a page
 * thanking somebody for finished work, reachable before the work is finished,
 * is worse than no page.
 *
 * It is also the only place tier 3 is offered. offer.md calls that a separate
 * funnel sold only to existing build customers, and this is the moment that
 * rule describes: they have paid, the work is done, and they can see what it
 * produced. Putting a $2,500 a month commitment in front of somebody who has
 * seen nothing yet asks them to judge it on faith.
 *
 * ON THE GUARANTEE. It is stated as what it is, a payout if a condition is not
 * met, and never as a promise about rankings. voice.md is explicit that nobody
 * controls a model's output and that the copy says so outright. A guarantee
 * written carelessly here would contradict the rest of the site and be the one
 * claim that could not be defended.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your build is live",
  robots: { index: false, follow: false, nocache: true },
};

/** Tier 3, exactly as offer.md states it. Nothing added. */
const RETAINER_INCLUDES = [
  [
    "Two social posts a month",
    "From accounts the models are already reading, so what they say about you is corroborated somewhere that is not your own site.",
  ],
  [
    "High trust .gov backlinks",
    "The hardest kind to get and the hardest for a competitor to copy.",
  ],
  [
    "Monthly query tracking",
    "What the answer engines say when someone asks for a business like yours, month over month, so you can see it move rather than take our word for it.",
  ],
  [
    "New answer content every month",
    "Written against the questions your buyers actually ask, added to both sites.",
  ],
  [
    "A review generation system",
    "With a written procedure your staff can run, so it keeps working when we are not looking.",
  ],
  [
    "Monthly high trust Reddit posts",
    "Where a lot of what the models repeat about small businesses comes from.",
  ],
];

export default async function ScanCompletePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const scan = await getScanByToken(token).catch(() => null);
  if (!scan) notFound();

  // The whole gate. No handover means the build is not delivered, and there is
  // nothing here to show yet.
  const handover = scan.handover;
  if (!handover) notFound();

  const delivered = new Date(handover.deliveredAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="bg-[var(--bg)]">
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
          Delivered {delivered}
        </p>

        <h1 className="mt-5 text-balance font-display text-4xl font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-5xl">
          It is done. Thank you for trusting us with it.
        </h1>

        <p className="mt-7 max-w-[52ch] text-[17px] leading-[1.65] text-[var(--muted)] sm:text-[19px]">
          Everything on your list is implemented, your pages are rewritten, your
          listings agree with each other, and your second site is live. Both
          domains are yours. Nothing here depends on us staying involved.
        </p>

        {/* What they own now. */}
        <div className="mt-10 rounded-xl border-2 border-[var(--accent)]/40 bg-[var(--panel)] p-7 sm:p-8">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
            What you own
          </p>
          <dl className="mt-6 space-y-6">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dim)]">
                Your site
              </dt>
              <dd className="mt-1.5 font-display text-xl font-extrabold text-[var(--text)] sm:text-2xl">
                <a
                  href={`https://${scan.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-[var(--accent)]"
                >
                  {scan.domain}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dim)]">
                Your machine readable site
              </dt>
              <dd className="mt-1.5 font-display text-xl font-extrabold text-[var(--text)] sm:text-2xl">
                <a
                  href={`https://${handover.secondDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 hover:text-[var(--accent)]"
                >
                  {handover.secondDomain}
                </a>
              </dd>
            </div>
          </dl>

          <div className="mt-7 border-t border-[var(--line)] pt-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dim)]">
              What changed
            </p>
            <div className="mt-3 space-y-3 text-[16px] leading-[1.7] text-[var(--muted)]">
              {handover.notes
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
            </div>
          </div>

          <p className="mt-7 text-[14px] leading-relaxed text-[var(--dim)]">
            Your original scan report is still at{" "}
            <Link
              href={`/scan/${scan.token}`}
              className="text-[var(--muted)] underline underline-offset-4"
            >
              the same link
            </Link>
            , so you can see what it looked like before.
          </p>
        </div>

        {/* Tier 3. */}
        <div className="mt-16">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
            What happens next
          </p>
          <h2 className="mt-4 text-balance font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
            You are readable now. Staying named is a different job.
          </h2>

          <div className="mt-6 space-y-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
            <p>
              What we built does not decay. The structure holds, the pages stay
              written, and the second site keeps saying what it says.
            </p>
            <p>
              What moves is everything around it. Your competitors are getting
              the same advice we gave you. The models retrain, and what they were
              told about your category last year gets replaced by what they are
              told about it this year. Being the best documented business in your
              market is a position somebody else can take.
            </p>
            <p className="font-semibold text-[var(--text)]">
              The build is a starting position. Holding it is ongoing work, and
              that is the only reason this next part is monthly.
            </p>
          </div>

          <div className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-7 sm:p-10">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
              The retainer
            </p>
            <h3 className="mt-4 text-balance font-display text-2xl font-black uppercase leading-[1.02] tracking-[-0.02em] text-[var(--text)] sm:text-3xl">
              $2,000 to start, then $2,500 a month.
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--dim)]">
              Six month minimum, because nothing here shows up faster than that
              and a shorter commitment would let us both pretend otherwise.
            </p>

            <ul className="mt-8 space-y-5">
              {RETAINER_INCLUDES.map(([title, body]) => (
                <li key={title} className="flex gap-3.5">
                  <span
                    aria-hidden="true"
                    className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                  />
                  <span className="text-[16px] leading-[1.7] text-[var(--muted)]">
                    <span className="font-semibold text-[var(--text)]">
                      {title}.
                    </span>{" "}
                    {body}
                  </span>
                </li>
              ))}
            </ul>

            {/* Stated as a payout on a condition, never as a promise about a
                ranking. The rest of the site says outright that nobody controls
                a model's output, and this must not contradict it. */}
            <div className="mt-9 rounded-lg border-2 border-[var(--accent)]/40 bg-[var(--ink)] p-6">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                The guarantee
              </p>
              <p className="mt-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
                We still cannot promise a model will name you. Nobody can, and
                we have said so from the first page you read. What we can do is
                put money against it.
              </p>
              <p className="mt-4 text-[17px] font-semibold leading-[1.6] text-[var(--text)]">
                If you are not ranking on the LLM engines after 180 days, we pay
                you $15,000.
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-[var(--dim)]">
                That is ten times what the build cost you, and it is affordable
                for us only because we do this work for people who have already
                done the first half properly. You have.
              </p>
            </div>

            <div className="mt-9">
              <a
                href={calendlyKickoffUrl("tier3-retainer")}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-all duration-150 hover:bg-[var(--accent-hot)] hover:shadow-[0_0_34px_0_rgba(246,190,0,0.35)] sm:w-auto sm:text-lg"
              >
                Talk about the retainer
                <span
                  aria-hidden="true"
                  className="transition-transform duration-150 group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </a>
              <p className="mt-5 text-[14px] leading-relaxed text-[var(--dim)]">
                A conversation, not a checkout. This one has a guarantee attached
                and a six month commitment on both sides, so it is worth twenty
                minutes before either of us signs anything.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-12 text-[15px] leading-relaxed text-[var(--dim)]">
          Not interested in the retainer? Then this is where we part, and
          everything we built stays yours and keeps working. Questions any time:{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-[var(--muted)] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
