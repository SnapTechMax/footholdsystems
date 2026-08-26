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
   */
  variant?: "full" | "brief";
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
          <a
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
          </a>
          <p className="mt-4 text-[14px] leading-relaxed text-[var(--dim)]">
            One payment, not a retainer. You do not need to buy the list first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-16">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
          Before you start
        </p>
        <h2 className="mt-4 text-balance font-display text-3xl font-black uppercase leading-[0.98] tracking-[-0.02em] text-[var(--text)] sm:text-4xl">
          That list gets you level. It does not get you ahead.
        </h2>

        <div className="mt-6 space-y-4 text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
          <p>
            Be straight with yourself about what you just bought. Every fix on it
            is something a scanner can detect. Every competitor who runs the same
            scan gets the same list.
          </p>
          <p>
            Do all of it and you are level with the best prepared business in
            your category.
          </p>
          <p className="font-semibold text-[var(--text)]">
            Level is a good place to be. It is not the same as being the one that
            gets named.
          </p>
        </div>
      </div>

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
            The fixes on your list you could run yourself. If you have the time
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
              "Every fix on your list, implemented",
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

        {/* One button. A "book a call first" option beside it converts someone
            who was ready to pay into someone who has to be sold again. */}
        <div className="mt-8">
          <a
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
          </a>
        </div>

        <p className="mt-5 text-[14px] leading-relaxed text-[var(--dim)]">
          One payment, then you pick a time with us and we start. No call to sit
          through before you can buy, and nothing to negotiate.
        </p>
      </div>
    </>
  );
}
