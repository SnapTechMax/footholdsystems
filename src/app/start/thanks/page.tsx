import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * What a customer sees the moment the intake lands.
 *
 * By this point the agreement is already signed: it comes before the intake,
 * not after it. So there is nothing left for the customer to do, and the one
 * job of this page is to say so plainly and tell them what happens on our side
 * next. A thank-you page that hints at a further step would send them looking
 * for one that does not exist.
 *
 * Not indexed. A confirmation page in search results is a page that shows up
 * for people who have not submitted anything.
 */

export const metadata: Metadata = {
  title: "We have everything",
  robots: { index: false, follow: false, nocache: true },
};

export default function StartThanksPage() {
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
          Your answers are in and a confirmation is on its way. Nothing else
          is needed from you today.
        </p>

        <div className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-7">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
            What happens now
          </p>
          <p className="mt-5 text-[16px] leading-[1.65] text-[var(--muted)]">
            We read your answers and come back within one business day with
            any questions and the access invites we need.
          </p>
          <p className="mt-4 text-[16px] leading-[1.65] text-[var(--muted)]">
            The work is done within 21 days of your kickoff call.
          </p>
        </div>

        <div className="mt-8 space-y-4 text-[15px] leading-[1.7] text-[var(--muted)]">
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
            . A late answer beats a missing one.
          </p>
        </div>
      </div>
    </main>
  );
}
