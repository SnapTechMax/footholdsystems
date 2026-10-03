import type { Metadata } from "next";
import Link from "next/link";
import {
  DONE_FOR_YOU_PRICE,
  FIX_CANCEL_FEE,
  RETAINER_MONTHLY_PRICE,
  RETAINER_SETUP_PRICE,
  RETAINER_SETUP_WITHOUT_FIX_PRICE,
  SOLUTIONS_PRICE,
} from "@/lib/scan/pricing";
import { BUSINESS_ADDRESS, CONTACT_EMAIL } from "@/lib/site";

/**
 * Terms.
 *
 * The plain-English terms behind every price on /pricing. Written only from
 * terms Max has set: the prices, the 21 day guarantee counted from the kickoff
 * call, the cancellation fee, access by invite, and the no-ranking promise.
 * Anything not decided yet is left out rather than guessed at.
 *
 * Not legal advice, and not reviewed by a lawyer. Every figure comes from
 * lib/scan/pricing.ts, so a price change reaches this page on its own.
 */

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Payment, the 21 day guarantee, cancellation, access and what FootHold AEO does not promise.",
  alternates: { canonical: "/terms" },
};

const display = "font-display";

const SECTIONS: { title: string; body: React.ReactNode[] }[] = [
  {
    title: "The free scan",
    body: [
      "Free. No card, no call.",
      "We run an AI through your website and report what it can and can't see. The search it runs is cold: no login, no history, no location. Your own searches may look different, because your browser knows who you are.",
    ],
  },
  {
    title: `Scan solutions, ${SOLUTIONS_PRICE}`,
    body: [
      "One payment. The written fix for every finding unlocks on your report straight away.",
      "You or whoever runs your site does the work. We don't implement anything at this tier.",
    ],
  },
  {
    title: `Step 1: The Fix, ${DONE_FOR_YOU_PRICE}`,
    body: [
      `${DONE_FOR_YOU_PRICE}, one time. No monthly fees. No contract. Paid in full before work starts.`,
      "We fix everything in your scan report so AI can read your site.",
      "Guarantee: delivered within 21 days of your kickoff call, or you get your money back. The 21 days start on the day of the call.",
      `If you cancel, ${FIX_CANCEL_FEE} is non-refundable. The rest is refunded.`,
      `Bonus: we also create a separate domain built for AI to find you. When we're done, the domain is yours.`,
      `The ${DONE_FOR_YOU_PRICE} counts toward Step 2 if you continue.`,
    ],
  },
  {
    title: "Access to your accounts",
    body: [
      "We ask for access through each platform's own invite, under our own login. We never ask for your passwords.",
      "You can revoke our access in one click when the work is done.",
    ],
  },
  {
    title: "Step 2: Get Picked",
    body: [
      `Setup is ${RETAINER_SETUP_PRICE} if you did The Fix, or ${RETAINER_SETUP_WITHOUT_FIX_PRICE} if you didn't. Then ${RETAINER_MONTHLY_PRICE} a month.`,
      "6 month contract. It starts with a call, and we agree it before anything is signed.",
    ],
  },
  {
    title: "Step 3: Your AI Assistant",
    body: ["Not for sale yet. Pricing hasn't been set."],
  },
  {
    title: "What we don't promise",
    body: [
      "No one controls what a language model says. We don't promise a specific ranking, placement, or recommendation in ChatGPT or any other AI tool. Results vary by business, category, and market.",
      "FootHold Systems is independent. We're not affiliated with OpenAI, Google, Microsoft, Perplexity, or Anthropic.",
    ],
  },
  {
    title: "Payments",
    body: [
      "All prices are in US dollars. Card payments go through Whop. We never see or store your card details.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="bg-[var(--bg)] text-[var(--text)]">
      <section className="bg-[var(--ink)] text-[var(--text)]">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
            FootHold Systems
          </p>
          <h1
            className={`${display} mt-4 text-5xl font-black uppercase leading-[0.94] tracking-tight sm:text-7xl`}
          >
            Terms
          </h1>
          <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-[var(--muted)]">
            What you pay, what you get, and what we don&apos;t promise. Prices
            are also on{" "}
            <Link
              href="/pricing"
              className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
            >
              the pricing page
            </Link>
            .
          </p>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-[var(--dim)]">
            Last updated 3 October 2026
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-12">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2
                className={`${display} text-2xl font-black uppercase tracking-tight text-[var(--text)] sm:text-3xl`}
              >
                {section.title}
              </h2>
              <div className="mt-4 space-y-3 text-[17px] leading-relaxed text-[var(--muted)]">
                {section.body.map((line, i) => (
                  <p key={i} className="max-w-[62ch]">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}

          <div>
            <h2
              className={`${display} text-2xl font-black uppercase tracking-tight text-[var(--text)] sm:text-3xl`}
            >
              Questions
            </h2>
            <p className="mt-4 max-w-[62ch] text-[17px] leading-relaxed text-[var(--muted)]">
              Email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-[var(--accent)] underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
              . FootHold Systems, {BUSINESS_ADDRESS}, United States.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
