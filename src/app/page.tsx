import Link from "next/link";
import { BookCallButton } from "@/components/BookCallButton";

// display font utility (Archivo is loaded globally in layout.tsx)
const display = "font-[family-name:var(--font-archivo)]";

const services = [
  {
    label: "Build",
    body: "Describe the job in plain words and we build the small, boring software that does it: a price calculator with your real rules, a form that routes new jobs to the right person, one screen showing money in and money out. When it's finished we write down how it works and hand you both, so if you ever replace us the next person can pick it up.",
  },
  {
    label: "Embed",
    body: "We look after the AI side of your business, the way a good IT provider looks after your network. We keep the tools running, watch for the things that break quietly on a Tuesday, and make sure anything touching customer info or money is handled safely.",
  },
];

const miniLevels = [
  { n: "01", title: "Chatting", width: "22%" },
  { n: "02", title: "Working Together", width: "36%" },
  { n: "03", title: "Building", width: "52%", money: true },
  { n: "04", title: "Chaining", width: "70%" },
  { n: "05", title: "Running a Team", width: "88%" },
];

export default function HomePage() {
  return (
    <div className="bg-[#eae8e1] text-[#1f1f1d]">
      {/* ============================= HERO ============================= */}
      <section className="bg-[#1b1b1b] text-[#f2efe6]">
        <div className="mx-auto max-w-4xl px-6 py-24 sm:py-32">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#f6be00]">
            Foothold Systems &nbsp;&middot;&nbsp; AI for Business
          </p>

          <h1 className={`${display} mt-8 text-6xl font-black uppercase leading-[0.92] tracking-tight sm:text-8xl`}>
            Get a foothold
            <br />
            in <span className="text-[#f6be00]">AI</span>
          </h1>

          <p className="mt-8 max-w-xl font-serif text-lg leading-relaxed text-[#cfccc2] sm:text-xl">
            Plenty of people will tell you to use AI. Setting it up inside a
            working business is the part nobody does for you. We pick the right
            tool for the job you&apos;ve actually got, build it around how your shop
            really runs, and look after it once it&apos;s live. You get one thing
            that works, and you&apos;ll know how it works.
          </p>

          <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/guide#get-the-guide"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#f6be00] px-8 py-4 text-lg font-bold text-[#1b1b1b] transition-colors hover:bg-[#ffd23d]"
            >
              Get the free guide &rarr;
            </Link>
            <a
              href="#how-we-work"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#3a3a37] px-8 py-4 text-lg font-semibold text-[#f2efe6] transition-colors hover:border-[#f6be00] hover:text-[#f6be00]"
            >
              See how we work
            </a>
          </div>
        </div>
      </section>

      {/* ============================= HOW WE WORK ============================= */}
      <section id="how-we-work" className="scroll-mt-20 mx-auto max-w-4xl px-6 py-20">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#7a786f]">
          How we work
        </p>
        <h2 className={`${display} mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl`}>
          Two ways to
          <br />
          work together
        </h2>

        <div className="mt-8 max-w-2xl font-serif text-lg leading-relaxed">
          <p>
            Buying the software is the easy half, and it&apos;s where most of the
            advice stops. What decides whether any of it pays off is picking the
            right first tool, building it so it keeps working when you&apos;re busy,
            and looking after it once it&apos;s handling real money. That&apos;s the
            part we do.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {services.map((s) => (
            <div key={s.label} className="border-2 border-[#1b1b1b] bg-[#e2dfd4] p-8">
              <h3 className={`${display} text-2xl font-extrabold uppercase tracking-tight`}>
                {s.label}
              </h3>
              <p className="mt-3 font-serif text-[15px] leading-relaxed text-[#57564f]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================= FREE GUIDE PROMO ============================= */}
      <section className="bg-[#1b1b1b] text-[#f2efe6]">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#f6be00]">
            Start here &nbsp;&middot;&nbsp; Free guide
          </p>
          <h2 className={`${display} mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl`}>
            Not sure where
            <br />
            to start?
          </h2>
          <p className="mt-6 max-w-xl font-serif text-lg leading-relaxed text-[#cfccc2]">
            Everybody says you should use AI. Nobody hands you the prompts that
            actually work. The 5 Levels of AI is a ten minute read that does:
            five levels, the prompt that moves you up each one, and two of them
            printed in full so you can paste one into a chat box today.
          </p>

          {/* compact ladder */}
          <div className="mt-10 space-y-3">
            {[...miniLevels].reverse().map((lvl) => (
              <div key={lvl.n} className="flex items-center gap-4">
                <span className="w-6 font-mono text-sm text-[#8a887f]">{lvl.n}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-sm bg-[#2c2c29]">
                  <div
                    className={`h-full rounded-sm ${lvl.money ? "bg-[#f6be00]" : "bg-[#4a4a46]"}`}
                    style={{ width: lvl.width }}
                  />
                </div>
                <span className="hidden w-40 shrink-0 font-mono text-xs uppercase tracking-[0.12em] text-[#cfccc2] sm:block">
                  {lvl.title}
                </span>
              </div>
            ))}
          </div>

          <Link
            href="/guide#get-the-guide"
            className="mt-10 inline-flex items-center justify-center gap-2 rounded-lg bg-[#f6be00] px-8 py-4 text-lg font-bold text-[#1b1b1b] transition-colors hover:bg-[#ffd23d]"
          >
            Get the 5 Levels of AI &rarr;
          </Link>
        </div>
      </section>

      {/* ============================= FINAL CTA ============================= */}
      <section id="book-a-call" className="scroll-mt-20 border-t border-[#d4d1c6] bg-[#e2dfd4]">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="bg-[#f6be00] p-8 text-[#1b1b1b] sm:p-12">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#1b1b1b]/70">
              Talk to us
            </p>
            <h2 className={`${display} mt-3 text-3xl font-black uppercase tracking-tight sm:text-5xl`}>
              What twenty minutes gets you
            </h2>
            <p className="mt-4 max-w-2xl font-serif text-[15px] leading-relaxed text-[#1b1b1b]/80">
              Tell us where AI has got to in your business and we&apos;ll tell you
              what we usually find at that stage, and what it tends to cost. The
              call costs nothing whether you hire us or not, and if the answer is
              that you don&apos;t need us yet, we&apos;ll say so.
            </p>
            <BookCallButton
              entryPoint="homepage"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#1b1b1b] px-7 py-3.5 text-lg font-bold text-[#f2efe6] transition-colors hover:bg-[#2c2c29]"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
