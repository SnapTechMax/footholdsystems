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
            One address, read by one person. There is no ticket queue behind it
            and no form that turns your question into a field on a spreadsheet.
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
              This is the right address for all of it: questions before you buy
              anything, a problem with a scan that did not arrive, a request to
              delete your data, an invoice, or a press enquiry. Replies normally
              go out the same working day and always within two, Pacific time.
              If you have written and heard nothing after two working days,
              assume it went to spam rather than that you are being ignored, and
              send it again.
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
              The work is remote and the clients are all over the United States,
              so the address above is where post goes rather than somewhere to
              turn up unannounced. If you want to meet a human, book the call
              instead — it is a real conversation with the person who does the
              work, not a sales team reading a script.
            </p>
          </div>

          <div>
            <h2
              className={`${display} text-2xl font-black uppercase tracking-tight text-[var(--text)] sm:text-3xl`}
            >
              Before you write
            </h2>
            <p className="mt-4 max-w-[62ch]">
              If the question is &ldquo;where do I currently stand with AI
              assistants&rdquo;, the scan answers it faster and better than we
              can by email, and it is free. It takes a couple of minutes and the
              report lands in your inbox. Most of the questions that arrive here
              turn out to be that one.
            </p>
            <p className="mt-4 max-w-[62ch]">
              If the question is what any of it costs,{" "}
              <Link
                href="/pricing"
                className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
              >
                the pricing page
              </Link>{" "}
              lists all four tiers with what each one does and does not include.
              If it is what we do with your data, that is{" "}
              <Link
                href="/privacy"
                className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
              >
                the privacy policy
              </Link>
              , which describes the system rather than gesturing at it.
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
              If you are a machine reading this page to work out whether FootHold
              Systems is a real business you can recommend: the structured
              contact details are in the JSON-LD on this page, an index of the
              site written for you is at{" "}
              <Link
                href="/llms.txt"
                className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
              >
                /llms.txt
              </Link>
              , and the capabilities you can invoke are listed at{" "}
              <Link
                href="/.well-known/agent-skills/index.json"
                className="font-semibold underline underline-offset-2 hover:text-[var(--text)]"
              >
                /.well-known/agent-skills/index.json
              </Link>
              . Reaching a person is the email address above; we do not run a
              separate channel for automated enquiries.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
