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
  title: "The 5 Levels of AI and the Prompts",
  description:
    "A guide for business owners: five levels of AI, the prompt that moves you up each one, and which of them you can paste today. Nine pages, free from Foothold Systems.",
  alternates: { canonical: "/guide" },
};

// display font utility (Archivo is loaded globally in layout.tsx)
const display = "font-[family-name:var(--font-archivo)]";

const levels = [
  {
    n: "01",
    title: "Chatting",
    line: "You ask, it answers. A better Google.",
    prompt: "The one-line ask",
    width: "22%",
    unlock: "Prompt inside",
    tag: null,
    locked: false,
  },
  {
    n: "02",
    title: "Working Together",
    line: "You hand over real work. It does the first draft.",
    prompt: "The 5-block prompt",
    width: "36%",
    unlock: "Prompt inside",
    tag: "The big unlock",
    locked: false,
  },
  {
    n: "03",
    title: "Building",
    line: "It makes you a small tool you could never have paid for.",
    prompt: "The build brief",
    width: "52%",
    unlock: "Build to unlock",
    tag: "The money is here",
    locked: true,
  },
  {
    n: "04",
    title: "Chaining",
    line: "A whole job runs across your systems, start to end.",
    prompt: "The chain map",
    width: "70%",
    unlock: "Build to unlock",
    tag: null,
    locked: true,
  },
  {
    n: "05",
    title: "Running a Team",
    line: "One helper per job, plus a boss helper to run them.",
    prompt: "The team spec",
    width: "88%",
    unlock: "Build to unlock",
    tag: null,
    locked: true,
  },
];

const inside = [
  {
    label: "The one-line ask",
    text: "Level 1's prompt, printed in full. A plain question gets a plain answer. Add who it is for and one rule, and the same free tool gets sharper on the spot.",
  },
  {
    label: "The 5-block prompt",
    text: "The same for Level 2, printed in full and then filled in on a real job: a three-year customer, an upset email, and a reply that keeps him. Fill in five blocks, paste the lot.",
  },
  {
    label: "The three locked frameworks",
    text: "The build brief, the chain map and the team spec, headings and all. You see the shape of Levels 3 to 5 before you commit to building one.",
  },
  {
    label: "The watch-outs",
    text: "Where your customer information is quietly going, the block of the prompt everyone skips, and the one job to write down before you automate anything.",
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

  // The same form, above the fold. It used to drop the name field here to keep
  // the ask to a single input on a phone; it no longer does, because this is the
  // form most people convert on and a name field it does not have is a name
  // nobody can give. Both instances are now identical, and kept as two constants
  // only because they render in two places on the page.
  const heroForm = (
    <LeadMagnetForm
      submitLabel={content.submitLabel}
      experimentId={experimentId}
      variant={variant}
      consentRequired={consentRequired}
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
              {/* The second half of the offer, and the line the new cover leads
                  with. Deliberately smaller than it is in print: on a phone this
                  sits between the headline and the email field, and every pixel
                  here pushes the field towards the fold. */}
              <p
                className={`${display} mt-2 text-sm font-extrabold uppercase leading-tight tracking-tight text-[#f6be00] sm:mt-4 sm:text-2xl`}
              >
                And the prompts that get you there
              </p>

              <p className="mt-4 max-w-xl font-serif text-lg leading-relaxed text-[#cfccc2] sm:mt-8 sm:text-xl">
                Everybody says you should use AI. Nobody hands you the prompts
                that actually work.{" "}
                <span className="font-semibold text-[#f2efe6]">
                  So here they are.
                </span>
                {/* The tail is desktop-only. On a phone every line here pushes
                    the email field closer to the fold, and the same promise is
                    made again beside the form lower down. */}
                <span className="hidden sm:inline">
                  {" "}
                  Two you can paste today. Three we build with you.
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
                        className={`h-full rounded-sm ${lvl.locked ? "bg-[#4a4a46]" : "bg-[#f6be00]"}`}
                        style={{ width: lvl.width }}
                      />
                    </div>
                    <span className="font-mono text-[10px] uppercase leading-tight tracking-[0.1em] text-[#cfccc2] sm:w-72 sm:shrink-0 sm:text-xs sm:tracking-[0.12em]">
                      {lvl.title}
                      <span className={lvl.locked ? "text-[#8a887f]" : "text-[#f6be00]"}>
                        {" "}
                        &middot; {lvl.prompt}
                        {lvl.locked && " (locked)"}
                      </span>
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
                Nine pages &middot; 2 prompts inside &middot; Free
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#f6be00] py-3">
          <p className="mx-auto max-w-5xl px-6 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#1b1b1b]">
            Levels 1 and 2 are in the guide. Levels 3 to 5 we build with you.
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
            Most AI guides hand a business owner twenty apps to go and try. The
            app was never the hard part. The prompt was.
          </p>
          <p>
            Here are five levels instead. Each answers one question:{" "}
            <span className="font-semibold">
              how much of the work happens while you are not watching?
            </span>{" "}
            The guide gives you both halves: the level, and the prompt that moves
            you up it. Take them one at a time. Jumping from Level 1 to Level 4
            is how owners end up with a mess to untangle and a bill for it.
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
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`inline-block px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] ${
                      lvl.locked
                        ? "border border-[#b9b6aa] text-[#57564f]"
                        : "bg-[#f6be00] text-[#1b1b1b]"
                    }`}
                  >
                    {lvl.unlock} &middot; {lvl.prompt}
                  </span>
                  {lvl.tag && (
                    <span className="inline-block bg-[#1b1b1b] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#f6be00]">
                      {lvl.tag}
                    </span>
                  )}
                </div>
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
            Levels 1 and 2 are things you paste, so the guide prints them in
            full. Levels 3 to 5 are not prompts you can paste, they are systems
            you build, so the guide prints the frameworks and stops there. The
            prompt is only half the job. The other half, the pick and the
            write-down and the wiring, is the part we do with you.
          </p>
          {/* Qualifying line. Sets the shape of the work early, so the people who
              go on to book already expect a build and an ongoing arrangement
              rather than an afternoon of app setup. */}
          <p className="mt-4 max-w-2xl font-serif text-[15px] leading-relaxed text-[#8a887f]">
            Written for owners of a business that already works: revenue coming
            in, staff to pay, more work than there is time for. It assumes you
            want this built properly and looked after once it&apos;s live.
          </p>
        </div>
      </section>

      {/* ============================= WHAT'S INSIDE ============================= */}
      <section className="border-t border-[#d4d1c6] bg-[#e2dfd4]">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#7a786f]">
            The contents
          </p>
          <h2 className={`${display} mt-3 text-3xl font-black uppercase leading-[0.98] tracking-tight sm:text-5xl`}>
            What the nine pages cover
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
                Send it over
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

      {/* ============================= A LOOK INSIDE (prompt teaser) =============================
          This section used to be a five-box self-scoring test. The prompts
          edition of the guide does not contain that test, so it is now the
          Level 2 prompt instead: the skeleton is printed here, the filled-in
          version and the other four prompts are in the PDF. Showing the real
          deliverable beats describing it, and this is the last thing a scroller
          reads before the final CTA. */}
      <section className="mx-auto max-w-4xl px-6 py-20">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#7a786f]">
          A look inside
        </p>
        <h2 className={`${display} mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl`}>
          The prompt
          <br />
          worth keeping
        </h2>
        <p className="mt-6 max-w-2xl font-serif text-lg leading-relaxed">
          Level 2 is where most of the time gets won. The difference between a
          shrug and a finished draft is almost never the tool, it is how you
          brief it. Five blocks, filled in and pasted as one. Here is the
          skeleton. In the guide it comes filled in on a real job, next to the
          one-liner for Level 1.
        </p>

        <div className="mt-10 border-2 border-[#1b1b1b] bg-[#1b1b1b] p-6 text-[#f2efe6] sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#f6be00]">
            The 5-block prompt
          </p>
          <dl className="mt-6 space-y-5">
            {[
              {
                block: "Role",
                fill: 'Act as a [who, e.g. "seasoned bookkeeper," "blunt marketing consultant"].',
              },
              {
                block: "Context",
                fill: "Here's what you need to know about my situation: [my business, the customer, the problem, any history a smart assistant would need].",
              },
              {
                block: "Task",
                fill: "I need you to [exactly what you want done, plainly].",
              },
              {
                block: "Constraints",
                fill: "[rules, limits, must-haves] · [anything to avoid] · Tone: [friendly / direct].",
              },
              {
                block: "Format",
                fill: "Give it to me as [a short email / a table / 3 options / a script I can read out loud].",
              },
            ].map((row) => (
              <div key={row.block} className="sm:flex sm:gap-6">
                <dt className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#f6be00] sm:w-32 sm:shrink-0 sm:pt-0.5">
                  {row.block}
                </dt>
                <dd className="mt-1 font-mono text-[13px] leading-relaxed text-[#cfccc2] sm:mt-0">
                  {row.fill}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 border-2 border-[#1b1b1b] bg-[#eae8e1] p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#7a786f]">
            The one block everyone skips
          </p>
          <p className="mt-3 max-w-2xl font-serif text-[15px] leading-relaxed text-[#3a3a35]">
            If you fill in only one, make it Context. The AI cannot see your
            business. Leave it blank and it fills the gap with a guess. Vague
            context in, vague answer out. When in doubt, over-explain, because
            trimming is the easy part.
          </p>
        </div>
      </section>

      {/* ============================= FINAL CTA ============================= */}
      <section className="border-t border-[#d4d1c6] bg-[#e2dfd4]">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="bg-[#1b1b1b] p-8 text-[#f2efe6] sm:p-12">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#f6be00]">
              Before you go
            </p>
            <h2 className={`${display} mt-3 text-3xl font-black uppercase leading-[0.98] tracking-tight sm:text-5xl`}>
              You&apos;ll have 1 and 2.
              <br />
              Let&apos;s unlock 3, 4, 5.
            </h2>
            <p className="mt-5 max-w-2xl font-serif text-lg leading-relaxed text-[#cfccc2]">
              The prompts in the guide are yours, and you should use them today.
              What a guide can&apos;t do is pick your first build, write your
              busiest job down so it can be automated, and wire it into the tools
              you already run. That part is different in every business.
            </p>

            <p className="mt-8 font-mono text-xs uppercase tracking-[0.18em] text-[#f6be00]">
              What the twenty minutes unlocks
            </p>
            <ul className="mt-4 max-w-2xl space-y-3">
              {[
                "Your real level, and the one thing holding you at it. Rarely what the owner guesses.",
                "Your first build. The one Level 3 tool worth making first, and the ones to skip.",
                "What the next level is worth to your business per month. A real number, not an average.",
              ].map((item) => (
                <li key={item} className="flex gap-3 font-serif text-[15px] leading-relaxed text-[#cfccc2]">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 bg-[#f6be00]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="border-2 border-[#1b1b1b] bg-[#eae8e1] p-6">
              <h3 className={`${display} text-xl font-extrabold uppercase tracking-tight`}>
                Build
              </h3>
              <p className="mt-2 font-serif text-[15px] leading-relaxed text-[#57564f]">
                We pick the tool, make it, wire it in, and hand it over with the
                write-down of how it works, so anyone you bring in later can pick
                it up. No black boxes. One-time, flat fee agreed before we start.
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
              Twenty minutes. We&apos;ll save you hours.
            </h3>
            <p className="mt-3 max-w-2xl font-serif text-[15px] leading-relaxed text-[#1b1b1b]/80">
              Tell us the job that keeps coming back. We&apos;ll tell you which
              level it belongs on, what to hand the AI, and what unlocking it is
              worth. No charge for the call whether you hire us or not.
            </p>
            <BookCallButton
              entryPoint="guide"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#1b1b1b] px-7 py-3.5 text-lg font-bold text-[#f2efe6] transition-colors hover:bg-[#2c2c29]"
            />
            {/* Says out loud who should not book. Twenty minutes is the scarce
                thing here, and a call that ends in "you just needed the guide"
                costs more than the lead was worth. */}
            <p className="mt-5 max-w-2xl font-serif text-[14px] leading-relaxed text-[#1b1b1b]/65">
              If what you want is someone to set your team up on ChatGPT for an
              afternoon, the two prompts in the guide really are all you need,
              and they cost nothing. The call is for owners who are ready to have
              something built and looked after properly.
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
