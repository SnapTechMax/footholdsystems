/**
 * JSON-LD for the public pages.
 *
 * This exists because of a scan result, not because of a style guide. Ora's
 * agent-readiness scan scored footholdsystems.com 49/100 on 2026-08-27 with
 * four separate structured-data checks failing off one root cause — there was
 * no JSON-LD on the homepage at all — worth ten points between them:
 *
 *   json-ld                   4  identity type, name, description, url
 *   json-ld-entity-linking    2  sameAs, so a model can disambiguate the brand
 *   org-schema-completeness   2  contactPoint AND address
 *   schema-type-breadth       2  types beyond Organization/WebSite
 *
 * Which is a fairly pointed thing to have been failing on a site that sells
 * exactly this work. Everything here is emitted server-side into the page HTML,
 * because a crawler that does not run our JavaScript is the whole audience.
 *
 * Nothing in here is allowed to say anything the site does not already say out
 * loud. The offers below are the real prices from lib/scan/pricing.ts rather
 * than copies, the address is the one in the footer, and `sameAs` lists only
 * profiles we actually own — see the note on it.
 */

import {
  BUSINESS_ADDRESS,
  CONTACT_EMAIL,
  CALENDLY_KICKOFF_URL,
} from "@/lib/site";
import {
  DONE_FOR_YOU_PRICE_CENTS,
  RETAINER_MONTHLY_CENTS,
  RETAINER_SETUP_CENTS,
  SOLUTIONS_PRICE_CENTS,
} from "@/lib/scan/pricing";

/** Canonical origin. www, matching metadataBase, the sitemap and the canonicals. */
export const SITE_ORIGIN = "https://www.footholdsystems.com";

/**
 * Stable @id for the business, used as the subject of every other node.
 *
 * A fragment on the origin rather than a bare URL, so the Organization and the
 * WebSite are distinguishable nodes instead of one URL claiming to be both.
 */
export const ORG_ID = `${SITE_ORIGIN}/#organization`;
export const SITE_ID = `${SITE_ORIGIN}/#website`;

/**
 * Profiles we actually control, for `sameAs`.
 *
 * DELIBERATELY SHORT, and the short list is the honest one. `sameAs` is how a
 * model decides that the FootHold on this domain is the same entity as the
 * FootHold it saw somewhere else, so a URL here that we do not own — or that
 * does not resolve — is worse than an absent one: it links our identity to
 * something that is not us and invites exactly the confusion the property
 * exists to prevent.
 *
 * ADD TO THIS LIST as real profiles come into existence: Google Business
 * Profile, LinkedIn company page, the Wikidata item (P856 pointing back here),
 * a public GitHub org. Ora's own note is that Wikipedia/Wikidata is the single
 * highest-impact entry, and it is the one we cannot write from a repo — it
 * needs third-party press first to clear notability.
 */
export const SAME_AS: string[] = [
  // The public booking profile. Ours, live, and the one external page that
  // already names the business the same way this site does.
  new URL(CALENDLY_KICKOFF_URL).origin +
    new URL(CALENDLY_KICKOFF_URL).pathname.replace(/\/[^/]*$/, ""),
];

/**
 * The footer address, split for schema.org.
 *
 * Parsed from the one constant rather than retyped, so the site cannot end up
 * showing one address to people and filing a different one for machines. If
 * BUSINESS_ADDRESS ever stops matching this shape the split degrades to a
 * street-only address, which is wrong but not contradictory.
 */
function postalAddress() {
  // "403 E Arrow Hwy Suite 306, San Dimas, CA 91773"
  const match = BUSINESS_ADDRESS.match(
    /^(.*),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/
  );
  if (!match) {
    return { "@type": "PostalAddress", streetAddress: BUSINESS_ADDRESS };
  }
  const [, street, city, region, postal] = match;
  return {
    "@type": "PostalAddress",
    streetAddress: street,
    addressLocality: city,
    addressRegion: region,
    postalCode: postal,
    addressCountry: "US",
  };
}

const DESCRIPTION =
  "FootHold AEO is an answer engine optimization consultancy. We measure what " +
  "ChatGPT, Gemini, Perplexity, Copilot and Google AI Overviews currently say " +
  "about a business, rebuild its site so those systems can read and quote it, " +
  "align its listings, and build a second machine-readable domain so the " +
  "business gets named when someone asks an assistant who to hire.";

/**
 * Organization.
 *
 * `contactPoint` carries the email and not the phone, on purpose. The direct
 * line in lib/site.ts is documented as opted-in surfaces only — the delivery
 * email and the report — and JSON-LD on the homepage is the most scraped
 * surface there is. Ora's org-schema-completeness check accepts either.
 */
export function organizationSchema() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "FootHold AEO",
    legalName: "FootHold Systems",
    alternateName: ["FootHold Systems", "FootHold"],
    url: `${SITE_ORIGIN}/`,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_ORIGIN}/images/foothold-mark.png`,
      width: 1080,
      height: 1080,
    },
    image: `${SITE_ORIGIN}/images/foothold-mark.png`,
    description: DESCRIPTION,
    email: CONTACT_EMAIL,
    address: postalAddress(),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: CONTACT_EMAIL,
        areaServed: "US",
        availableLanguage: "en",
      },
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: CONTACT_EMAIL,
        areaServed: "US",
        availableLanguage: "en",
      },
    ],
    sameAs: SAME_AS,
    knowsAbout: [
      "Answer engine optimization",
      "AI search visibility",
      "Generative engine optimization",
      "Schema.org structured data",
      "Local business citation consistency",
      "Large language model brand recommendation",
    ],
  };
}

/** WebSite, with the scan form declared as the site's action. */
export function webSiteSchema() {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: `${SITE_ORIGIN}/`,
    name: "FootHold AEO",
    description: DESCRIPTION,
    inLanguage: "en-US",
    publisher: { "@id": ORG_ID },
  };
}

/**
 * The offer ladder, as schema.org Offers.
 *
 * Prices come from the pricing module in cents and are divided here rather than
 * written out, for the reason that module already gives: two copies of a price
 * in this codebase have drifted inside a single day before.
 *
 * The retainer is a compound price — setup plus monthly — which schema.org has
 * no clean single-Offer shape for, so it is published as its setup fee with the
 * recurring half in `priceSpecification`. Publishing only the $4,500 would read
 * as the whole cost of tier 3, which it is not.
 */
export function offersSchema() {
  return [
    {
      "@type": "Offer",
      "@id": `${SITE_ORIGIN}/pricing#solutions`,
      name: "Scan solutions",
      description:
        "The full fix list for your AI visibility scan: every finding with the " +
        "exact change that clears it, ranked by the points it puts back.",
      price: (SOLUTIONS_PRICE_CENTS / 100).toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${SITE_ORIGIN}/pricing`,
      seller: { "@id": ORG_ID },
    },
    {
      "@type": "Offer",
      "@id": `${SITE_ORIGIN}/pricing#done-for-you`,
      name: "Done-for-you build",
      description:
        "We do the work: site restructured for machine reading, listings " +
        "aligned, and a second machine-readable domain built and shipped.",
      price: (DONE_FOR_YOU_PRICE_CENTS / 100).toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${SITE_ORIGIN}/pricing`,
      seller: { "@id": ORG_ID },
    },
    {
      "@type": "Offer",
      "@id": `${SITE_ORIGIN}/pricing#retainer`,
      name: "Ongoing AEO retainer",
      description:
        "Six month engagement. Setup fee plus a monthly retainer, with the " +
        "same prompts re-run against the same competitors every month.",
      price: (RETAINER_SETUP_CENTS / 100).toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${SITE_ORIGIN}/pricing`,
      seller: { "@id": ORG_ID },
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: (RETAINER_MONTHLY_CENTS / 100).toFixed(2),
        priceCurrency: "USD",
        billingIncrement: 1,
        unitCode: "MON",
        referenceQuantity: {
          "@type": "QuantitativeValue",
          value: 1,
          unitCode: "MON",
        },
      },
    },
  ];
}

/** The thing we sell, as a Service, so the offers hang off something typed. */
export function serviceSchema() {
  return {
    "@type": "Service",
    "@id": `${SITE_ORIGIN}/#service`,
    serviceType: "Answer Engine Optimization",
    name: "Answer Engine Optimization (AEO)",
    description: DESCRIPTION,
    provider: { "@id": ORG_ID },
    areaServed: { "@type": "Country", name: "United States" },
    audience: {
      "@type": "BusinessAudience",
      audienceType:
        "Local and regional service businesses with high customer lifetime value",
    },
    offers: offersSchema(),
  };
}

/**
 * FAQPage.
 *
 * Takes the questions rather than owning them: the copy lives on the sales page
 * where it is written and read, and a second copy here would be a second thing
 * to update and a slow way to publish an answer we no longer give.
 */
export function faqSchema(faqs: ReadonlyArray<{ q: string; a: string }>) {
  return {
    "@type": "FAQPage",
    "@id": `${SITE_ORIGIN}/#faq`,
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

/** BreadcrumbList. Shallow site, so this is navigation context, not a hierarchy. */
export function breadcrumbSchema(
  trail: ReadonlyArray<{ name: string; path: string }>
) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_ORIGIN}${item.path}`,
    })),
  };
}

/**
 * Wraps nodes in one @graph.
 *
 * One script tag rather than several. Separate blocks parse fine, but they give
 * a consumer no reason to believe the Organization in block one is the provider
 * referenced in block three — inside a graph the @id references resolve.
 */
export function jsonLdGraph(nodes: object[]) {
  return { "@context": "https://schema.org", "@graph": nodes };
}
