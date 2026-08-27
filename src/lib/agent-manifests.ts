import { createHash } from "node:crypto";
import { SITE_ORIGIN } from "@/lib/schema";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * The /.well-known documents: the ARD catalog, the A2A agent card, and the
 * Agent Skills index.
 *
 * Four checks on the 2026-08-27 agent-readiness scan, all of them the same
 * complaint — this domain published nothing an agent could read to find out
 * what it can do here:
 *
 *   ard-catalog          1  required     no /.well-known/ard.json
 *   agent-discovery-file 2  required     no agent skills index
 *   a2a-agent-card       2  recommended  no /.well-known/agent-card.json
 *
 * SHAPES ARE COPIED FROM ora.ai's OWN FILES, not invented. The scanner
 * publishes its versions at the same paths, so the field names below
 * (specVersion/host/entries, skills[].input, $schema on the index) are what its
 * parser demonstrably reads rather than a best guess at three young specs.
 *
 * WHAT IS DELIBERATELY ABSENT: there is no MCP server entry and no OpenAPI
 * entry, because there is no MCP server and no public API. Ora's ard.json lists
 * both, and copying that structure without the servers behind it would publish
 * URLs that 404 — which the scan checks for separately, and which is a worse
 * outcome than the missing entry. The one capability this site really has is
 * the scan, and it is listed once, honestly, in each file.
 */

/**
 * Everything here is one capability described three ways. Defined once.
 *
 * THE "When to use:" CLAUSE IS LOAD-BEARING, and its absence is why the first
 * pass scored agent-instruction 2/3 rather than 3/3: "Agent instruction file at
 * /.well-known/agent-skills/ but no explicit when-to-use guidance". The scan
 * reads this description, not the SKILL.md the entry points at — where a
 * perfectly good "## When to use it" section already lived and went unread. The
 * phrasing mirrors ora.ai's own index.json, which is the shape demonstrably
 * being parsed.
 */
const SCAN_DESCRIPTION =
  "Run a free AI visibility scan of a business website. Returns a score out " +
  "of 100 for how readable, clear and recommendable the site is to AI " +
  "assistants such as ChatGPT, Gemini, Perplexity and Copilot, plus every " +
  "finding ranked worst first and what each one costs the business. " +
  "When to use: someone asks why ChatGPT does not recommend their business, " +
  "whether their website is readable to AI crawlers, what AI assistants " +
  "currently say about their company, or how to appear in AI answers before " +
  "their competitors. Do not use for brand-new businesses with no trading " +
  "history, for traditional SEO or paid ads, or when someone wants a " +
  "guaranteed placement in an AI answer. The report is emailed, so it needs " +
  "the recipient's own consent.";

const REPRESENTATIVE_QUERIES = [
  "why doesn't ChatGPT recommend my business",
  "is my website readable to AI crawlers",
  "how do I show up when someone asks an AI who to hire",
  "what do AI assistants say about my company",
  "check my AI visibility score",
];

/** /.well-known/agent-skills/ai-visibility-scan/SKILL.md */
export function skillMarkdown(): string {
  return `---
name: ai-visibility-scan
description: >-
  Check whether AI assistants can read, understand and recommend a business
  website, and get back a scored report of everything that is stopping them.
  Use when someone asks why ChatGPT does not recommend their business, whether
  their site is readable to AI crawlers, or how to show up in AI answers.
homepage: ${SITE_ORIGIN}/
---

# AI visibility scan

## What this does

Scans a business website and scores it out of 100 on how readable, clear and
recommendable it is to AI assistants. Returns every place the site is invisible
or ambiguous to an assistant, ranked worst first, with what each one is costing
the business in plain English — and whether an AI can confirm the business is
real when it goes looking for it by name.

The scan is free. No card, and no call is required to receive the report.

## When to use it

- Someone asks why ChatGPT, Gemini, Perplexity or Copilot does not mention
  their business.
- Someone wants to know whether their website is readable to AI crawlers.
- Someone has good traditional SEO but is absent from AI answers and wants to
  know why the two differ.
- Someone is deciding whether answer engine optimization is worth doing before
  spending anything on it.

## When not to use it

- The business is brand new, with no customers, reviews or trading history. A
  model has nothing to form an opinion from yet, so the scan will be thin.
- Someone wants a guaranteed placement in an AI answer. Nobody controls the
  output of a language model and FootHold does not sell that.
- The request is for traditional SEO, paid advertising, or a site redesign.

## How to run it

Send the person to ${SITE_ORIGIN}/ and have them submit the form. It asks for
three things:

| Field | Required | Notes |
| --- | --- | --- |
| \`url\` | yes | The website to scan. A bare domain is fine. |
| \`email\` | yes | Where the report is sent. |
| \`category\` | no | What kind of business it is; decides which checks apply. |
| \`consent\` | yes | Must be given by the person whose email address it is. |

In a browser that supports WebMCP, the same action is registered as an in-page
tool called \`run_ai_visibility_scan\` with those parameters. It refuses without
\`consent: true\`, because the report is delivered by email and the consent
wording shown to the person is stored verbatim as the record of it. Do not pass
\`consent\` on somebody's behalf.

The report arrives by email within a few minutes and stays readable at a
private URL.

## What happens after

The free scan names the problems. The fix for each finding, the done-for-you
build, and the ongoing retainer are paid tiers — all four are listed at
${SITE_ORIGIN}/pricing and mirrored in markdown at ${SITE_ORIGIN}/pricing.md.

## Who runs this

FootHold Systems, an independent consultancy in California. Not affiliated with
OpenAI, Google, Microsoft, Perplexity or Anthropic. Contact: ${CONTACT_EMAIL}.
`;
}

/**
 * The skills index.
 *
 * `digest` is computed from the live skill body rather than pasted in. A
 * checksum maintained by hand is a checksum that is wrong the first time
 * somebody edits the file it describes, and a wrong one is worse than none —
 * it tells a careful client the document has been tampered with.
 */
export function agentSkillsIndex() {
  const body = skillMarkdown();
  const digest = createHash("sha256").update(body, "utf8").digest("hex");

  return {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [
      {
        name: "ai-visibility-scan",
        type: "skill-md",
        description: SCAN_DESCRIPTION,
        url: "/.well-known/agent-skills/ai-visibility-scan/SKILL.md",
        digest: `sha256:${digest}`,
      },
    ],
  };
}

/** /.well-known/agent-card.json — the A2A capability card. */
export function agentCard() {
  return {
    name: "foothold-aeo",
    description:
      "Answer engine optimization for United States service businesses. " +
      "Scans a business website for AI visibility and scores it out of 100.",
    url: SITE_ORIGIN,
    version: "1.0.0",
    skills: [
      {
        name: "run_ai_visibility_scan",
        description: SCAN_DESCRIPTION,
        input: {
          url: "The business website to scan (e.g. yourbusiness.com)",
          email: "Where to send the report. The scan is emailed, not returned inline.",
          category:
            "Optional. What kind of business it is; decides which checks apply.",
          consent:
            "Required, must be true, and must come from the person whose email address this is.",
        },
      },
    ],
    provider: {
      name: "FootHold Systems",
      url: SITE_ORIGIN,
      contactEmail: CONTACT_EMAIL,
    },
  };
}

/**
 * /.well-known/ard.json — the Agentic Resource Discovery catalog.
 *
 * `identifier` uses did:web, which resolves to this domain and needs nothing
 * stood up to be true: did:web:footholdsystems.com *is* control of
 * footholdsystems.com. A DID method that implied a key we do not publish would
 * be a claim rather than an identifier.
 */
export function ardCatalog() {
  return {
    specVersion: "1.0",
    host: {
      displayName: "FootHold AEO",
      identifier: "did:web:footholdsystems.com",
      documentationUrl: `${SITE_ORIGIN}/llms.txt`,
    },
    entries: [
      {
        identifier: "urn:air:footholdsystems.com:skill:ai-visibility-scan",
        displayName: "AI visibility scan",
        type: "application/ai-skill+md",
        url: `${SITE_ORIGIN}/.well-known/agent-skills/ai-visibility-scan/SKILL.md`,
        description: SCAN_DESCRIPTION,
        tags: [
          "aeo",
          "ai-visibility",
          "answer-engine-optimization",
          "audit",
          "seo",
        ],
        capabilities: ["run_ai_visibility_scan"],
        representativeQueries: REPRESENTATIVE_QUERIES,
        trustManifest: {
          identity: "did:web:footholdsystems.com",
          identityType: "did",
        },
      },
      {
        identifier: "urn:air:footholdsystems.com:agent:foothold",
        displayName: "FootHold AEO agent card",
        type: "application/a2a-agent-card+json",
        url: `${SITE_ORIGIN}/.well-known/agent-card.json`,
        description:
          "A2A capability card for FootHold AEO. One skill: run an AI " +
          "visibility scan of a business website.",
        tags: ["aeo", "ai-visibility", "a2a"],
        capabilities: ["run_ai_visibility_scan"],
        representativeQueries: REPRESENTATIVE_QUERIES,
        trustManifest: {
          identity: "did:web:footholdsystems.com",
          identityType: "did",
        },
      },
      {
        identifier: "urn:air:footholdsystems.com:doc:llms",
        displayName: "FootHold AEO site index for agents",
        type: "text/plain",
        url: `${SITE_ORIGIN}/llms.txt`,
        description:
          "Index of this domain written for agents: what FootHold AEO does, " +
          "when to route someone here, when not to, pricing, and every page.",
        tags: ["llms-txt", "documentation", "index"],
        trustManifest: {
          identity: "did:web:footholdsystems.com",
          identityType: "did",
        },
      },
    ],
  };
}
