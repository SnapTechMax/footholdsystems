import type { Metadata } from "next";
import Link from "next/link";
import {
  BUSINESS_ADDRESS,
  CONTACT_EMAIL,
  CONSENT_TEXT,
} from "@/lib/site";

/**
 * Privacy policy.
 *
 * Exists for two reasons. Meta requires advertisers whose landing page collects
 * personal information to publish an accessible privacy policy, and a lead-capture
 * page without one is a routine ad disapproval. Second, it is the page that has to
 * be true: everything below describes what this codebase actually does, so it is
 * worth re-reading whenever a tag, a processor or the consent flow changes.
 *
 * Not legal advice, and not reviewed by a lawyer. It is an accurate description of
 * the system written in plain English.
 */

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What FootHold Systems collects, why, who it goes to, and how to get it deleted.",
  alternates: { canonical: "/privacy" },
};

const display = "font-display";

// Kept in step with the tags in src/app/layout.tsx and the processors the scan
// flow actually touches. Adding a tag or a vendor means adding a row here.
//
// Google Sheets and Pushover are deliberately absent: they are only used by the
// older /api/lead route, and nothing on the site posts to it any more. A
// processor listed here that never sees your data is as wrong as one missing.
const PROCESSORS = [
  {
    name: "Resend",
    role: "Sends your scan report and the follow-up emails. Holds your email address.",
  },
  {
    name: "Ora",
    role: "Runs the technical scan. We send it the website address you give us, nothing about you. It returns the findings your report is built from.",
  },
  {
    name: "Whop",
    role: "Takes the payment if you buy the fixes. Whop handles the card details; we never see or store them. We receive a confirmation that a payment succeeded and which report it was for. Whop also sets a tag on this site that records page views, so a purchase can be matched to the visit that led to it.",
  },
  {
    name: "Vercel",
    role: "Hosts the site. Keeps standard server logs, and reads an approximate country from your IP address so the form knows which consent wording to show.",
  },
  {
    name: "Neon / Vercel Postgres",
    role: "Stores the consent record and the anonymous page-view counts behind our A/B testing.",
  },
  {
    name: "Google Analytics 4",
    role: "Aggregate traffic reporting: pages viewed, roughly where visitors came from.",
  },
  {
    name: "Microsoft Clarity",
    role: "Heatmaps and session replay. Records how pages are scrolled and clicked so we can see which parts confuse people. Clarity masks text input by default, so what you type in the form is not captured.",
  },
  {
    name: "Meta (Facebook) Pixel",
    role: "Tells us which of our Facebook ads led to a scan request, so we know which ones to stop paying for.",
  },
  {
    name: "Calendly",
    role: "Runs the booking page. If you book a call, Calendly holds the name, email and any answers you give it.",
  },
];

export default function PrivacyPage() {
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
            Privacy
            <br />
            policy
          </h1>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-[var(--dim)]">
            Last updated 24 August 2026
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-12 text-[17px] leading-relaxed text-[var(--muted)]">
          <div>
            <p className="text-lg">
              Short version: we collect your email address and your website
              address so we can run your scan and send you the report. We do
              not sell them, we do not share them with anyone outside the
              services that make this site work, and you can have them deleted by
              asking.
            </p>
          </div>

          <Block title="Who we are">
            <p>
              FootHold Systems, {BUSINESS_ADDRESS}. You can reach us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
              . We are the ones who decide what happens to the information
              described here.
            </p>
          </Block>

          <Block title="What we collect">
            <List
              items={[
                <>
                  <strong>Your email address and your website address.</strong>{" "}
                  You type these into the scan request form. That is the whole form. We
                  do not ask for your name, your phone number, or a card.
                </>,
                <>
                  <strong>A record of your consent.</strong> When you tick the
                  boxes we store the exact wording you were shown, the date and
                  time, your IP address and your browser&apos;s user-agent string.
                  We keep this so that if anyone later asks us to prove you agreed
                  to the emails or to being called, we can. We record it the same
                  way if you decline.
                </>,
                <>
                  <strong>How the page gets used.</strong> Pages viewed, how far
                  down you scrolled, where you clicked, roughly what country you
                  are in, and which of our ads you arrived from. This is
                  behavioural, not personal, and it is not tied to your name.
                </>,
              ]}
            />
          </Block>

          <Block title="Why we collect it">
            <List
              items={[
                <>
                  <strong>To send you your scan report.</strong> You asked for it, so
                  sending it is simply doing the thing you requested.
                </>,
                <>
                  <strong>To send you follow-up emails</strong> about AI
                  visibility for businesses. This one runs on your consent and nothing else. The
                  box you tick reads: &ldquo;{CONSENT_TEXT}&rdquo; You can
                  withdraw at any time and we stop.
                </>,
                <>
                  <strong>To run the scan.</strong> Your website address is sent to
                  Ora, the service that performs the technical assessment. It is a
                  public web address and carries nothing personal about you.
                </>,
                <>
                  <strong>To work out whether the site and the ads are any
                  good.</strong> Which headline gets read, where people give up,
                  which ad brought them. We do this because running ads without it
                  means paying for guesses.
                </>,
              ]}
            />
            <p className="mt-4">
              If you are in the UK, the EEA or Switzerland: our legal basis for
              the emails is your consent, and for the analytics and site security
              it is our legitimate interest in understanding and protecting our
              own website. Where consent is the basis, ticking the box is
              genuinely optional, and your scan report is sent either way.
            </p>
          </Block>

          <Block title="Cookies and similar technology">
            <p>
              We set two small cookies of our own. <code>fh_vid</code> is a random
              string that lets us count one browser once instead of twice. If an
              A/B test is running, <code>fh_exp_…</code> remembers which version
              of the page you were shown, so you do not get a different one on
              every visit. Both last 90 days, and neither carries anything about
              you.
            </p>
            <p className="mt-4">
              The analytics and advertising services listed below set their own
              cookies. Clearing cookies in your browser, or using its
              tracking-protection settings, removes them. Nothing on this site
              stops working if you do.
            </p>
          </Block>

          <Block title="Who else sees it">
            <p>
              Only the services that make this site run. Each one sees the part it
              needs and no more. We do not sell personal information, and we do
              not share it for anyone else&apos;s advertising.
            </p>
            <dl className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {PROCESSORS.map((processor) => (
                <div
                  key={processor.name}
                  className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6"
                >
                  <dt className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-[var(--text)] sm:w-44 sm:shrink-0 sm:pt-1">
                    {processor.name}
                  </dt>
                  <dd className="text-[15px] text-[var(--muted)]">{processor.role}</dd>
                </div>
              ))}
            </dl>
          </Block>

          <Block title="How long we keep it">
            <p>
              Your email address stays on our list until you unsubscribe or ask us
              to delete it. Consent records are kept for as long as we hold your
              email and for three years afterwards, because the whole point of the
              record is to outlive the thing it is evidence for. Analytics data expires on
              each provider&apos;s own schedule, which is 14 months for Google
              Analytics and 13 months for Clarity.
            </p>
          </Block>

          <Block title="What you can ask us to do">
            <List
              items={[
                <>
                  <strong>Stop emailing you.</strong> Every email we send has an
                  unsubscribe link in it. One click, no questions. Or email us and
                  we will do it by hand.
                </>,
                <>
                  <strong>Tell you what we hold.</strong> Ask and we will send you
                  everything we have that is tied to your email address.
                </>,
                <>
                  <strong>Correct it or delete it.</strong> Ask and we will. The
                  only thing we keep after a deletion is the fact that you asked,
                  which is what stops you being added back later.
                </>,
              ]}
            />
            <p className="mt-4">
              Email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              for any of these. We will not charge you and we will not make it
              difficult. If you are in the UK or the EEA and you think we have
              handled this badly, you can complain to your national data
              protection authority.
            </p>
          </Block>

          <Block title="Children">
            <p>
              This is a site that sells business services. It is not aimed at
              children and we do not knowingly collect anything from anyone under
              16.
            </p>
          </Block>

          <Block title="Changes">
            <p>
              If we change how any of this works, we change this page and update
              the date at the top. If a change is significant and you are on our
              list, we will tell you by email rather than hoping you re-read the
              page.
            </p>
          </Block>
        </div>

        <div className="mt-16 border-t border-[var(--line)] pt-8">
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--dim)] transition-colors hover:text-[var(--text)]"
          >
            &larr; Back to FootHold AEO
          </Link>
        </div>
      </section>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2
        className={`${display} text-2xl font-black uppercase tracking-tight text-[var(--text)] sm:text-3xl`}
      >
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 bg-[var(--accent)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
