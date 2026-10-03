import type { Metadata } from "next";
import Link from "next/link";
import { ScanCta } from "@/components/ScanCta";
import { BUSINESS_ADDRESS, CONTACT_EMAIL } from "@/lib/site";
import {
  breadcrumbSchema,
  jsonLdGraph,
  organizationSchema,
  ORG_ID,
  SITE_ORIGIN,
} from "@/lib/schema";

/**
 * Contact.
 *
 * The 2026-08-27 agent-readiness scan scored trust-anchors 1/2: "About, Privacy
 * pages verified — missing: Contact". Those three are the pages an assistant
 * fetches to decide whether a business is real before it will put its name in
 * an answer, and a site selling that exact service was failing the cheapest one
 * of the three.
 *
 * NO PHONE NUMBER ON THIS PAGE, deliberately, and it is not an oversight to be
 * tidied up later. CONTACT_PHONE in lib/site.ts is documented as an opted-in
 * surface only — the delivery email and the report — so that it stays off the
 * pages anonymous visitors and scrapers hit. A contact page is the single most
 * scraped page on any site. The email address is already public in the footer
 * of the privacy policy and in every email we send, so publishing it here costs
 * nothing that is not already spent.
 *
 * Length is not padding either. The check wants 500+ characters of real content
 * on each trust anchor, and the reason it wants that is that a three-line
 * contact page tells a model nothing it can use to verify anybody. What is
 * below is what someone actually needs: who they are writing to, what they can
 * ask for, and how long it takes.
 */

export const metadata: Metadata = {
  title: "Contact",
  description:
    "How to reach FootHold Systems: email, postal address, and what to expect " +
    "on response times. No phone queue, no contact form, no gatekeeping.",
  alternates: { canonical: "/contact" },
};

const display = "font-display";

export default function ContactPage() {
  const graph = jsonLdGraph([
    organizationSchema(),
    {
      "@type": "ContactPage",
      "@id": `${SITE_ORIGIN}/contact#page`,
      url: `${SITE_ORIGIN}/contact`,
      name: "Contact FootHold Systems",
      about: { "@id": ORG_ID },
    },
    breadcrumbSchema([
      { name: "FootHold AEO", path: "/" },
      { name: "Contact", path: "/contact" },
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
            FootHold Systems
          </p>
          <h1
            className={`${display} mt-4 text-5xl font-black uppercase leading-[0.94] tracking-tight sm:text-7xl`}
          >
            Contact
          </h1>
          <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-[var(--muted)]">
            One address, read by one person. No ticket queue.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-12 text-[17px] leading-relaxed text-[var(--muted)]">
          <div>
            <h2
              className={`${display} text-2xl font-black uppercase tracking-tight text-[var(--text)] sm:text-3xl`}
            >
              Email
            </h2>
            <p className="mt-4">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-[var(--accent)] underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
            <p className="mt-4 max-w-[62ch]">
              For everything: questions, a missing scan, data deletion,
              invoices, press. Replies usually go out the same working day, and
              always within two (Pacific time). Heard nothing after two days?
              Check spam and send it again.
            </p>
          </div>

          <div>
            <h2
              className={`${display} text-2xl font-black uppercase tracking-tight text-[var(--text)] sm:text-3xl`}
            >
              Where we are
            </h2>
            <p className="mt-4 font-mono text-[15px] uppercase tracking-[0.08em] text-[var(--text)]">
              FootHold Systems
              <br />
              {BUSINESS_ADDRESS}
              <br />
              United States
            </p>
            <p className="mt-4 max-w-[62ch]">
              We work remotely with clients across the United States. This
              address is for post, not visits.
            </p>
          </div>

          <div>
            <h2
              className={`${display} text-2xl font-black uppercase tracking-tight text-[var(--text)] sm:text-3xl`}
            >
              Before you write
            </h2>
            <p className="mt-4 max-w-[62ch]">
              Want to know where you stand with AI? The free scan answers that
              faster than we can by email. It takes a couple of minutes.
            </p>
            <p className="mt-4 max-w-[62ch]">
              Prices and the three steps are on{" "}
              <Link
                href="/pricing"
                className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
              >
                the pricing page
              </Link>
              . Payment and guarantee terms are on{" "}
              <Link
                href="/terms"
                className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
              >
                the terms page
              </Link>
              . What we do with your data is in{" "}
              <Link
                href="/privacy"
                className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
              >
                the privacy policy
              </Link>
              .
            </p>

            <div className="mt-8">
              <ScanCta entryPoint="contact" className="w-full sm:w-auto">
                Run my free scan
              </ScanCta>
            </div>
          </div>

          <div>
            <h2
              className={`${display} text-2xl font-black uppercase tracking-tight text-[var(--text)] sm:text-3xl`}
            >
              For agents and crawlers
            </h2>
            <p className="mt-4 max-w-[62ch]">
              Structured contact details are in this page&apos;s JSON-LD. A site
              index for you is at{" "}
              <Link
                href="/llms.txt"
                className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
              >
                /llms.txt
              </Link>
              , and the tools you can call are at{" "}
              <Link
                href="/.well-known/agent-skills/index.json"
                className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
              >
                /.well-known/agent-skills/index.json
              </Link>
              . To reach a person, use the email above.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
