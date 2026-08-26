import { DONE_FOR_YOU_PRICE } from "@/lib/scan/pricing";
import { CONTACT_EMAIL, calendlyKickoffUrl } from "@/lib/site";

/**
 * What a build customer sees once the money has cleared.
 *
 * The call moved to after the payment on purpose. Offering "book a call" beside
 * a buy button converts people who were ready to buy into people who have to be
 * sold a second time on a call, and the slower half of that pair is the one
 * that loses deals. Once they have paid, the call is not a pitch — it is
 * scheduling, and the only thing standing between them and the work starting.
 *
 * So this is deliberately the only call to action they see. Shown on both the
 * upsell page and the report, because a buyer might return to either and should
 * find the same next step in both places rather than having to remember which
 * tab it was on.
 */
export function BookKickoff({ domain }: { domain: string }) {
  return (
    <div className="mt-14 rounded-xl border-2 border-[var(--accent)]/40 bg-[var(--panel)] p-7 sm:p-10">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
        You&apos;re in
      </p>

      <h2 className="mt-4 text-balance font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
        One thing left: pick your start date.
      </h2>

      <div className="mt-6 space-y-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
        <p>
          Your {DONE_FOR_YOU_PRICE} payment went through and {domain} is on the
          board. The work takes two to three weeks from the day we start, and
          the only thing setting that day is this call.
        </p>
        <p>
          Thirty minutes, and it is not a pitch. You have already bought. We go
          through what you actually sell and who for, which of your listings we
          need access to, and what your second domain should be called. Bring
          logins for your website and your Google Business Profile if you have
          them to hand; if you do not, we will sort that out on the call.
        </p>
      </div>

      <div className="mt-8">
        <a
          href={calendlyKickoffUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-all duration-150 hover:bg-[var(--accent-hot)] hover:shadow-[0_0_34px_0_rgba(246,190,0,0.35)] sm:w-auto sm:text-lg"
        >
          Book your kickoff call
          <span
            aria-hidden="true"
            className="transition-transform duration-150 group-hover:translate-x-1"
          >
            &rarr;
          </span>
        </a>
      </div>

      <p className="mt-5 text-[14px] leading-relaxed text-[var(--dim)]">
        Nothing on the calendar that works? Email{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-[var(--muted)] underline underline-offset-4"
        >
          {CONTACT_EMAIL}
        </a>{" "}
        and we&apos;ll find a time by hand. Your slot is held either way. The
        work is paid for and it is not going anywhere.
      </p>
    </div>
  );
}
