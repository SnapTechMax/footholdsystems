import type { Metadata } from "next";
import { ScanCta } from "@/components/ScanCta";
import { ScanForm } from "@/components/ScanForm";
import {
  breadcrumbSchema,
  faqSchema,
  jsonLdGraph,
  organizationSchema,
  serviceSchema,
  webSiteSchema,
} from "@/lib/schema";

/**
 * FootHold AEO — the sales page.
 *
 * One page, one offer, one call to action. Cold Meta traffic lands here from an
 * ad about AI visibility, so the page has to do the whole job: name the shift,
 * make the loss feel real, explain a mechanism credible enough to justify
 * hiring someone, kill the objections, and hand over a free scan.
 *
 * Structure is deliberate and shouldn't be shuffled casually — it runs
 * problem → why your current fix fails → mechanism → system → proof of
 * difference → objections → qualification → offer. Moving the mechanism after
 * the offer, for instance, asks people to buy before they believe the problem
 * is solvable.
 *
 * Copy lives in the data blocks at the top rather than inline in the markup.
 * That is the half of this file that will actually get edited, and it should be
 * editable without touching a single class name.
 */

/* ------------------------------------------------------------------ COPY -- */

const ANSWER_ENGINES = [
  "ChatGPT",
  "Google AI Overviews",
  "Gemini",
  "Perplexity",
  "Microsoft Copilot",
  "Claude",
];

const SHIFT_BODY = [
  "For twenty years, being hard to find was a problem you could lose slowly.",
  "Google handed people ten results. Number one got the most clicks, sure. But number four got clicks. Number seven got clicks. If you slipped a place, you bled a little, and you had time to notice and react.",
  "That page is going away.",
  "Someone opens ChatGPT and types “who’s the best commercial roofer in Phoenix?” It does not return a list of ten. It returns a paragraph. A name. A reason to call them. Often a phone number and a link.",
];

const SHIFT_BODY_2 = [
  "And here is the part that should actually keep you up: you will never know it happened.",
  "No impression. No bounce. No line in Google Analytics that says “lost to an AI recommendation.” There is no ranking report for this. You cannot open a dashboard and see how many people asked an assistant about your category this month and got told about somebody else.",
];

const SEO_BODY = [
  "Let me be careful here, because this gets misread constantly.",
  "Your SEO is not worthless. If you have built real rankings, you are ahead of most of your competitors and you have assets we can use. But it was built to win a different game, and it does not automatically carry over.",
  "Google ranks pages. Its entire job is to answer one question: which URL best matches this string of words?",
  "Language models do not rank pages. They recommend entities: businesses, brands, named things they have formed an opinion about from everything they have ever read.",
  "Those are not the same question. Ranking number one for “plumber in Dallas” does not make a model believe you are the plumber to call in Dallas. One is a document-matching problem. The other is a reputation problem.",
];

/** Left column is the world your marketing was built for; right is the one it's in now. */
const CONTRAST = [
  { google: "Returns ten links", ai: "Returns one recommendation" },
  { google: "Ranks pages", ai: "Recommends businesses" },
  { google: "Matches keywords", ai: "Weighs consensus about you" },
  { google: "You can check your position", ai: "You never see the loss" },
  { google: "Clicks get spread around", ai: "One business gets the customer" },
];

const SIGNALS = [
  {
    n: "01",
    title: "Can it actually read you?",
    lead: "Most business websites are functionally invisible to an AI crawler.",
    body: "Content painted in by JavaScript. No structured data. Services described in slogans instead of sentences. The facts that decide whether you fit a question (what you do, where, for whom, how fast, how much) sitting inside an image, a PDF, or nowhere at all. The crawler arrives, finds nothing it can quote, and leaves. You were never in the running.",
    punch: "You did not lose. You were never entered.",
  },
  {
    n: "02",
    title: "Does the rest of the web agree?",
    lead: "A model does not trust your website about your website.",
    body: "It trusts consensus, meaning what independent sources say about you. Directories, review platforms, industry listings, local press, forums, other people’s pages, citations in places you have never visited. If the internet is quiet about your business, the model has nothing to form an opinion from.",
    punch: "The web's silence about you becomes the model's answer.",
  },
  {
    n: "03",
    title: "Are you specific enough to recommend?",
    lead: "“Quality work, customer-first approach” gives a model nothing to do.",
    body: "It cannot slot that into an answer, because it matches every business and therefore none. But “we replace commercial rooftop HVAC units under 25 tons across Riverside County, usually within five business days” is a machine-readable trigger. The second someone describes that exact situation, you are the obvious answer.",
    punch: "Vague businesses are not disliked. They are unrecommendable.",
  },
  {
    n: "04",
    title: "Are you still there?",
    lead: "These systems increasingly go and fetch live results mid-answer.",
    body: "They do not rely only on what they were trained on months ago. Which means a stale, thin, unanswerable site gets skipped at the moment of retrieval even when the brand is already known to the model. The seat is not permanent, and it is not one you win once.",
    punch: "Training data gets you known. Retrieval gets you named.",
  },
];

const PHASES = [
  {
    n: "01",
    label: "Measure",
    body: "We run your business through the models your customers actually use, against the questions they actually type. Dozens of real buying prompts in your category and your service area. We record who gets named, how often, in whose words, and exactly where you get dropped. That is your baseline, and for most people it is the moment this stops being theoretical.",
  },
  {
    n: "02",
    label: "Rebuild",
    body: "We restructure your site so a machine can understand what your business is, not just read what your pages say. Entity and service schema, answer-shaped content mapped to real questions, plain crawlable facts, the specifics from signal 03 written where they can be lifted and quoted. Most of this work is invisible to humans and decisive for models.",
  },
  {
    n: "03",
    label: "Align",
    body: "Your listings are made to agree with each other. Google Business Profile, the directories that carry weight in your trade, the profiles you already have. Same name, same address format, same phone, same claims, everywhere. This is not link building and it is not new mentions; it is the ones you already own, made consistent, because a model checking whether you are real treats disagreement as doubt. Unglamorous, and it moves more than it has any right to.",
  },
  {
    n: "04",
    label: "Build",
    body: "Then we build you a second site, on its own domain, separate from your main one. Your website already has a job: sell to people, carry your brand, look the way you want it to look. Every one of those pulls against being maximally readable to a machine, which is why fixing an existing site is always a compromise between two audiences. The second domain has one audience. It sits where models go looking, structured the way they want, saying what they need in order to recommend you, with none of the compromises. It does not have to look like anything. It has to be findable and unambiguous.",
  },
];

/**
 * Comparison rows. `no` / `seo` / `aeo` are what each option actually delivers:
 * true, false, or a short qualifier string for the honest half-answers.
 */
const COMPARE = [
  { row: "Shows up in Google’s blue links", no: false, seo: true, aeo: true },
  { row: "Shows up when AI is asked who to hire", no: false, seo: "By luck", aeo: true },
  { row: "Tells you what AI says about you today", no: false, seo: false, aeo: true },
  { row: "Fixes how machines read your site", no: false, seo: "Partly", aeo: true },
  { row: "Makes your listings agree with each other", no: false, seo: "Partly", aeo: true },
  { row: "Builds a site aimed at machines, not people", no: false, seo: false, aeo: true },
  { row: "Works before your competitors do it", no: false, seo: false, aeo: true },
];

const OBJECTIONS = [
  {
    q: "Isn’t this too early?",
    a: [
      "It is the same instinct that made “we don’t really need a website” sound reasonable in 1999, and “we’re not paying Google for clicks we’d get free” sound reasonable in 2005. Both were survivable positions, for about three years.",
      "But there is a difference this time, and it is the whole argument. The businesses being recommended today are the ones being written into the consensus these models keep learning from. Early is not a small edge in this channel. It compounds, and it is slow to displace once someone else owns it.",
    ],
  },
  {
    q: "Can you guarantee ChatGPT will recommend me?",
    a: [
      "No. Nobody can, and anyone who tells you otherwise is either lying to you or does not understand what they are selling. No agency controls the output of a language model.",
      "What we control is every input the model uses to make that decision, all four signals, and we can show movement on it with the same prompts run month after month against the same competitors. If a vendor promises you a guaranteed number one in ChatGPT, walk away and keep your money.",
    ],
  },
  {
    q: "I already rank number one on Google.",
    a: [
      "Then you have the most to lose and the shortest distance to travel. You already have the authority, the content and the mentions. Usually what is missing is structure and specificity, the machine-readable half nobody has done yet.",
      "Businesses in your position tend to move fastest of anyone. Which is exactly why you do not want the competitor at number four running their scan before you run yours.",
    ],
  },
  {
    q: "Won’t AI just work out who is genuinely best?",
    a: [
      "It already tried. It formed an opinion from whatever it could find, which for most businesses is a thin website, an unclaimed directory listing and a lot of silence.",
      "It is not rewarding the best operator. It is rewarding the best-documented one. Those are very different things, and only one of them is under your control.",
    ],
  },
  {
    q: "Can’t I just do this myself?",
    a: [
      "Some of it, yes, and the scan will show you what is broken whether you hire us or not. That is not a trick; a business that reads the report and fixes it alone is a fine outcome for us.",
      "The parts that are genuinely hard to do yourself are knowing which of the four signals is actually costing you the answer, and rebuilding your site’s structure for machines without breaking the human rankings you already have.",
    ],
  },
];

const FOR_YOU = [
  "You sell something with real margin, where one new customer is worth hundreds or thousands, not twelve dollars.",
  "Your customers research before they buy, rather than grabbing whatever is nearest.",
  "You have a real business behind you: actual customers, actual reviews, actual work to point at.",
  "You would rather move now, while your category is still empty, than after it is crowded.",
];

const NOT_FOR_YOU = [
  "You want a guaranteed number one spot in ChatGPT by Friday.",
  "You would rather wait until it is fully proven and everyone in your market is already doing it.",
  "Your site is brand new with no business, reviews or history behind it yet.",
  "You want a report to file away, not changes made to your site.",
];

/**
 * What the free scan actually returns.
 *
 * Kept deliberately in step with what the report can really produce — see
 * lib/scan/report.ts. An earlier draft promised competitor names and a score
 * against the four signals above; the scan delivers neither, and a landing page
 * that oversells the deliverable buys refunds on the paid upgrade rather than
 * customers.
 */
const SCAN_DELIVERS = [
  "Your AI visibility score out of 100: how readable, clear and recommendable your site is to an AI right now.",
  "Every place your site is invisible or ambiguous to an assistant, ranked worst first.",
  "What each one is actually costing you, in plain English rather than in jargon.",
  "Whether an AI can even confirm your business is real when it goes looking for you by name.",
];

const FAQS = [
  {
    q: "What exactly do I get from the free scan?",
    a: "A written report showing what the major answer engines currently say about your business when someone asks for a recommendation in your category, who they name instead, and which of the four signals is holding you back. No call required to receive it.",
  },
  {
    q: "How long does it take to see movement?",
    a: "The site-side work shows up fastest, because retrieval picks up changes to a page far quicker than a model’s training does. The second domain takes a little longer to be found and is the more durable half. Nobody honest will give you a date, because nobody controls when a model next looks.",
  },
  {
    q: "Do I have to stop doing SEO?",
    a: "No, and you should not. Traditional search is not disappearing this year, and much of what makes you credible to Google also makes you credible to a model. This is an additional channel, built on top of what you already have.",
  },
  {
    q: "Does this work for local service businesses?",
    a: "It works best for them. Local recommendation questions (who should I call, who is good, who does this near me) are exactly the shape of query people have moved to AI fastest for, and local categories are the emptiest right now.",
  },
  {
    q: "Is there a contract?",
    a: "We will cover terms on a call if the scan shows something worth acting on. Nothing about the scan itself commits you to anything.",
  },
];

/* -------------------------------------------------------------- PRIMITIVES -- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
      {children}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-5 text-balance font-display text-[2.1rem] font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-6xl">
      {children}
    </h2>
  );
}

/** Body paragraph. Deliberately narrow measure — long lines kill long copy. */
function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 max-w-[46ch] text-[17px] leading-[1.65] text-[var(--muted)] sm:text-[19px] sm:leading-[1.6]">
      {children}
    </p>
  );
}

/**
 * The one-line hammer that follows a paragraph. Set larger and lighter than
 * body copy so a skimmer who reads nothing else still collects the argument.
 * Rationed on purpose: if everything is a punch line, nothing is.
 */
function Punch({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-7 max-w-[24ch] font-display text-2xl font-extrabold uppercase leading-[1.05] tracking-[-0.01em] text-[var(--text)] sm:text-4xl">
      {children}
    </p>
  );
}

function Callout({
  label,
  children,
  tone = "accent",
}: {
  label: string;
  children: React.ReactNode;
  tone?: "accent" | "danger";
}) {
  const bar = tone === "danger" ? "bg-[var(--danger)]" : "bg-[var(--accent)]";
  const text =
    tone === "danger" ? "text-[var(--danger)]" : "text-[var(--accent)]";
  return (
    <div className="mt-10 flex max-w-[54ch] gap-4 rounded-r-lg bg-[var(--panel)] p-6 sm:gap-5 sm:p-7">
      <div className={`w-1 shrink-0 rounded-full ${bar}`} aria-hidden="true" />
      <div>
        <p
          className={`font-mono text-[11px] font-bold uppercase tracking-[0.18em] ${text}`}
        >
          {label}
        </p>
        <p className="mt-3 text-[16px] leading-[1.6] text-[var(--muted)] sm:text-[17px]">
          {children}
        </p>
      </div>
    </div>
  );
}

function Section({
  id,
  children,
  tone = "bg",
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  tone?: "bg" | "ink";
  className?: string;
}) {
  const ground = tone === "ink" ? "bg-[var(--ink)]" : "bg-[var(--bg)]";
  return (
    <section
      id={id}
      className={`scroll-mt-20 border-t border-[var(--line)] ${ground} ${className}`}
    >
      <div className="mx-auto max-w-3xl px-5 py-20 sm:px-6 sm:py-28">
        {children}
      </div>
    </section>
  );
}

function Check({ on }: { on: boolean }) {
  return on ? (
    <span className="text-[var(--accent)]" aria-label="Yes">
      &#10003;
    </span>
  ) : (
    <span className="text-[var(--danger)]" aria-label="No">
      &#10005;
    </span>
  );
}

/** One cell of the comparison grid: a tick, a cross, or a hedged qualifier. */
function Cell({ value }: { value: boolean | string }) {
  if (typeof value === "string") {
    return (
      <span className="font-mono text-[10px] uppercase leading-tight tracking-[0.08em] text-[var(--dim)] sm:text-[11px]">
        {value}
      </span>
    );
  }
  return <Check on={value} />;
}

/* -------------------------------------------------------------- METADATA -- */

/**
 * Homepage metadata.
 *
 * Only the alternates. Title, description and Open Graph all come from the root
 * layout and are already right for this page — it is the one the layout's
 * defaults were written for.
 *
 * Redeclaring `alternates` replaces the layout's whole block rather than
 * merging into it, which is why the canonical is repeated here. Dropping it
 * would leave the homepage as the one page on the site without one.
 */
export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    // The markdown twin of this page. Agents that would rather parse prose than
    // strip a marketing layout can follow this instead of the HTML; /index.md
    // is a real file in public/ and is generated from the same offer facts.
    types: {
      "text/markdown": "/index.md",
    },
  },
};

/* -------------------------------------------------------------------- PAGE -- */

export default function SalesPage() {
  /*
   * Structured data for the homepage.
   *
   * Built here rather than in the layout because the FAQ copy is the FAQS
   * const forty lines up — the questions a model quotes back are the same
   * strings a reader sees, and there is no second copy to fall out of date.
   *
   * Rendered as a plain <script>, not next/script: this has to be in the
   * server-rendered HTML. A crawler that does not execute JavaScript is
   * precisely the reader this exists for, and next/script's afterInteractive
   * default would put the whole graph behind the thing we cannot assume.
   */
  const graph = jsonLdGraph([
    organizationSchema(),
    webSiteSchema(),
    serviceSchema(),
    faqSchema(FAQS),
    breadcrumbSchema([{ name: "FootHold AEO", path: "/" }]),
  ]);

  return (
    <main>
      <script
        type="application/ld+json"
        // The payload is our own constants, not user input, and JSON.stringify
        // over it cannot produce a closing script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />

      {/* ============================================================ HERO == */}
      <section className="relative overflow-hidden bg-[var(--ink)]">
        {/* Single soft light source behind the headline. No gradient meshes —
            the page needs one focal point and the H1 is it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(246,190,0,0.13),transparent_65%)] blur-2xl"
        />

        <div className="relative mx-auto max-w-3xl px-5 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
          <Eyebrow>FootHold AEO &nbsp;&middot;&nbsp; Answer Engine Optimization</Eyebrow>

          <h1 className="mt-7 font-display text-[2.6rem] font-black uppercase leading-[0.92] tracking-[-0.025em] text-[var(--text)] sm:text-7xl">
            When someone asks AI
            <br />
            who to hire,
            <br />
            <span className="text-[var(--accent)]">one business</span>
            <br />
            gets named.
          </h1>

          <p className="mt-8 max-w-[42ch] text-balance font-display text-xl font-bold uppercase leading-[1.15] tracking-[-0.01em] text-[var(--muted)] sm:text-2xl">
            Right now, it probably isn&apos;t you.
          </p>

          <p className="mt-8 max-w-[48ch] text-[17px] leading-[1.65] text-[var(--muted)] sm:text-[19px]">
            Your customers have quietly stopped Googling. They open ChatGPT,
            describe their problem in one sentence, and take whatever it
            recommends. There is no page two. There is no fourth spot that still
            gets clicks. There is one answer, and every month a larger share of
            your market buys from it.
          </p>

          <p className="mt-5 max-w-[48ch] text-[17px] font-semibold leading-[1.65] text-[var(--text)] sm:text-[19px]">
            FootHold AEO is how that answer becomes your business.
          </p>

          <div className="mt-10 flex flex-col items-start gap-4">
            <ScanCta entryPoint="hero" className="w-full sm:w-auto">
              Scan my site free
            </ScanCta>
            <p className="max-w-[42ch] text-[14px] leading-relaxed text-[var(--dim)]">
              Takes about 60 seconds to request. No call, no card. We show you
              exactly what the AIs say about your business today, and who they name
              instead of you.
            </p>
          </div>
        </div>

        {/* Engine strip. Doubles as a plain statement of what "answer engine"
            means for anyone who has only ever used ChatGPT. */}
        <div className="relative border-t border-[var(--line)]">
          <div className="mx-auto max-w-5xl px-5 py-6 sm:px-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--dim)]">
              We optimize for the engines your customers actually ask
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              {ANSWER_ENGINES.map((e) => (
                <li
                  key={e}
                  className="font-display text-sm font-extrabold uppercase tracking-[0.04em] text-[var(--muted)] sm:text-base"
                >
                  {e}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* =========================================================== SHIFT == */}
      <Section>
        <Eyebrow>What actually changed</Eyebrow>
        <H2>
          Search just went
          <br />
          winner&#8209;take&#8209;all.
        </H2>

        {SHIFT_BODY.map((t) => (
          <P key={t}>{t}</P>
        ))}

        <Punch>
          If that name is your competitor, you did not come second.
        </Punch>
        <p className="mt-4 max-w-[24ch] font-display text-2xl font-extrabold uppercase leading-[1.05] text-[var(--accent)] sm:text-4xl">
          You were not in the conversation at all.
        </p>

        {SHIFT_BODY_2.map((t) => (
          <P key={t}>{t}</P>
        ))}

        <Callout label="The part that should worry you" tone="danger">
          This is the first channel in the history of marketing that is
          completely invisible to the business losing it. There is no impression
          count for the customer who asked an assistant and got told about
          somebody else. The lead simply never becomes a lead, and your reporting
          looks exactly the same as it did last month.
        </Callout>

        <div className="mt-12">
          <ScanCta entryPoint="after-shift" variant="secondary">
            Show me what AI says about my business
          </ScanCta>
        </div>
      </Section>

      {/* ============================================================= SEO == */}
      <Section tone="ink">
        <Eyebrow>Why your SEO won&apos;t save you</Eyebrow>
        <H2>
          You&apos;re optimized for a machine that&apos;s being replaced.
        </H2>

        {SEO_BODY.map((t) => (
          <P key={t}>{t}</P>
        ))}

        <Punch>
          You can be number one on Google and invisible inside ChatGPT.
        </Punch>

        <P>
          We find it constantly. It is the single most common result of the
          scan, and it is the one that changes how people think about their whole
          marketing budget.
        </P>

        {/* Two-column contrast. Kept to five rows — this is a rhythm break in
            the middle of long copy, not a spec sheet. */}
        <div className="mt-12 overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="grid grid-cols-2 border-b border-[var(--line)] bg-[var(--panel-2)]">
            <p className="px-4 py-4 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--dim)] sm:px-6 sm:text-[11px]">
              Google
            </p>
            <p className="border-l border-[var(--line)] px-4 py-4 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)] sm:px-6 sm:text-[11px]">
              Answer engines
            </p>
          </div>
          {CONTRAST.map((r, i) => (
            <div
              key={r.google}
              className={`grid grid-cols-2 ${
                i > 0 ? "border-t border-[var(--line)]" : ""
              }`}
            >
              <p className="px-4 py-4 text-[14px] leading-snug text-[var(--dim)] sm:px-6 sm:py-5 sm:text-[15px]">
                {r.google}
              </p>
              <p className="border-l border-[var(--line)] bg-[var(--panel)] px-4 py-4 text-[14px] font-semibold leading-snug text-[var(--text)] sm:px-6 sm:py-5 sm:text-[15px]">
                {r.ai}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ========================================================= SIGNALS == */}
      <Section>
        <Eyebrow>The mechanism</Eyebrow>
        <H2>
          Four things decide whether AI says your name.
        </H2>

        <P>
          Every one of these models, ChatGPT and Gemini and Perplexity and
          Copilot, is doing a version of the same thing when it decides who to
          recommend. Once you can see the four inputs, this stops being a
          mysterious black box and starts being an engineering problem with a
          checklist.
        </P>

        <div className="mt-14 space-y-12">
          {SIGNALS.map((s) => (
            <div
              key={s.n}
              className="border-l-2 border-[var(--line)] pl-5 sm:pl-8"
            >
              <p className="font-mono text-sm font-bold tracking-[0.18em] text-[var(--accent)]">
                {s.n}
              </p>
              <h3 className="mt-3 font-display text-2xl font-extrabold uppercase leading-[1.05] tracking-[-0.01em] text-[var(--text)] sm:text-3xl">
                {s.title}
              </h3>
              <p className="mt-4 max-w-[46ch] text-[17px] font-semibold leading-[1.6] text-[var(--text)] sm:text-[18px]">
                {s.lead}
              </p>
              <p className="mt-4 max-w-[48ch] text-[16px] leading-[1.65] text-[var(--muted)] sm:text-[17px]">
                {s.body}
              </p>
              <p className="mt-5 font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-[var(--accent)]">
                {s.punch}
              </p>
            </div>
          ))}
        </div>

        <Callout label="Why this is worth doing now">
          Almost nobody in your industry is working on a single one of these.
          Not because it is hard, but because it is new enough that most agencies
          have not noticed the channel exists yet. That gap is the entire
          opportunity, and it closes on its own.
        </Callout>

        <div className="mt-12">
          <ScanCta entryPoint="after-signals">
            Find out which signal I&apos;m failing
          </ScanCta>
        </div>
      </Section>

      {/* ========================================================== SYSTEM == */}
      <Section tone="ink">
        <Eyebrow>What we actually do</Eyebrow>
        <H2>The FootHold AEO system.</H2>

        <P>
          Four phases. No retainer for &ldquo;strategy&rdquo;, and no
          ninety-page audit you will never open.
        </P>

        <div className="mt-14 space-y-px overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--line)]">
          {PHASES.map((p) => (
            <div key={p.n} className="bg-[var(--panel)] p-6 sm:p-8">
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-sm font-bold tracking-[0.18em] text-[var(--accent)]">
                  {p.n}
                </span>
                <h3 className="font-display text-xl font-extrabold uppercase tracking-[0.02em] text-[var(--text)] sm:text-2xl">
                  {p.label}
                </h3>
              </div>
              <p className="mt-4 max-w-[52ch] text-[16px] leading-[1.65] text-[var(--muted)] sm:text-[17px]">
                {p.body}
              </p>
            </div>
          ))}
        </div>

        <Punch>There is only one question here: did it say your name?</Punch>
      </Section>

      {/* ========================================================= COMPARE == */}
      <Section>
        <Eyebrow>Your three options</Eyebrow>
        <H2>Nothing, more SEO, or this.</H2>

        <P>
          Doing nothing is a real choice and plenty of businesses will make it.
          Here is what each one actually gets you.
        </P>

        <div className="mt-12 overflow-hidden rounded-xl border border-[var(--line)]">
          {/* Column heads abbreviate on small screens so the grid never needs
              to scroll sideways on a phone, which is where the ads land. */}
          <div className="grid grid-cols-[1fr_3.25rem_3.25rem_3.25rem] items-end gap-x-1 border-b border-[var(--line)] bg-[var(--panel-2)] px-4 py-4 sm:grid-cols-[1fr_6rem_6rem_6rem] sm:px-6">
            <span />
            <span className="text-center font-mono text-[9px] font-bold uppercase leading-tight tracking-[0.1em] text-[var(--dim)] sm:text-[11px] sm:tracking-[0.14em]">
              <span className="sm:hidden">None</span>
              <span className="hidden sm:inline">Do nothing</span>
            </span>
            <span className="text-center font-mono text-[9px] font-bold uppercase leading-tight tracking-[0.1em] text-[var(--dim)] sm:text-[11px] sm:tracking-[0.14em]">
              SEO<span className="hidden sm:inline"> agency</span>
            </span>
            <span className="-my-4 -mr-4 flex items-end justify-center self-stretch bg-[var(--panel)] pb-4 pr-4 pt-4 text-center sm:-mr-6 sm:pr-6 font-mono text-[9px] font-bold uppercase leading-tight tracking-[0.1em] text-[var(--accent)] sm:text-[11px] sm:tracking-[0.14em]">
              FootHold
            </span>
          </div>

          {COMPARE.map((c, i) => (
            <div
              key={c.row}
              className={`grid grid-cols-[1fr_3.25rem_3.25rem_3.25rem] items-center gap-x-1 px-4 py-4 sm:grid-cols-[1fr_6rem_6rem_6rem] sm:px-6 sm:py-5 ${
                i > 0 ? "border-t border-[var(--line)]" : ""
              }`}
            >
              <span className="pr-3 text-[14px] leading-snug text-[var(--muted)] sm:text-[15px]">
                {c.row}
              </span>
              <span className="text-center text-lg">
                <Cell value={c.no} />
              </span>
              <span className="text-center text-lg">
                <Cell value={c.seo} />
              </span>
              <span className="-my-4 -mr-4 flex items-center justify-center self-stretch bg-[var(--panel)] pr-4 text-center text-lg sm:-my-5 sm:-mr-6 sm:pr-6">
                <Cell value={c.aeo} />
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ====================================================== OBJECTIONS == */}
      <Section tone="ink">
        <Eyebrow>Straight answers</Eyebrow>
        <H2>Let&apos;s do the objections.</H2>

        <P>
          You are reading a sales page, so here are the five things you are
          probably already thinking, answered without the dance.
        </P>

        <div className="mt-14 space-y-12">
          {OBJECTIONS.map((o) => (
            <div key={o.q}>
              <h3 className="max-w-[32ch] text-balance font-display text-xl font-extrabold uppercase leading-[1.1] tracking-[-0.01em] text-[var(--accent)] sm:text-2xl">
                &ldquo;{o.q}&rdquo;
              </h3>
              {o.a.map((para) => (
                <p
                  key={para}
                  className="mt-4 max-w-[50ch] text-[16px] leading-[1.65] text-[var(--muted)] sm:text-[17px]"
                >
                  {para}
                </p>
              ))}
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================ FIT == */}
      <Section>
        <Eyebrow>Before you request the scan</Eyebrow>
        <H2>This isn&apos;t for everyone.</H2>

        <P>
          We would rather you disqualify yourself here than waste a call. Read
          both columns honestly.
        </P>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--panel)] p-6 sm:p-7">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
              This is for you if
            </p>
            <ul className="mt-5 space-y-4">
              {FOR_YOU.map((t) => (
                <li key={t} className="flex gap-3 text-[15px] leading-[1.55] text-[var(--muted)]">
                  <span aria-hidden="true" className="text-[var(--accent)]">
                    &#10003;
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-7">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--dim)]">
              Give this a miss if
            </p>
            <ul className="mt-5 space-y-4">
              {NOT_FOR_YOU.map((t) => (
                <li key={t} className="flex gap-3 text-[15px] leading-[1.55] text-[var(--dim)]">
                  <span aria-hidden="true" className="text-[var(--danger)]">
                    &#10005;
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* =========================================================== SCAN == */}
      <section
        id="scan"
        className="scroll-mt-20 border-t border-[var(--line)] bg-[var(--ink)]"
      >
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-6 sm:py-28">
          <Eyebrow>Start here &nbsp;&middot;&nbsp; Free</Eyebrow>
          <H2>
            Find out what AI
            <br />
            says about you.
          </H2>

          <P>
            Before you spend a dollar with anybody, see the problem for
            yourself. We run your business through the major answer engines
            against the real buying questions in your category, and send you back
            what they actually say.
          </P>

          <ul className="mt-9 space-y-4">
            {SCAN_DELIVERS.map((t) => (
              <li
                key={t}
                className="flex max-w-[48ch] gap-3.5 text-[16px] leading-[1.6] text-[var(--muted)] sm:text-[17px]"
              >
                <span aria-hidden="true" className="mt-0.5 text-[var(--accent)]">
                  &#10003;
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <p className="mt-8 max-w-[48ch] text-[16px] leading-[1.65] text-[var(--text)] sm:text-[17px]">
            No call required. No card. If you read the report and go and fix all
            of it yourself, that is a perfectly good outcome.
          </p>

          <ScanForm entryPoint="scan-section" />
        </div>
      </section>

      {/* ============================================================ FAQ == */}
      <Section>
        <Eyebrow>Questions</Eyebrow>
        <H2>Before you ask.</H2>

        <div className="mt-12 space-y-px overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--line)]">
          {FAQS.map((f) => (
            <div key={f.q} className="bg-[var(--bg)] p-6 sm:p-7">
              <h3 className="text-[17px] font-bold leading-snug text-[var(--text)] sm:text-[18px]">
                {f.q}
              </h3>
              <p className="mt-3 max-w-[56ch] text-[15px] leading-[1.65] text-[var(--muted)] sm:text-[16px]">
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ========================================================== CLOSE == */}
      <section className="relative overflow-hidden border-t border-[var(--line)] bg-[var(--ink)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(246,190,0,0.12),transparent_65%)] blur-2xl"
        />
        <div className="relative mx-auto max-w-3xl px-5 py-24 sm:px-6 sm:py-32">
          <Eyebrow>Last thing</Eyebrow>
          <h2 className="mt-5 max-w-[18ch] font-display text-[2.1rem] font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-6xl">
            In two years everyone
            <br />
            will do this.
          </h2>

          <P>
            The businesses that started this year will already own the answer by
            then. Consensus is slow to build, which is exactly what makes it
            worth having, and exactly what makes arriving late so expensive.
          </P>
          <P>
            You can find out where you stand right now, for nothing. If the
            answer is that you are already being recommended, brilliant. Close the
            tab and get on with your day.
          </P>

          <div className="mt-11 flex flex-col items-start gap-4">
            <ScanCta entryPoint="final-close" className="w-full sm:w-auto">
              Scan my site free
            </ScanCta>
            <p className="text-[14px] text-[var(--dim)]">
              No call. No card. Just the report.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
