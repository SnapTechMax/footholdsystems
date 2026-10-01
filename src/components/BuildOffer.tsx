import { BuyButton } from "@/components/BuyButton";
import {
  DONE_FOR_YOU_PRICE,
  FIX_CANCEL_FEE,
  checkoutUrl,
} from "@/lib/scan/pricing";

/**
 * The Fix pitch, in one place.
 *
 * Lived twice before this, inline on the upsell page and as a component on the
 * report, with near identical copy. Two copies of a sales argument drift, and
 * the one nobody remembers to update is the one a customer reads.
 *
 * THE FIX LEADS. It gets the headline, the weight and the button: we fix
 * everything in the report so AI can read the site. The separate domain used to
 * lead this pitch and now follows it as a labelled bonus, smaller, after the
 * button. It is still delivered; it is no longer what is being sold.
 *
 * NO RANKING HERE. Being named or picked by a model is the next offer, Get
 * Picked, and the only thing this one promises is delivery: the work in the
 * report, done in 21 days, or the money back. See context/offer.md, "Claims to
 * avoid".
 *
 * Voice, per context/voice.md: short sentences, plain English, no hype, US
 * spelling, and no em dashes outside the price separator in the button.
 */
export function BuildOffer({
  token,
  domain,
  findingCount,
  variant = "full",
}: {
  token: string;
  domain: string;
  findingCount: number;
  /**
   * "full" is for a reader who has bought the list and is deciding what next.
   * "brief" sits under the $49 paywall for someone who has bought nothing, and
   * is deliberately quieter: the cheap offer stays the primary action on that
   * page, and a second full pitch beside it would bury it.
   * "outreach" is the cold audit at /audit/<token>, where the reader has bought
   * nothing, asked for nothing, and has the whole report free. Same offer, with
   * one line of opening that says so.
   */
  variant?: "full" | "brief" | "outreach";
}) {
  const pay = checkoutUrl(token, "done_for_you");
  const count =
    findingCount === 1 ? "The one problem" : `All ${findingCount} problems`;

  if (variant === "brief") {
    return (
      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--ink)] p-7 sm:p-8">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--dim)] sm:text-xs">
          Or skip the list
        </p>
        <h2 className="mt-4 text-balance font-display text-2xl font-black uppercase leading-[1.02] tracking-[-0.02em] text-[var(--text)] sm:text-3xl">
          The Fix: make AI able to read your site.
        </h2>

        <p className="mt-5 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
          We fix everything in this report so AI can read your site. {count}{" "}
          on {domain}, done by us.
        </p>

        <FixTerms compact />

        <div className="mt-7">
          <BuyButton
            token={token}
            product="done_for_you"
            href={pay}
            className="group inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ink)] sm:w-auto"
          >
            Get the fix &mdash; {DONE_FOR_YOU_PRICE}
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-hover:translate-x-1"
            >
              &rarr;
            </span>
          </BuyButton>
          <p className="mt-4 text-[14px] leading-relaxed text-[var(--dim)]">
            You do not need to buy the list first.
          </p>
        </div>

        <p className="mt-6 border-t border-[var(--line)] pt-5 text-[14px] leading-relaxed text-[var(--dim)]">
          <span className="font-semibold text-[var(--muted)]">Bonus: </span>
          We also create a separate domain that&apos;s custom-built to give AI
          everything it needs to find you. When we&apos;re done, the domain is
          yours.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* The only part that changes by reader. The outreach reader was handed
          the report for nothing and needs telling that it stays free. */}
      {variant === "outreach" && (
        <p className="mt-16 max-w-[52ch] text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
          The report is yours, and nothing above this line is held back. If you
          would rather not do the work yourself, this is the offer.
        </p>
      )}

      {/* The focal point: the headline, the weight and the button. */}
      <div
        className={`${variant === "outreach" ? "mt-8" : "mt-16"} rounded-xl border-2 border-[var(--accent)]/40 bg-[var(--panel)] p-7 sm:p-10`}
      >
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
          The Fix
        </p>
        <h2 className="mt-4 text-balance font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-[2.6rem]">
          Make AI able to read your site.
        </h2>

        <div className="mt-6 space-y-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
          <p className="font-semibold text-[var(--text)]">
            We fix everything in this report so AI can read your site.
          </p>
          <p>
            {count} above, done on {domain} itself. You do not brief anyone, and
            you do not check whether it was done right.
          </p>
        </div>

        <FixTerms />

        {/* One button. A "book a call first" option beside it converts someone
            who was ready to pay into someone who has to be sold again. */}
        <div className="mt-9">
          <BuyButton
            token={token}
            product="done_for_you"
            href={pay}
            className="group inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-all duration-150 hover:bg-[var(--accent-hot)] hover:shadow-[0_0_34px_0_rgba(246,190,0,0.35)] sm:w-auto sm:text-lg"
          >
            Get the fix &mdash; {DONE_FOR_YOU_PRICE}
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-hover:translate-x-1"
            >
              &rarr;
            </span>
          </BuyButton>
          <p className="mt-5 text-[14px] leading-relaxed text-[var(--dim)]">
            One payment, then you pick a time with us and we start. No call to
            sit through before you can buy, and nothing to negotiate.
          </p>
        </div>
      </div>

      {/* Secondary, and after the button on purpose: it sweetens the decision
          without competing with it. */}
      <div className="mt-6 rounded-lg border border-[var(--line)] p-6 sm:p-7">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
          Bonus
        </p>
        <p className="mt-3 text-[15px] leading-[1.7] text-[var(--muted)] sm:text-[16px]">
          We also create a separate domain that&apos;s custom-built to give AI
          everything it needs to find you. When we&apos;re done, the domain is
          yours.
        </p>
      </div>
    </>
  );
}

/**
 * Price, guarantee and payment terms for the Fix. One copy, used by every
 * variant and by the pre-checkout page, so the terms cannot differ between the
 * page that pitches and the page that takes the money.
 */
export function FixTerms({ compact = false }: { compact?: boolean }) {
  const terms: [string, string][] = [
    ["Price", `${DONE_FOR_YOU_PRICE}, one time. No monthly fees. No contract.`],
    ["Guarantee", "Service delivered in 21 days or you get your money back."],
    [
      "Next step",
      `The ${DONE_FOR_YOU_PRICE} counts toward our next step (Get Picked) if you continue.`,
    ],
    [
      "Payment",
      `Paid in full before work starts. If you cancel, ${FIX_CANCEL_FEE} is non-refundable.`,
    ],
  ];

  return (
    <dl
      className={`${compact ? "mt-5 space-y-2.5" : "mt-8 space-y-3.5 border-t border-[var(--line)] pt-7"}`}
    >
      {terms.map(([label, body]) => (
        <div key={label} className="flex gap-3.5">
          <span
            aria-hidden="true"
            className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
          />
          <div
            className={`${compact ? "text-[15px]" : "text-[16px] sm:text-[17px]"} leading-[1.6] text-[var(--muted)]`}
          >
            <dt className="inline font-semibold text-[var(--text)]">{label}: </dt>
            <dd className="inline">{body}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
