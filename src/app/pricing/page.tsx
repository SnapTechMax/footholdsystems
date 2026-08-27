import type { Metadata } from "next";
import Link from "next/link";
import { ScanCta } from "@/components/ScanCta";
import {
  DONE_FOR_YOU_PRICE,
  RETAINER_MONTHLY_PRICE,
  RETAINER_SETUP_PRICE,
  SOLUTIONS_PRICE,
  GUARANTEE_PAYOUT,
} from "@/lib/scan/pricing";
import {
  breadcrumbSchema,
  jsonLdGraph,
  offersSchema,
  organizationSchema,
} from "@/lib/schema";

/**
 * Pricing.
 *
 * A page the sales funnel did not previously have, and its absence was a
 * required check failing on the 2026-08-27 agent-readiness scan: pricing-info,
 * 0/3, "no pricing page or pricing data found". That check exists because an
 * assistant asked "how much does FootHold cost" has to answer from something,
 * and a price that only appears inside a checkout it cannot reach is a price it
 * will decline to quote — or worse, guess at.
 *
 * IT IS NOT A SECOND FUNNEL ENTRANCE. The sales page still owns the offer, the
 * argument and the CTA; this page is a reference table for someone who already
 * knows what they want and for a machine that needs a number. Which is why the
 * copy is flat and short — a second page of persuasion competing with the first
 * would split the traffic and win neither half.
 *
 * Every figure comes from lib/scan/pricing.ts. That module's own note explains
 * what happens when a price is written twice: two prices in this codebase have
 * already drifted apart inside a single day.
 */

export const metadata: Metadata = {
  title: "Pricing",
  description:
    `What FootHold AEO costs: ${SOLUTIONS_PRICE} for the full fix list from your ` +
    `scan, ${DONE_FOR_YOU_PRICE} for the done-for-you build, and ${RETAINER_SETUP_PRICE} ` +
    `plus ${RETAINER_MONTHLY_PRICE} a month for the ongoing retainer. The scan itself is free.`,
  alternates: {
    canonical: "/pricing",
    types: { "text/markdown": "/pricing.md" },
  },
};

const display = "font-display";

/**
 * The ladder, in order, with what each tier is and is not.
 *
 * `not` is the important column and the reason this reads as a reference rather
 * than a pitch: the fastest way to make a price legible is to say what it stops
 * at. It is also the honest answer to the question a buyer actually has, which
 * is not "what do I get" but "what will I still be missing".
 */
const TIERS = [
  {
    id: "scan",
    name: "AI visibility scan",
    price: "Free",
    cadence: "One off",
    lead: "Where you stand today, scored out of 100.",
    gets: [
      "Your AI visibility score: how readable, clear and recommendable your site is to an assistant right now.",
      "Every place your site is invisible or ambiguous to an AI, ranked worst first.",
      "What each one is costing you, in plain English.",
      "Whether an AI can confirm your business is real when it goes looking for you by name.",
    ],
    not: "It tells you what is wrong. It does not tell you the exact change that fixes each one — that is the tier below.",
  },
  {
    id: "solutions",
    name: "Scan solutions",
    price: SOLUTIONS_PRICE,
    cadence: "One off",
    lead: "The fix for every finding, written out.",
    gets: [
      "The specific change that clears each finding on your report, not a category of change.",
      "Ordered by the points it puts back, so the first hour of work is the one that moves the number most.",
      "Written to be handed to whoever maintains your site, or done yourself.",
    ],
    not: "You or your developer do the work. Nothing is implemented for you.",
  },
  {
    id: "done-for-you",
    name: "Done-for-you build",
    price: DONE_FOR_YOU_PRICE,
    cadence: "One off",
    lead: "We do it, including the second domain.",
    gets: [
      "Your existing site restructured so machines can read what your business is: entity and service schema, answer-shaped content, plain crawlable facts.",
      "Your listings made to agree with each other — same name, same address format, same claims, everywhere you already appear.",
      "A second site on its own domain, built for machines rather than people, with none of the compromises your main site has to make.",
      "A kickoff call to settle positioning, which listings matter in your trade, and what the second domain is called.",
    ],
    not: "It is a build, not a subscription. Nothing is re-measured for you after it ships.",
  },
  {
    id: "retainer",
    name: "Ongoing AEO retainer",
    price: `${RETAINER_SETUP_PRICE} + ${RETAINER_MONTHLY_PRICE}/mo`,
    cadence: "Six month minimum",
    lead: "The build, then somebody keeping the seat.",
    gets: [
      "Everything in the done-for-you build.",
      "The same buying prompts re-run against the same competitors every month, so movement is measured rather than asserted.",
      "Continued work on whichever of the four signals is currently costing you the answer.",
      `A written 180 day condition with ${GUARANTEE_PAYOUT} attached to it.`,
    ],
    not: "Not a checkout. A six month commitment with a guarantee attached is a conversation first, which is why this tier books a call instead of taking a card.",
  },
];

export default function PricingPage() {
  /*
   * Offer JSON-LD, and the whole reason the check was failing.
   *
   * `offersSchema()` is the same function the homepage's Service node uses, so
   * the prices a model reads here and the prices it reads there are one array
   * built from one set of constants — not two hand-written copies that agree
   * today.
   */
  const graph = jsonLdGraph([
    organizationSchema(),
    {
      "@type": "OfferCatalog",
      "@id": "https://www.footholdsystems.com/pricing#catalog",
      name: "FootHold AEO pricing",
      url: "https://www.footholdsystems.com/pricing",
      itemListElement: offersSchema(),
    },
    breadcrumbSchema([
      { name: "FootHold AEO", path: "/" },
      { name: "Pricing", path: "/pricing" },
    ]),
  ]);

  return (
    <div className="bg-[var(--bg)] text-[var(--text)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />

      <section className="bg-[var(--ink)] text-[var(--text)]">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
            FootHold AEO
          </p>
          <h1
            className={`${display} mt-4 text-5xl font-black uppercase leading-[0.94] tracking-tight sm:text-7xl`}
          >
            Pricing
          </h1>
          <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-[var(--muted)]">
            Four tiers, and the first one is free. Every price on this page is
            the price you pay — there is no setup fee hiding under the one-off
            tiers and no minimum term on anything except the retainer, which
            says so.
          </p>
          <p className="mt-4 max-w-[54ch] text-[17px] leading-relaxed text-[var(--muted)]">
            Start with the scan. It is the only one of the four that tells you
            whether you need the other three, and you can read it and act on it
            without ever speaking to us.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-px overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--line)]">
          {TIERS.map((tier) => (
            <div key={tier.id} id={tier.id} className="bg-[var(--bg)] p-6 sm:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <h2
                  className={`${display} text-2xl font-black uppercase tracking-tight text-[var(--text)] sm:text-3xl`}
                >
                  {tier.name}
                </h2>
                <p className="font-mono text-lg font-bold text-[var(--accent)] sm:text-xl">
                  {tier.price}
                </p>
              </div>

              <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dim)]">
                {tier.cadence}
              </p>

              <p className="mt-5 text-[17px] font-semibold leading-relaxed text-[var(--text)]">
                {tier.lead}
              </p>

              <ul className="mt-4 space-y-3 text-[16px] leading-relaxed text-[var(--muted)]">
                {tier.gets.map((line) => (
                  <li key={line} className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-[var(--accent)]"
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-5 border-l-2 border-[var(--line)] pl-4 text-[15px] leading-relaxed text-[var(--dim)]">
                {tier.not}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <h2
            className={`${display} text-2xl font-black uppercase tracking-tight text-[var(--text)] sm:text-3xl`}
          >
            How to start
          </h2>
          <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-[var(--muted)]">
            Every tier begins with the free scan, including the paid ones — the
            fix list and the build are both built off your report, so there is
            no order in which buying first would save you a step. Run the scan,
            read what it says, and decide then.
          </p>

          <div className="mt-8">
            <ScanCta entryPoint="pricing" className="w-full sm:w-auto">
              Run my free scan
            </ScanCta>
          </div>

          <p className="mt-8 max-w-[60ch] text-[15px] leading-relaxed text-[var(--dim)]">
            Questions about which tier fits before you run anything?{" "}
            <Link
              href="/contact"
              className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
            >
              Get in touch
            </Link>
            . A machine-readable copy of this page lives at{" "}
            <Link
              href="/pricing.md"
              className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
            >
              /pricing.md
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
