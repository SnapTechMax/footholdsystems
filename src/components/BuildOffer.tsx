import { BuyButton } from "@/components/BuyButton";
import { DONE_FOR_YOU_PRICE, checkoutUrl } from "@/lib/scan/pricing";

/**
 * The $1,497 pitch, in one place.
 *
 * Lived twice before this, inline on the upsell page and as a component on the
 * report, with near identical copy. Two copies of a sales argument drift, and
 * the one nobody remembers to update is the one a customer reads.
 *
 * THE SECOND SITE LEADS. It used to be the fourth of five bullets, below the
 * fix list, which had it backwards: everything above it is work the buyer could
 * do themselves with the report they already paid for, and plenty will. The
 * second domain is the only part of this that is not a fix you apply. It is an
 * asset that has to be built, hosted and owned, and it is the reason to pay
 * rather than to read.
 *
 * Voice, per context/voice.md: short sentences, plain English, no hype, US
 * spelling, and no em dashes outside the price separator in the button. The
 * hammer lines are deliberate Becker structure, a block of setup and then one
 * flat sentence that lands.
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
   * is deliberately shorter: the cheap offer stays the primary action on that
   * page, and a second full pitch beside it would bury it.
   * "outreach" is the cold audit at /audit/<token>, where the reader has bought
   * nothing, asked for nothing, and has the whole report free. Same offer, same
   * mechanism, different opening — see the block below.
   */
  variant?: "full" | "brief" | "outreach";
}) {
  const pay = checkoutUrl(token, "done_for_you");

  if (variant === "brief") {
    return (
      <div className="mt-8 rounded-xl border border-[var(--line)] bg-[var(--ink)] p-7 sm:p-8">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--dim)] sm:text-xs">
          Or skip the list
        </p>
        <h2 className="mt-4 text-balance font-display text-2xl font-black uppercase leading-[1.02] tracking-[-0.02em] text-[var(--text)] sm:text-3xl">
          Have us do it, and build you a second website.
        </h2>

        <div className="mt-5 space-y-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
          <p>
            The list tells you what to change on {domain}. It cannot give you the
            part that matters most, because that part is not a change. It is a
            second site, on its own domain, built for machines rather than
            people, saying what they need in order to name you.
          </p>
          <p>
            We implement every fix on your list, rewrite your pages, make your
            listings agree, and build that second site. Two to three weeks. You
            keep both domains.
          </p>
        </div>

        <div className="mt-7">
          <BuyButton
            token={token}
            product="done_for_you"
            href={pay}
            className="group inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ink)] sm:w-auto"
          >
            Work with us &mdash; {DONE_FOR_YOU_PRICE}
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-hover:translate-x-1"
            >
              &rarr;
            </span>
          </BuyButton>
          <p className="mt-4 text-[14px] leading-relaxed text-[var(--dim)]">
            One payment, not a retainer. You do not need to buy the list first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* The opening argument, and the only part that changes by reader. The
          post-purchase version talks about the list they just bought; the
          outreach version talks about the report they were handed for nothing.
          Everything below this is the same offer either way, which is the whole
          reason it lives in one component. */}
      {variant === "outreach" ? (
        <div className="mt-16">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
            Before you start
          </p>
          <h2 className="mt-4 text-balance font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
            That list gets you level. It does not get you ahead.
          </h2>

          <div className="mt-6 space-y-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
            <p>
              Take the report and work through it. It is yours, there is nothing
              to pay, and nothing above this line is held back.
            </p>
            <p>
              But be straight with yourself about what it is. Every fix in it is
              something a scanner can detect, which means every competitor who
              runs the same scan gets the same list.
            </p>
            <p>
              Do all of it and you are level with the best prepared business in
              your category.
            </p>
            <p className="font-semibold text-[var(--text)]">
              Level is a good place to be. It is not the same as being the one
              that gets named.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-16">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
            Before you start
          </p>
          <h2 className="mt-4 text-balance font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
            That list gets you level. It does not get you ahead.
          </h2>

          <div className="mt-6 space-y-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
            <p>
              Be straight with yourself about what you just bought. Every fix on
              it is something a scanner can detect. Every competitor who runs the
              same scan gets the same list.
            </p>
            <p>
              Do all of it and you are level with the best prepared business in
              your category.
            </p>
            <p className="font-semibold text-[var(--text)]">
              Level is a good place to be. It is not the same as being the one
              that gets named.
            </p>
          </div>
        </div>
      )}

      {/* The focal point. */}
      <div className="mt-12 rounded-xl border-2 border-[var(--accent)]/40 bg-[var(--panel)] p-7 sm:p-10">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
          What we build you
        </p>
        <h2 className="mt-4 text-balance font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-[2.6rem]">
          A second website. Built for machines.
        </h2>

        <div className="mt-6 space-y-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
          <p>
            {domain} already has a job. It has to sell to people, carry your
            brand, and look like a business worth hiring. All of that pulls
            against being readable to a model.
          </p>
          <p>
            So fixing your existing site is always a compromise. You are asking
            one set of pages to serve two audiences that want opposite things
            from them.
          </p>
          <p>
            The second site has one audience. It sits where models go looking. It
            says what they need in order to name you, in the structure they read,
            with none of the compromises.
          </p>
          <p className="font-semibold text-[var(--text)]">
            It does not have to look like anything. It has to be findable and
            unambiguous.
          </p>
          <p>
            It runs on its own domain, separate from this one, and you own both.
          </p>
        </div>

        <div className="mt-9 border-t border-[var(--line)] pt-7">
          <p className="text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
            The fixes in your report you could run yourself. If you have the time
            and someone to do it, you should. A second domain is not a fix you
            apply. It is a thing that has to exist, and building it is the half
            no report can hand you.
          </p>
        </div>
      </div>

      {/* Everything else, now supporting rather than leading. */}
      <div className="mt-10">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
          And while we are in there
        </p>
        <ul className="mt-5 space-y-4">
          {[
            [
              "Every fix in your report, implemented",
              `All ${findingCount === 1 ? "one of them" : `${findingCount} of them`}, done on ${domain} itself. You do not brief anyone, and you do not check whether it was done right.`,
            ],
            [
              "Your pages rewritten",
              "Positioning decided first, then the words, in your voice. Specific enough that a model can match you to a situation instead of filing you under a category.",
            ],
            [
              "Your listings made to agree",
              "Google Business Profile, the trade directories, the profiles you already own. Contradictions between them are the cheapest reason to get dropped and the easiest to miss from the inside.",
            ],
            [
              "A written record",
              "Everything that changed and why. If you never speak to us again, none of it stops working.",
            ],
          ].map(([title, body]) => (
            <li key={title} className="flex gap-3.5">
              <span
                aria-hidden="true"
                className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
              />
              <span className="text-[16px] leading-[1.7] text-[var(--muted)]">
                <span className="font-semibold text-[var(--text)]">{title}.</span>{" "}
                {body}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-9 border-t border-[var(--line)] pt-7">
          <p className="text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
            <span className="font-semibold text-[var(--text)]">
              {DONE_FOR_YOU_PRICE}, once. Two to three weeks.
            </span>{" "}
            Not a retainer, not a monthly, not a contract you have to get out of
            later. One payment, the work gets done, you keep both domains.
          </p>
        </div>

        {/* Only on the cold audit, and deliberately right above the button.
            A guarantee is risk reversal, so it belongs at the moment of the
            decision rather than further down the page where it reads as a
            footnote. The two paid pages do not carry it: a reader who is
            already a customer has met us, and offer.md is explicit that the
            tiers must not blur, so this one has to be unmistakably about the
            build and not about the retainer's payout. */}
        {variant === "outreach" && <BuildGuarantee />}

        {/* One button. A "book a call first" option beside it converts someone
            who was ready to pay into someone who has to be sold again. */}
        <div className="mt-8">
          <BuyButton
            token={token}
            product="done_for_you"
            href={pay}
            className="group inline-flex w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] px-8 py-4 font-display text-base font-extrabold uppercase tracking-[0.02em] text-[var(--ink)] transition-all duration-150 hover:bg-[var(--accent-hot)] hover:shadow-[0_0_34px_0_rgba(246,190,0,0.35)] sm:w-auto sm:text-lg"
          >
            Start now &mdash; {DONE_FOR_YOU_PRICE}
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-hover:translate-x-1"
            >
              &rarr;
            </span>
          </BuyButton>
        </div>

        <p className="mt-5 text-[14px] leading-relaxed text-[var(--dim)]">
          One payment, then you pick a time with us and we start. No call to sit
          through before you can buy, and nothing to negotiate.
        </p>
      </div>
    </>
  );
}

/**
 * The refund promise on the build, checkable by a scanner that is not ours.
 *
 * Written to survive being taken literally, because someone will. It promises
 * a movement in a number anyone can measure, and it promises nothing about
 * what a model says, which is the line the rest of the site holds and this
 * must not cross. See context/offer.md, "Claims to avoid".
 *
 * NOT THE TIER 3 GUARANTEE. That one is $15,000 if a retainer client is not
 * ranking after 180 days, it lives on the handover page, and it is sold to
 * people who have already done a build. Naming this one "the guarantee" in the
 * same words would blur two tiers that offer.md says must never blur, so this
 * one is scoped to the refund and the word ranking does not appear in it.
 *
 * The reason it is safe to offer: every finding in the report is a check a
 * scanner already ran and can run again. Implementing them moves the score by
 * construction. We are guaranteeing the part we control, out loud, which is
 * also the most convincing way to say that the other part is not controllable
 * by anyone.
 */
export function BuildGuarantee() {
  return (
    <div className="mt-9 rounded-lg border-2 border-[var(--accent)]/40 bg-[var(--ink)] p-6 sm:p-8">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
        The guarantee
      </p>
      <p className="mt-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
        We cannot promise a model will name you. Nobody can, and anyone telling
        you otherwise is either lying to you or does not understand what they
        are selling. What we can put money behind is the part this report
        measures, because that part is not an opinion.
      </p>
      <p className="mt-4 text-[17px] font-semibold leading-[1.6] text-[var(--text)]">
        Scan your site again when we hand it back. Use any scanner you like,
        not just ours. If the score has not gone up, we refund the{" "}
        {DONE_FOR_YOU_PRICE} in full.
      </p>
      <p className="mt-4 text-[15px] leading-[1.7] text-[var(--dim)]">
        Ours, Ora, or one we have never heard of. Ask any time in the thirty
        days after handover. One condition, and it is the obvious one: it has to
        still be the site we worked on, so if the pages get replaced the week
        after, we are not measuring the same thing anymore.
      </p>
      <p className="mt-4 text-[16px] font-semibold leading-[1.6] text-[var(--text)]">
        You do not have to take our word for any of it. That is the point of
        letting you use somebody else&apos;s scanner.
      </p>
    </div>
  );
}
