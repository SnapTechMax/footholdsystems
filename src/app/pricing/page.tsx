import type { Metadata } from "next";
import Link from "next/link";
import { ScanCta } from "@/components/ScanCta";
import {
  DONE_FOR_YOU_PRICE,
  FIX_CANCEL_FEE,
  RETAINER_MONTHLY_PRICE,
  RETAINER_SETUP_PRICE,
  RETAINER_SETUP_WITHOUT_FIX_PRICE,
  SOLUTIONS_PRICE,
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
    `What FootHold AEO costs: a free scan, ${SOLUTIONS_PRICE} for the fix list, ` +
    `${DONE_FOR_YOU_PRICE} for The Fix, and ${RETAINER_SETUP_PRICE} setup ` +
    `(${RETAINER_SETUP_WITHOUT_FIX_PRICE} without The Fix) plus ` +
    `${RETAINER_MONTHLY_PRICE} a month for Get Picked.`,
  alternates: {
    canonical: "/pricing",
    types: { "text/markdown": "/pricing.md" },
  },
};

const display = "font-display";

/**
 * The ladder, in order, matching the "How we help" PDF: the free scan, then
 * three steps. The $49 fix list is not in the PDF but is still sold on the
 * report page, so it stays listed between the scan and Step 1.
 *
 * `not` is the important column and the reason this reads as a reference rather
 * than a pitch: the fastest way to make a price legible is to say what it stops
 * at.
 */
const TIERS = [
  {
    id: "scan",
    step: "Start",
    name: "Free scan",
    price: "Free",
    cadence: "One off",
    lead: "See what AI can and can't see on your site.",
    gets: [
      "We run an AI through your website. It shows exactly what the AI can and can't see.",
      "Every problem, ranked worst first, with what each one costs you.",
      "You get the report free.",
    ],
    not: "It tells you what is wrong. It does not fix it.",
  },
  {
    id: "solutions",
    step: "Optional",
    name: "Scan solutions",
    price: SOLUTIONS_PRICE,
    cadence: "One off",
    lead: "The fix for every finding, written out.",
    gets: [
      "The specific change that clears each finding on your report.",
      "Ordered so the first hour of work moves the score most.",
      "Technical, so it is written for whoever does the hands-on work on your site.",
    ],
    not: "Nothing is implemented for you. That is The Fix.",
  },
  {
    id: "done-for-you",
    step: "Step 1",
    name: "The Fix",
    price: DONE_FOR_YOU_PRICE,
    cadence: "One time",
    lead: "Make AI able to read your site.",
    gets: [
      "We fix everything in the report so AI can read your site.",
      `${DONE_FOR_YOU_PRICE}, one time. No monthly fees. No contract.`,
      "Guarantee: delivered within 21 days of your kickoff call, or you get your money back.",
      `The ${DONE_FOR_YOU_PRICE} counts toward Step 2 if you continue.`,
      "Bonus: we also create a separate domain that's custom-built to give AI everything it needs to find you. When we're done, the domain is yours.",
    ],
    not: "It makes your site readable to AI. Getting AI to pick you is Step 2.",
  },
  {
    id: "retainer",
    step: "Step 2",
    name: "Get Picked",
    price: `${RETAINER_SETUP_PRICE} + ${RETAINER_MONTHLY_PRICE}/mo`,
    cadence: "6 month contract",
    lead: "Make AI choose you over competitors.",
    gets: [
      "Now AI can read your site. Next, we give it more reasons to pick you.",
      "Every month we add and spread content about your business, so AI sees you more often than your competitors.",
      `Setup: ${RETAINER_SETUP_PRICE} if you did The Fix (${RETAINER_SETUP_WITHOUT_FIX_PRICE} if you didn't).`,
      `Monthly: ${RETAINER_MONTHLY_PRICE}. Contract: 6 months.`,
    ],
    not: "Nobody controls what a model says, so this is not a promise that AI will pick you. It starts with a call, not a checkout.",
  },
  {
    id: "assistant",
    step: "Step 3",
    name: "Your AI Assistant",
    price: "Price TBD",
    cadence: "Setup + monthly upkeep",
    lead: "Handle the new customers for you.",
    gets: [
      "More customers means more questions and quote requests. That eats your day.",
      "We build a custom AI assistant that answers your most common questions and quote requests, 24/7.",
    ],
    not: "Pricing isn't set yet. Get in touch if you want it.",
  },
];

/** The PDF's "pricing at a glance" table. */
const AT_A_GLANCE = [
  ["Free scan", "Report: what AI can't see on your site", "$0", "$0"],
  ["Scan solutions", "The written fix for every finding", SOLUTIONS_PRICE, "$0"],
  ["1. The Fix", "AI can read your site", DONE_FOR_YOU_PRICE, "$0"],
  [
    "2. Get Picked",
    "AI recommends you over competitors",
    `${RETAINER_SETUP_PRICE} (${RETAINER_SETUP_WITHOUT_FIX_PRICE} without Step 1)`,
    RETAINER_MONTHLY_PRICE,
  ],
  ["3. AI Assistant", "AI answers customer questions and quotes", "TBD", "TBD"],
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
            People now ask AI (ChatGPT, Google Gemini, Microsoft Copilot) who to
            hire. If AI can&apos;t read your website, it struggles to recommend
            you. Foothold fixes that in three steps.
          </p>
          <p className="mt-4 max-w-[54ch] text-[17px] leading-relaxed text-[var(--muted)]">
            Start with the free scan. It shows what AI can&apos;t see on your
            site.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-px overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--line)]">
          {TIERS.map((tier) => (
            <div key={tier.id} id={tier.id} className="bg-[var(--bg)] p-6 sm:p-8">
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                {tier.step}
              </p>
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
            Pricing at a glance
          </h2>
          <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full min-w-[520px] text-left text-[15px]">
              <thead className="bg-[var(--panel)] font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dim)]">
                <tr>
                  <th className="px-4 py-3 font-bold">Step</th>
                  <th className="px-4 py-3 font-bold">What you get</th>
                  <th className="px-4 py-3 font-bold">Upfront</th>
                  <th className="px-4 py-3 font-bold">Monthly</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {AT_A_GLANCE.map(([step, gets, upfront, monthly]) => (
                  <tr key={step}>
                    <td className="px-4 py-3 font-semibold text-[var(--text)]">{step}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{gets}</td>
                    <td className="px-4 py-3 font-mono text-[var(--accent)]">{upfront}</td>
                    <td className="px-4 py-3 font-mono text-[var(--accent)]">{monthly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--dim)]">
            Step 1 is paid in full before work starts. If you cancel,{" "}
            {FIX_CANCEL_FEE} is non-refundable. Full{" "}
            <Link
              href="/terms"
              className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
            >
              terms
            </Link>
            .
          </p>
        </div>

        <div className="mt-14">
          <h2
            className={`${display} text-2xl font-black uppercase tracking-tight text-[var(--text)] sm:text-3xl`}
          >
            How to start
          </h2>
          <p className="mt-4 max-w-[60ch] text-[17px] leading-relaxed text-[var(--muted)]">
            Everything starts with the free scan. The fix list and The Fix are
            both built off your report. Run the scan, read what it says, and
            decide then.
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
