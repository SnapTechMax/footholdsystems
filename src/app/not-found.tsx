import type { Metadata } from "next";
import Link from "next/link";

/**
 * 404.
 *
 * The site already returned a real 404 status for unknown paths — Next does
 * that without help, and the 2026-08-27 agent-readiness scan confirmed it. What
 * it scored 1/2 on was the body: "include a short markdown body (site map
 * links, where to look next) so agents can recover".
 *
 * Which is a fair thing to want. A person who hits a dead link sees a page and
 * knows what to do with it; an agent gets a blob of layout HTML with the word
 * "not found" somewhere inside and no way to continue except giving up. The
 * block below is the recovery route, written as literal markdown in a <pre> so
 * it survives being read as text — an agent stripping tags from this response
 * gets a usable list of URLs rather than the debris of a nav bar.
 *
 * The human half is above it and unchanged in spirit: one line and a way back.
 */

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

const display = "font-display";

/**
 * The recovery block, as markdown.
 *
 * Hand-written rather than derived from the sitemap on purpose: it is a short
 * list of entry points, not a mirror of every URL, and the two well-known files
 * at the bottom are the ones an agent wants and the sitemap does not carry.
 */
const AGENT_RECOVERY = `# 404 — Not found

That path does not exist on footholdsystems.com. Try one of these instead:

- [Homepage](https://www.footholdsystems.com/) — what FootHold AEO is and what it does
- [Pricing](https://www.footholdsystems.com/pricing) — all four tiers and what each includes
- [Contact](https://www.footholdsystems.com/contact) — how to reach a person
- [Privacy policy](https://www.footholdsystems.com/privacy) — what we collect and why
- [llms.txt](https://www.footholdsystems.com/llms.txt) — the index written for agents
- [index.md](https://www.footholdsystems.com/index.md) — the homepage as markdown
- [sitemap.xml](https://www.footholdsystems.com/sitemap.xml) — every public URL
- [Agent skills](https://www.footholdsystems.com/.well-known/agent-skills/index.json) — what can be invoked here
`;

export default function NotFound() {
  return (
    <div className="bg-[var(--bg)] text-[var(--text)]">
      <section className="mx-auto max-w-3xl px-6 py-24 sm:py-32">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
          404
        </p>
        <h1
          className={`${display} mt-4 text-5xl font-black uppercase leading-[0.94] tracking-tight sm:text-7xl`}
        >
          Nothing
          <br />
          here.
        </h1>
        <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-[var(--muted)]">
          That page does not exist, and probably never did. The scan is on the
          homepage, which is where nearly everything on this site lives.
        </p>

        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-[16px]">
          <Link
            href="/"
            className="font-semibold text-[var(--accent)] underline underline-offset-4"
          >
            Homepage
          </Link>
          <Link
            href="/pricing"
            className="font-semibold underline underline-offset-4 hover:text-[var(--text)]"
          >
            Pricing
          </Link>
          <Link
            href="/contact"
            className="font-semibold underline underline-offset-4 hover:text-[var(--text)]"
          >
            Contact
          </Link>
          <Link
            href="/privacy"
            className="font-semibold underline underline-offset-4 hover:text-[var(--text)]"
          >
            Privacy
          </Link>
        </div>

        {/* Open, not a <details>.
            
            It shipped collapsed and the scan came back 1/2 — "for full credit,
            include a short markdown body". A <details> keeps its contents in
            the DOM, so the theory was that a parser would find them anyway; it
            evidently reads what is rendered. Which is fair, and it is the same
            reason this is visible rather than hidden by CSS: an agent-only
            payload a person cannot see is the shape of thing search engines
            have spent twenty years penalising. There is nothing here worth
            concealing — it is a list of links to public pages, and a person who
            hit a dead link can use it as readily as a crawler can. */}
        <div className="mt-14 rounded-xl border border-[var(--line)] bg-[var(--ink)] p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--dim)]">
            Where to look next
          </p>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-[var(--muted)]">
            {AGENT_RECOVERY}
          </pre>
        </div>
      </section>
    </div>
  );
}
