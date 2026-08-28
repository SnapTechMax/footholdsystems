import type { Metadata } from "next";
import { contractUrl } from "@/lib/intake/contract";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * What a customer sees the moment the intake lands.
 *
 * One job: hand them the agreement. Everything else on this page is context
 * around that link, because signing is the only thing left between here and the
 * work starting, and a thank-you page that just says thank you wastes the one
 * moment they are certain to be looking.
 *
 * WITH NO CONTRACT CONFIGURED IT SAYS SO HONESTLY. See lib/intake/contract.ts:
 * an unset BUILD_CONTRACT_URL produces a sentence promising the agreement by
 * email rather than a button that goes nowhere, and the notification email
 * warns that somebody has to keep that promise by hand.
 *
 * Not indexed. A confirmation page in search results is a page that shows up
 * for people who have not submitted anything.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "We have everything",
  robots: { index: false, follow: false, nocache: true },
};

export default function StartThanksPage() {
  const contract = contractUrl();

  return (
    <main className="bg-[var(--ink)]">
      <div className="mx-auto max-w-2xl px-5 py-24 sm:px-6 sm:py-32">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
          Received
        </p>

        <h1 className="mt-5 text-balance font-display text-[2.1rem] font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-5xl">
          That was the long part. It is done.
        </h1>

        <p className="mt-7 max-w-[46ch] text-[17px] leading-[1.65] text-[var(--muted)] sm:text-[19px]">
          Your answers are in, and a confirmation is on its way to your inbox.
          Nothing else is needed from you today except one signature.
        </p>

        <div className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            One thing left
          </p>

          {contract ? (
            <>
              <p className="mt-5 text-[16px] leading-[1.65] text-[var(--muted)]">
                The agreement. It sets out what gets built, what it costs, what
                you own at the end, and what happens if you want out. Read it
                properly rather than scrolling to the signature line.
              </p>
              <a
                href={contract}
                className="group mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-all duration-150 hover:bg-[var(--accent-hot)] hover:shadow-[0_0_34px_0_rgba(246,190,0,0.35)] sm:text-lg"
              >
                Read and sign the agreement
                <span
                  aria-hidden="true"
                  className="transition-transform duration-150 group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </a>
              <p className="mt-4 text-center text-[13px] leading-relaxed text-[var(--dim)]">
                The same link is in your email, so you can do it later from a
                machine with a keyboard.
              </p>
            </>
          ) : (
            <p className="mt-5 text-[16px] leading-[1.65] text-[var(--muted)]">
              The agreement comes over in a separate email within one business
              day. It sets out what gets built, what it costs, what you own at
              the end, and what happens if you want out. Nothing starts until it
              is signed, so keep an eye out for it.
            </p>
          )}
        </div>

        <div className="mt-8 space-y-4 text-[15px] leading-[1.7] text-[var(--muted)]">
          <p>
            <span className="font-semibold text-[var(--text)]">Then what.</span>{" "}
            Once it is signed we read your answers properly and come back with
            anything that needs a real conversation rather than a form box, plus
            the account access we need. Build time is two to three weeks from
            that point.
          </p>
          <p>
            <span className="font-semibold text-[var(--text)]">
              Remembered something.
            </span>{" "}
            Reply to the confirmation email, or write to{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-semibold text-[var(--accent)] underline underline-offset-4"
            >
              {CONTACT_EMAIL}
            </a>
            . Nothing is locked in, and a late answer is better than a missing
            one.
          </p>
        </div>
      </div>
    </main>
  );
}
