import type { Metadata } from "next";
import { LeadMagnetForm } from "@/components/LeadMagnetForm";
import { BookCallButton } from "@/components/BookCallButton";
import { GuideCover } from "@/components/GuideCover";
import { StickyGuideCta } from "@/components/StickyGuideCta";
import { headers } from "next/headers";
import { CroTracker } from "@/components/CroTracker";
import { getActiveVariant } from "@/lib/cro/serve";
import { consentMayBeRequired, countryFromHeaders } from "@/lib/geo";

// Copy on this page is served per-visitor by the CRO engine, so it can't be
// prerendered. With no experiment running it renders the shipped copy.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The 5 Levels of AI",
  description:
    "The plain-English guide for business owners: five levels of AI, find yours in ten minutes, then find out what staying there is costing you. Free from Foothold Systems.",
  alternates: { canonical: "/guide" },
};

// display font utility (Archivo is loaded globally in layout.tsx)
const display = "font-[family-name:var(--font-archivo)]";

const levels = [
  {
    n: "01",
    title: "Chatting",
    line: "A better Google. You ask, it answers.",
    width: "22%",
    tag: "You are here",
    money: false,
  },
  {
    n: "02",
    title: "Working Together",
    line: "You hand it real work. It does the first draft.",
    width: "36%",
    tag: null,
    money: false,
  },
  {
    n: "03",
    title: "Building",
    line: "It makes you a small tool you could never have paid for.",
    width: "52%",
    tag: "The money is here",
    money: true,
  },
  {
    n: "04",
    title: "Chaining",
    line: "A whole job runs start to finish. Nobody presses go.",
    width: "70%",
    tag: null,
    money: false,
  },
  {
    n: "05",
    title: "Running a Team",
    line: "You give a goal, not steps. Helpers work at once and report back.",
    width: "88%",
    tag: null,
    money: false,
  },
];

const inside = [
  {
    label: "The five levels",
    text: "Each one in plain English: what it looks like on a normal Tuesday, what it gets you, and how you know you've outgrown it.",
  },
  {
    label: "The 2-minute test",
    text: "A five-box checklist that tells you the level you're really on, not the one you wish you were on.",
  },
  {
    label: "Watch-outs & apps",
    text: "The real tools at each level, what they cost, and the trap most owners fall into before they hit it.",
  },
  {
    label: "What moving up is worth",
    text: "Going from Level 1 to Level 3 usually frees five to fifteen hours a week across a team. Here's why, and how to work out your own number.",
  },
];

export default async function GuidePage() {
  const { content, experimentId, variant, visitorId } =
    await getActiveVariant("/guide");

  // The tick is required in the US and optional where GDPR applies, so the page
  // has to know where the visitor is before it renders the form.
  const consentRequired = consentMayBeRequired(
    countryFromHeaders(await headers())
  );

  const captureForm = (
    <LeadMagnetForm
      submitLabel={content.submitLabel}
      experimentId={experimentId}
      variant={variant}
      consentRequired={consentRequired}
    />
  );

  // Same form, minus the optional name field. Above the fold the only job is to
  // be answerable without thinking.
  const heroForm = (
    <LeadMagnetForm
      submitLabel={content.submitLabel}
      experimentId={experimentId}
      variant={variant}
      consentRequired={consentRequired}
      compact
    />
  );

  return (
    <div className="bg-[#eae8e1] text-[#1f1f1d]">
      {visitorId && (
        <CroTracker
          experimentId={experimentId}
          variant={variant}
          visitorId={visitorId}
          pagePath="/guide"
        />
      )}
      {/* ============================= HERO (dark cover) =============================
          Paid traffic lands here, overwhelmingly on a phone. Everything above the
          form is on a budget: the email field has to be reachable without
          scrolling on a small handset, so the hero runs eyebrow, headline, three
          lines, form — and the ladder chart moves below the form rather than
          pushing it under the fold. */}
      <section className="bg-[#1b1b1b] text-[#f2efe6]">
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-6 sm:pb-20 sm:pt-16">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-16">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#f6be00]">
                Free guide &nbsp;&middot;&nbsp; Foothold Systems
              </p>
              {/* Who it's for, at the top rather than buried. This costs opt-ins
                  on purpose: the work being sold is a build plus a retainer, and
                  a list full of people who wanted an afternoon of app setup is
                  worse than a shorter list. Kept to one line at 375px so it does
                  not push the form under the fold — check that before rewording. */}
              <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#8a887f]">
                For a business that already works
              </p>

              <h1
                className={`${display} mt-4 text-6xl font-black uppercase leading-[0.92] tracking-tight sm:mt-8 sm:text-8xl`}
              >
                The 5 Levels
                <br />
                of <span className="text-[#f6be00]">AI</span>
              </h1>

              <p className="mt-4 max-w-xl font-serif text-lg leading-relaxed text-[#cfccc2] sm:mt-8 sm:text-xl">
                Everybody says you should use AI. Nobody says what that actually
                means.{" "}
                <span className="font-semibold text-[#f2efe6]">
                  This is the plain English version.
                </span>
                {/* The tail is desktop-only. On a phone every line here pushes
                    the email field closer to the fold, and the same promise is
                    made again beside the form lower down. */}
                <span className="hidden sm:inline">
                  {" "}
                  Five levels. Find yours in ten minutes. Then find out what
                  staying there is costing you.
                </span>
              </p>

              <div id="hero-capture" className="mt-7 max-w-xl scroll-mt-24 sm:mt-9">
                {heroForm}
              </div>

              {/* The ladder, in miniature. Labels show at every width — without
                  them a phone got five unlabelled bars, which is decoration
                  standing between the pitch and the form. */}
              <div className="mt-12 space-y-3">
                {[...levels].reverse().map((lvl) => (
                  <div key={lvl.n} className="flex items-center gap-3 sm:gap-4">
                    <span className="w-6 shrink-0 font-mono text-xs text-[#8a887f] sm:text-sm">
                      {lvl.n}
                    </span>
                    <div className="h-3 w-24 shrink-0 overflow-hidden rounded-sm bg-[#2c2c29] sm:h-3.5 sm:w-auto sm:flex-1">
                      <div
                        className={`h-full rounded-sm ${lvl.money || lvl.n === "01" ? "bg-[#f6be00]" : "bg-[#4a4a46]"}`}
                        style={{ width: lvl.width }}
                      />
                    </div>
                    <span className="font-mono text-[10px] uppercase leading-tight tracking-[0.1em] text-[#cfccc2] sm:w-64 sm:shrink-0 sm:text-xs sm:tracking-[0.12em]">
                      {lvl.title}
                      {lvl.tag && (
                        <span className="text-[#f6be00]"> &middot; {lvl.tag}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* The deliverable, shown rather than described. Desktop only — on a
                phone it would sit between the headline and the form. */}
            <div className="hidden lg:block">
              {/* The cover is the same near-black as the hero behind it, so the
                  edge has to come from the ring, not from contrast. */}
              <GuideCover className="w-full rounded-lg shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)] ring-1 ring-[#55534c]" />
              <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[#8a887f]">
                Nine pages &middot; PDF &middot; Free
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#f6be00] py-3">
          <p className="mx-auto max-w-5xl px-6 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#1b1b1b]">
            The map is free. Your step takes one call.
          </p>
        </div>
      </section>

      {/* ============================= THE LADDER ============================= */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#7a786f]">
          Start here
        </p>
        <h2 className={`${display} mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl`}>
          Five levels,
          <br />
          one at a time
        </h2>

        <div className="mt-8 max-w-2xl space-y-4 font-serif text-lg leading-relaxed">
          <p>
            Most AI guides hand a business owner twenty apps. The app was
            never the hard part.
          </p>
          <p>
            Here are five levels instead. Each answers one question:{" "}
            <span className="font-semibold">
              how much of the work happens while you are not watching?
            </span>{" "}
            Go one level at a time. People who jump from Level 1 to Level 4 land
            on a mess and a bill.
          </p>
        </div>

        <div className="mt-12 divide-y divide-[#d4d1c6] border-y border-[#d4d1c6]">
          {levels.map((lvl) => (
            <div key={lvl.n} className="flex flex-col gap-3 py-6 sm:flex-row sm:items-start sm:gap-8">
              <span className="font-mono text-sm text-[#7a786f] sm:w-10 sm:pt-1">{lvl.n}</span>
              <div className="hidden h-3 w-40 shrink-0 overflow-hidden rounded-sm bg-[#d4d1c6] sm:mt-1 sm:block">
                <div className="h-full bg-[#f6be00]" style={{ width: lvl.width }} />
              </div>
              <div className="flex-1">
                <h3 className={`${display} text-2xl font-extrabold uppercase tracking-tight`}>
                  {lvl.title}
                </h3>
                <p className="mt-1 font-serif text-[15px] leading-relaxed text-[#57564f]">
                  {lvl.line}
                </p>
                {lvl.money && (
                  <span className="mt-3 inline-block bg-[#1b1b1b] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#f6be00]">
                    Best payoff &middot; Almost nobody is here
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* dark short-version callout */}
        <div className="mt-12 bg-[#1b1b1b] p-8 text-[#f2efe6] sm:p-10">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#f6be00]">
            The short version
          </p>
          <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-[#e6e3d9]">
            Most businesses are on Level 1. Almost nobody is on Level 3, the
            one that pays. Read the guide and you know your level. Call us and you
            know your number.
          </p>
          {/* Qualifying line. Sets the shape of the work early, so the people who
              go on to book already expect a build and an ongoing arrangement
              rather than an afternoon of app setup. */}
          <p className="mt-4 max-w-2xl font-serif text-[15px] leading-relaxed text-[#8a887f]">
            Written for owners of a business that already works — real revenue,
            real staff, real load — who want this built properly and looked after
            once it&apos;s live.
          </p>
        </div>
      </section>

      {/* ============================= WHAT'S INSIDE ============================= */}
      <section className="border-t border-[#d4d1c6] bg-[#e2dfd4]">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#7a786f]">
            What&apos;s inside
          </p>
          <h2 className={`${display} mt-3 text-3xl font-black uppercase leading-[0.98] tracking-tight sm:text-5xl`}>
            Nine pages. No fluff.
          </h2>

          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {inside.map((item) => (
              <div key={item.label} className="border-t-2 border-[#1b1b1b] pt-5">
                <h3 className="font-mono text-sm font-bold uppercase tracking-[0.1em] text-[#1b1b1b]">
                  {item.label}
                </h3>
                <p className="mt-3 font-serif text-[15px] leading-relaxed text-[#57564f]">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================= GET THE GUIDE (capture) ============================= */}
      <section id="get-the-guide" className="scroll-mt-24 bg-[#1b1b1b]">
        <div className="mx-auto max-w-4xl px-6 py-20 sm:py-24">
          <div className="grid gap-10 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-start sm:gap-12">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#f6be00]">
                The map is free
              </p>
              <h2 className={`${display} mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight text-[#f2efe6] sm:text-5xl`}>
                {content.captureHeading}
              </h2>
              <p className="mt-5 font-serif text-lg leading-relaxed text-[#cfccc2]">
                {content.captureSubcopy}
              </p>
            </div>

            {/* Shown at every width down here. Anyone this far down the page has
                already spent the scroll the hero was protecting. */}
            <GuideCover className="mx-auto w-40 rounded-lg shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)] ring-1 ring-[#55534c] sm:w-full" />
          </div>

          <div
            id="capture-form-bottom"
            className="mt-10 rounded-2xl border border-[#33332f] bg-[#232320] p-6 sm:p-8"
          >
            {captureForm}
          </div>
        </div>
      </section>

      {/* ============================= SO WHERE ARE YOU? (teaser) ============================= */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#7a786f]">
          Two minutes
        </p>
        <h2 className={`${display} mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl`}>
          So where are you?
        </h2>
        <p className="mt-6 max-w-2xl font-serif text-lg leading-relaxed">
          Be honest. The question isn&apos;t &ldquo;has anyone here ever tried it
          once.&rdquo; It&apos;s &ldquo;is this how we work on a normal
          Tuesday.&rdquo; The full five-box test is in the guide. Here&apos;s the
          shape of it:
        </p>

        <ul className="mt-10 space-y-4">
          {[
            "Someone here uses an AI chat box most days instead of searching the web.",
            "We hand it real work, our files and our paperwork, and use what comes back.",
            "There is at least one tool running in this business that AI helped us build.",
            "There is at least one job that finishes without anybody pressing go.",
            "We give goals, not steps. We check the results.",
          ].map((q, i) => (
            <li key={i} className="flex items-start gap-4 border-b border-[#d4d1c6] pb-4">
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-[3px] border-2 border-[#1b1b1b]" />
              <span className="font-mono text-sm text-[#7a786f]">0{i + 1}</span>
              <span className="font-serif text-[15px] leading-relaxed text-[#3a3a35]">{q}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 bg-[#1b1b1b] p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#f6be00]">
            How to score it
          </p>
          <p className="mt-3 max-w-2xl font-serif text-[15px] leading-relaxed text-[#e6e3d9]">
            Your real level is the highest box you checked where every box below
            it is checked too. Skipped levels are why most of these projects
            quietly die. The guide walks you through it.
          </p>
        </div>
      </section>

      {/* ============================= FINAL CTA ============================= */}
      <section className="border-t border-[#d4d1c6] bg-[#e2dfd4]">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="bg-[#1b1b1b] p-8 text-[#f2efe6] sm:p-12">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#f6be00]">
              The next step
            </p>
            <h2 className={`${display} mt-3 text-3xl font-black uppercase leading-[0.98] tracking-tight sm:text-5xl`}>
              You know your level.
              <br />
              Now get your number.
            </h2>
            <p className="mt-5 max-w-2xl font-serif text-lg leading-relaxed text-[#cfccc2]">
              Everything in the guide you can do on your own, and you should start
              today. What a guide can&apos;t give you is which move is yours and
              what it&apos;s worth. That takes twenty minutes with us.
            </p>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="border-2 border-[#1b1b1b] bg-[#eae8e1] p-6">
              <h3 className={`${display} text-xl font-extrabold uppercase tracking-tight`}>
                Build
              </h3>
              <p className="mt-2 font-serif text-[15px] leading-relaxed text-[#57564f]">
                We make the tool. We write down how it works and hand it over. No
                black boxes. One-time, flat fee agreed up front.
              </p>
            </div>
            <div className="border-2 border-[#1b1b1b] bg-[#eae8e1] p-6">
              <h3 className={`${display} text-xl font-extrabold uppercase tracking-tight`}>
                Embed
              </h3>
              <p className="mt-2 font-serif text-[15px] leading-relaxed text-[#57564f]">
                We stay on and look after the AI side of your business, like we
                would a network. Ongoing, on a retainer.
              </p>
            </div>
          </div>

          <div className="mt-6 bg-[#f6be00] p-8 text-[#1b1b1b] sm:p-10">
            <h3 className={`${display} text-2xl font-black uppercase tracking-tight sm:text-3xl`}>
              Twenty minutes. Bring your level.
            </h3>
            <p className="mt-3 max-w-2xl font-serif text-[15px] leading-relaxed text-[#1b1b1b]/80">
              Tell us the level you landed on. We&apos;ll tell you what we usually
              find there, and what it costs businesses like yours. Free,
              whether or not you hire us.
            </p>
            <BookCallButton
              entryPoint="guide"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#1b1b1b] px-7 py-3.5 text-lg font-bold text-[#f2efe6] transition-colors hover:bg-[#2c2c29]"
            />
            {/* Says out loud who should not book. Twenty minutes is the scarce
                thing here, and a call that ends in "you just needed the guide"
                costs more than the lead was worth. */}
            <p className="mt-5 max-w-2xl font-serif text-[14px] leading-relaxed text-[#1b1b1b]/65">
              Worth saying plainly: if what you want is someone to set your team
              up on ChatGPT for an afternoon, the guide really is all you need,
              and it&apos;s free. The call is for owners ready to have something
              built and looked after properly.
            </p>
          </div>

          <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-[#7a786f]">
            Foothold Systems &middot; AI for Business
          </p>
        </div>
      </section>

      {/* Keeps the last of the footer clear of the sticky bar at full scroll. */}
      <div className="h-20 sm:hidden" aria-hidden="true" />

      <StickyGuideCta
        label={content.heroCtaLabel}
        watchIds={["hero-capture", "capture-form-bottom"]}
      />
    </div>
  );
}
