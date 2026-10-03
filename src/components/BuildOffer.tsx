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
          {count} on {domain}, fixed by us so AI can read your site.
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
            No need to buy the list first.
          </p>
        </div>

        <FixBonus compact />
      </div>
    );
  }

  return (
    <>
      {/* The only part that changes by reader. The outreach reader was handed
          the report for nothing and needs telling that it stays free. */}
      {variant === "outreach" && (
        <p className="mt-16 max-w-[52ch] text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
          The report is yours, free. The fixes can be done, but they&apos;re
          technical, and they have to be done the way AI reads a site. That
          part is our job.
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
            {count} above, done on {domain}, in the right order, without
            breaking what already works. No briefing, no checking our work.
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
            One payment, then pick a time and we start. No sales call.
          </p>
        </div>
      </div>

      {/* Secondary, and after the button on purpose: it sweetens the decision
          without competing with it. */}
      <FixBonus />
    </>
  );
}

/**
 * The separate domain that comes with the Fix, as a labelled bonus.
 *
 * Louder than a footnote, quieter than the Fix: a lighter border than the offer
 * box, and always after the button. Every point describes what the domain is,
 * never what it will win. Being named by a model is Get Picked's promise, not
 * this one's. See context/offer.md, "Claims to avoid".
 */
const BONUS_POINTS = [
  "Built only for AI to read, with nothing on it for a model to trip over.",
  "Lays out what you do, where you work and how to reach you, in one place.",
  "Sits beside your main website. Nothing about your current site changes.",
  "Included with The Fix at no extra cost, and the domain is yours to keep.",
];

function FixBonus({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`${compact ? "mt-7" : "mt-6"} rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/[0.04] p-6 sm:p-7`}
    >
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
        Bonus
      </p>
      <h3
        className={`mt-3 font-display ${compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"} font-extrabold uppercase leading-[1.1] tracking-[-0.01em] text-[var(--text)]`}
      >
        A second domain, built for AI.
      </h3>
      <ul className="mt-4 space-y-2.5">
        {BONUS_POINTS.map((point) => (
          <li key={point} className="flex gap-3">
            <span
              aria-hidden="true"
              className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
            />
            <span
              className={`${compact ? "text-[15px]" : "text-[15px] sm:text-[16px]"} leading-[1.6] text-[var(--muted)]`}
            >
              {point}
            </span>
          </li>
        ))}
      </ul>
    </div>
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
