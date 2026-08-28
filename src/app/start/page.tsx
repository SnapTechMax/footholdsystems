import type { Metadata } from "next";
import { IntakeForm } from "@/components/IntakeForm";
import { REQUIRED_FIELD_COUNT } from "@/lib/intake/questions";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * The build intake. Where a customer who has bought hands over everything the
 * work needs.
 *
 * NOT INDEXED, and not linked from anywhere on the site. The URL is short so it
 * can be pasted into a reply by hand, which is how it actually gets sent: the
 * first customer for this arrived by replying to an email, not through the
 * funnel, and a page like this turning up in a search result would be a form
 * collecting supplier relationships and account contacts from strangers.
 *
 * Everything below the intro is generated from INTAKE_SECTIONS. The copy here
 * is the only part written by hand, and its whole job is to get somebody to
 * start: say how long it takes, say that leaving halfway is safe, and say what
 * happens when they finish.
 */

export const metadata: Metadata = {
  title: "Start your build",
  description:
    "The intake form for a FootHold build. Everything we need to start, in one pass.",
  robots: { index: false, follow: false, nocache: true },
};

export default function StartPage() {
  return (
    <main className="bg-[var(--bg)]">
      <section className="bg-[var(--ink)]">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)] sm:text-xs">
            Build intake
          </p>

          <h1 className="mt-5 text-balance font-display text-[2.3rem] font-black uppercase leading-[0.94] tracking-[-0.02em] text-[var(--text)] sm:text-6xl">
            Everything we need, in one pass.
          </h1>

          <p className="mt-7 max-w-[52ch] text-[17px] leading-[1.65] text-[var(--muted)] sm:text-[19px]">
            This is the part that decides how good the build is. Most of what
            goes on your site cannot be looked up. It is in your head, and this
            is where it comes out.
          </p>

          <div className="mt-10 space-y-5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-7">
            <div className="flex gap-3.5">
              <span aria-hidden="true" className="font-mono text-[var(--accent)]">
                1.
              </span>
              <p className="text-[15px] leading-[1.6] text-[var(--muted)]">
                Twenty minutes if you take it seriously.{" "}
                <span className="text-[var(--text)]">
                  {REQUIRED_FIELD_COUNT} answers are required
                </span>{" "}
                and the rest are optional. Short answers are fine. Guesses are
                fine. We would rather have a rough answer than a blank box.
              </p>
            </div>
            <div className="flex gap-3.5">
              <span aria-hidden="true" className="font-mono text-[var(--accent)]">
                2.
              </span>
              <p className="text-[15px] leading-[1.6] text-[var(--muted)]">
                You can stop halfway. Everything you type is saved in this
                browser as you go, so closing the tab and coming back later
                picks up where you left off. Nothing reaches us until you press
                the button at the bottom.
              </p>
            </div>
            <div className="flex gap-3.5">
              <span aria-hidden="true" className="font-mono text-[var(--accent)]">
                3.
              </span>
              <p className="text-[15px] leading-[1.6] text-[var(--muted)]">
                When you send it you get the agreement to read and sign. That is
                the last thing standing between here and us starting.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-5 sm:p-6">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--danger)]">
              Never put a password in this form
            </p>
            <p className="mt-3 text-[15px] leading-[1.6] text-[var(--muted)]">
              Not for your website, not for your domain, not for Google. When we
              need access we ask for it through the platform&rsquo;s own invite,
              under our own login, and you can revoke it in one click when the
              work is done. Anyone who asks you to type a password into a form
              is doing it wrong.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-20">
        <IntakeForm />

        <p className="mt-12 text-[15px] leading-[1.7] text-[var(--dim)]">
          Stuck on something, or would rather say it out loud than type it?
          Email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-semibold text-[var(--accent)] underline underline-offset-4"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          and we will do this part on a call instead.
        </p>
      </section>
    </main>
  );
}
