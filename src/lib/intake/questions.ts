import { z } from "zod";

/**
 * The build intake questionnaire, defined once as data.
 *
 * Four things need to agree about this form: the page that renders it, the
 * route that validates it, the email that summarizes it, and the admin screen
 * that reads it back. Written out four times they drift, and the way they drift
 * is silent — a field gets added to the form, nobody adds it to the digest, and
 * the answer sits in the database where nobody looks. So the questionnaire is a
 * list of objects and everything else iterates it.
 *
 * Client-safe. No server-only import, because the form imports this too and has
 * to validate against exactly the rules the route enforces.
 *
 * FIELD NAMES ARE STORED AS JSONB KEYS. Renaming one orphans every answer
 * already collected under the old name. Change the `label` freely; leave `name`
 * alone.
 */

export type IntakeFieldKind = "text" | "email" | "tel" | "textarea" | "select";

export interface IntakeOption {
  value: string;
  /** Shown in the dropdown, and used verbatim in the digest. */
  label: string;
}

export interface IntakeField {
  /** Stable storage key. See the warning above. */
  name: string;
  /** Shown above the input, and used as the heading in the digest. */
  label: string;
  kind: IntakeFieldKind;
  /** Required fields are the ones the build genuinely cannot start without. */
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: readonly IntakeOption[];
  /** Rows for a textarea. Sized to how long the honest answer is. */
  rows?: number;
  maxLength: number;
  autoComplete?: string;
}

export interface IntakeSection {
  id: string;
  title: string;
  blurb: string;
  fields: readonly IntakeField[];
}

/**
 * Eight sections, thirty-odd fields, eleven of them required.
 *
 * The ratio is the point. Everything here is worth having, but a form that
 * refuses to submit until all of it is filled in is a form that gets abandoned
 * at section four and finished never. So the required set is the answers the
 * work cannot start without, and the rest is marked optional and says so.
 */
export const INTAKE_SECTIONS: readonly IntakeSection[] = [
  {
    id: "you",
    title: "Who you are",
    blurb:
      "So we know who we are building for and where to send things while we work.",
    fields: [
      {
        name: "business_name",
        label: "Business name",
        kind: "text",
        required: true,
        hint: "Exactly as it should appear on the site, including LLC or Inc if you use it. Assistants compare this against your listings, and a name that reads three different ways in three places reads as three different businesses.",
        placeholder: "Acme Roofing LLC",
        maxLength: 200,
        autoComplete: "organization",
      },
      {
        name: "contact_name",
        label: "Your name",
        kind: "text",
        required: true,
        placeholder: "Jane Doe",
        maxLength: 200,
        autoComplete: "name",
      },
      {
        name: "email",
        label: "Email",
        kind: "email",
        required: true,
        hint: "Where the agreement and everything else goes.",
        placeholder: "you@yourbusiness.com",
        maxLength: 200,
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        kind: "tel",
        required: true,
        hint: "The number a customer should call. If a different number goes on the website, say which in the last box on this form.",
        placeholder: "(555) 123 4567",
        maxLength: 60,
        autoComplete: "tel",
      },
      {
        name: "best_time",
        label: "Best time to reach you",
        kind: "text",
        hint: "Optional. Saves a round of phone tag.",
        placeholder: "Mornings before 9, or after 5",
        maxLength: 200,
      },
    ],
  },
  {
    id: "business",
    title: "What you do",
    blurb:
      "The facts a model has to be able to state about you before it will put your name in an answer.",
    fields: [
      {
        name: "one_liner",
        label: "What you do, in one sentence",
        kind: "textarea",
        required: true,
        rows: 3,
        hint: "The way you would say it to someone who asked at a barbecue. Not the way it is written on your current website.",
        placeholder: "We re-roof houses in the San Gabriel Valley, mostly tile and asphalt shingle, mostly insurance work.",
        maxLength: 600,
      },
      {
        name: "services",
        label: "Every service you sell",
        kind: "textarea",
        required: true,
        rows: 7,
        hint: "One per line. Most profitable first. Include the ones you would happily take more of and the ones you only do occasionally, and say which is which.",
        placeholder: "Full roof replacement\nStorm damage repair\nGutter installation\nAnnual inspections (small, but they turn into replacements)",
        maxLength: 3000,
      },
      {
        name: "service_area",
        label: "Where you work",
        kind: "textarea",
        required: true,
        rows: 4,
        hint: "Cities, counties, a radius, or anywhere in the US. Be specific. This is what decides whether you get named when somebody asks for a business near them.",
        placeholder: "San Dimas, Glendora, La Verne, Claremont, Pomona. We will drive to Riverside for a full replacement but not for a repair.",
        maxLength: 1500,
      },
      {
        name: "years_trading",
        label: "How long you have been trading",
        kind: "text",
        hint: "Optional. A founding year is a verifiable fact, which makes it worth more than it looks.",
        placeholder: "Since 2009",
        maxLength: 120,
      },
      {
        name: "team_size",
        label: "How many people work there",
        kind: "text",
        hint: "Optional.",
        placeholder: "Me plus four crew",
        maxLength: 120,
      },
      {
        name: "hours",
        label: "Opening hours",
        kind: "textarea",
        rows: 3,
        hint: "Optional, but they belong in the structured data, and they have to match what your Google listing says.",
        placeholder: "Mon to Fri 7am to 5pm. Saturday by appointment. Emergency callouts any time.",
        maxLength: 600,
      },
      {
        name: "credentials",
        label: "Licenses, certifications, insurance, memberships",
        kind: "textarea",
        rows: 4,
        hint: "Optional, and one of the highest value boxes on this form. License numbers, trade bodies, manufacturer certifications, bonding. These are the claims a model can check.",
        placeholder: "CSLB license #123456. GAF Master Elite. Fully insured, $2m liability.",
        maxLength: 1500,
      },
    ],
  },
  {
    id: "customers",
    title: "Who you want",
    blurb:
      "Positioning gets decided before a word is written, and it gets decided from this.",
    fields: [
      {
        name: "ideal_customer",
        label: "The customer you want more of",
        kind: "textarea",
        required: true,
        rows: 4,
        hint: "Describe a real one if it is easier. The job, the budget, how they found you, why they said yes.",
        placeholder: "Homeowner, 40s to 60s, owns the house outright, wants it done once and done properly, gets three quotes and picks the middle one.",
        maxLength: 1500,
      },
      {
        name: "not_for",
        label: "Work you do not want",
        kind: "textarea",
        rows: 3,
        hint: "Optional, and more useful than it sounds. A site that repels the wrong job is doing half the qualifying for you.",
        placeholder: "Patch jobs under $500. Anything where the landlord is not the one paying.",
        maxLength: 1000,
      },
      {
        name: "why_you",
        label: "Why customers pick you over the other option",
        kind: "textarea",
        required: true,
        rows: 4,
        hint: "Not quality and service. Everyone writes that, which is why it persuades nobody and distinguishes nothing. The real reason, the one you would say out loud.",
        placeholder: "We do not use subs. Same four guys on every job, and I am on the roof for the first hour of every one.",
        maxLength: 1500,
      },
      {
        name: "competitors",
        label: "Two or three competitors",
        kind: "textarea",
        rows: 3,
        hint: "Optional. Names or website addresses. We look at who the assistants name in your area today.",
        placeholder: "Valley Roofing (valleyroofing.com)\nSomething like Pinnacle Exteriors, not sure of the URL",
        maxLength: 1000,
      },
    ],
  },
  {
    id: "questions",
    title: "What your buyers ask",
    blurb:
      "People do not type your services into an assistant. They type their questions. Pages that answer those questions are what get quoted back.",
    fields: [
      {
        name: "common_questions",
        label: "The questions you answer on every call",
        kind: "textarea",
        required: true,
        rows: 8,
        hint: "Five or ten if you can manage it. This is the most valuable box on the form. Every one of these is a question somebody is typing into ChatGPT right now, and the business whose site answers it is the business that gets named.",
        placeholder: "How long does a re-roof take?\nWill my insurance cover it?\nDo I have to move out?\nHow do I know if it needs replacing or just repairing?\nWhat happens if it rains halfway through?",
        maxLength: 4000,
      },
      {
        name: "objections",
        label: "What makes someone hesitate before buying",
        kind: "textarea",
        rows: 4,
        hint: "Optional. The thing they say right before they go quiet for two weeks.",
        placeholder: "Price, mostly. And they have been burned by a contractor who took a deposit and vanished.",
        maxLength: 1500,
      },
      {
        name: "pricing_display",
        label: "How much can we say about price?",
        kind: "select",
        required: true,
        hint: "Assistants repeat what they can read. A page with no number at all loses to one that has them, every time. Ranges are usually the right answer.",
        options: [
          { value: "", label: "Choose one" },
          { value: "exact", label: "Exact prices are fine" },
          { value: "ranges", label: "Ranges, not exact figures" },
          { value: "starting_from", label: "Starting from figures only" },
          { value: "none", label: "No prices at all" },
        ],
        maxLength: 40,
      },
      {
        name: "pricing_detail",
        label: "Prices or ranges we can publish",
        kind: "textarea",
        rows: 4,
        hint: "Optional, unless you picked something other than no prices above, in which case put the actual numbers here.",
        placeholder: "Repairs from $450. Full replacement $12k to $30k depending on square footage and material.",
        maxLength: 2000,
      },
    ],
  },
  {
    id: "proof",
    title: "Proof",
    blurb:
      "Anything a stranger could check without taking your word for it. Silence here does not read as neutral, it reads as unproven.",
    fields: [
      {
        name: "review_links",
        label: "Links to your reviews",
        kind: "textarea",
        rows: 5,
        hint: "Optional but do not skip it. Google Business Profile, Yelp, Facebook, Angi, Trustpilot, trade directories. One per line, and paste the whole address.",
        placeholder: "https://g.page/acme-roofing\nhttps://www.yelp.com/biz/acme-roofing",
        maxLength: 2000,
      },
      {
        name: "notable_work",
        label: "Work worth pointing at",
        kind: "textarea",
        rows: 4,
        hint: "Optional. Jobs, clients, numbers you can stand behind. Nothing gets published that you have not approved.",
        placeholder: "Re-roofed the fire station on Bonita in 2023. Around 40 full replacements a year.",
        maxLength: 2000,
      },
      {
        name: "guarantees",
        label: "Guarantees or warranties you actually honor",
        kind: "textarea",
        rows: 3,
        hint: "Optional. Only the ones you would honor on a bad day, because this goes in writing.",
        placeholder: "10 year workmanship warranty. Manufacturer warranty on materials, 30 to 50 years depending on the product.",
        maxLength: 1500,
      },
      {
        name: "awards",
        label: "Awards, press, anything you have been named in",
        kind: "textarea",
        rows: 3,
        hint: "Optional. Local paper counts. Chamber of commerce counts.",
        maxLength: 1500,
      },
    ],
  },
  {
    id: "web",
    title: "What you already have online",
    blurb:
      "Half this build is fixing what exists. We need to know what exists and who can let us in.",
    fields: [
      {
        name: "current_site",
        label: "Your current website",
        kind: "text",
        required: true,
        hint: "Paste the address. If you do not have one, write none.",
        placeholder: "acmeroofing.com",
        maxLength: 300,
        autoComplete: "url",
      },
      {
        name: "site_platform",
        label: "What it is built on",
        kind: "text",
        hint: "Optional. WordPress, Squarespace, Wix, Shopify, GoDaddy builder, custom. No idea is a completely fine answer and we will work it out.",
        placeholder: "WordPress, I think. A guy built it in 2019.",
        maxLength: 200,
      },
      {
        name: "registrar",
        label: "Where your domain is registered",
        kind: "text",
        hint: "Optional. GoDaddy, Namecheap, Google Domains, or wherever you bought it.",
        placeholder: "GoDaddy",
        maxLength: 200,
      },
      {
        name: "gbp_status",
        label: "Google Business Profile",
        kind: "select",
        required: true,
        hint: "The listing that shows up on the right of a Google search with your hours and reviews. Making it agree with the site is part of the work.",
        options: [
          { value: "", label: "Choose one" },
          { value: "claimed_access", label: "Claimed, and I can log in" },
          { value: "claimed_no_access", label: "Claimed, but I have lost access" },
          { value: "not_claimed", label: "Not claimed, or I do not think we have one" },
          { value: "not_applicable", label: "Not applicable, we have no physical presence" },
        ],
        maxLength: 40,
      },
      {
        name: "social_profiles",
        label: "Social profiles and directory listings you own",
        kind: "textarea",
        rows: 4,
        hint: "Optional. Facebook, Instagram, LinkedIn, Angi, Houzz, BBB, trade associations. One per line. Making these agree with each other is a specific part of the build.",
        maxLength: 2000,
      },
      {
        name: "access_notes",
        label: "Who can grant us access",
        kind: "textarea",
        rows: 3,
        hint: "Optional. Names and email addresses only. NEVER PUT A PASSWORD IN THIS FORM. We ask for access properly, through each platform's own invite, once the agreement is signed.",
        placeholder: "My nephew Sam set up the website, sam@example.com. I have the GoDaddy login myself.",
        maxLength: 1500,
      },
    ],
  },
  {
    id: "assets",
    title: "Assets",
    blurb: "Whatever you already have. Missing pieces are normal and we work around them.",
    fields: [
      {
        name: "asset_links",
        label: "Links to your logo and photos",
        kind: "textarea",
        rows: 4,
        hint: "Optional. A Google Drive or Dropbox folder is ideal, set to anyone with the link. Real photos of real work beat stock photography every time, even bad ones off a phone.",
        maxLength: 2000,
      },
      {
        name: "brand_notes",
        label: "Colors, fonts, anything to avoid",
        kind: "textarea",
        rows: 3,
        hint: "Optional.",
        placeholder: "Green and grey, same as the trucks. Please no swooshes.",
        maxLength: 1000,
      },
      {
        name: "existing_copy",
        label: "Any writing you want kept",
        kind: "textarea",
        rows: 3,
        hint: "Optional. If there is a paragraph on your current site you are attached to, say so now rather than after it is rewritten.",
        maxLength: 2000,
      },
    ],
  },
  {
    id: "finish",
    title: "How this ends",
    blurb: "What a finished build has to do for you.",
    fields: [
      {
        name: "lead_preference",
        label: "How should a new customer reach you?",
        kind: "select",
        required: true,
        options: [
          { value: "", label: "Choose one" },
          { value: "phone", label: "Call me" },
          { value: "form", label: "Fill in a form that emails me" },
          { value: "booking", label: "Book a slot in my calendar" },
          { value: "text", label: "Text me" },
          { value: "other", label: "Something else, described below" },
        ],
        maxLength: 40,
      },
      {
        name: "booking_link",
        label: "Your booking link, if you use one",
        kind: "text",
        hint: "Optional. Calendly, Acuity, Housecall Pro, whatever it is.",
        maxLength: 400,
      },
      {
        name: "success_metric",
        label: "What would make this build worth it",
        kind: "textarea",
        rows: 3,
        hint: "Optional, and worth answering honestly rather than modestly. It is what we point at in three months.",
        placeholder: "Two extra full replacements a month would pay for it ten times over.",
        maxLength: 1000,
      },
      {
        name: "deadline",
        label: "Anything driving a date",
        kind: "text",
        hint: "Optional. Busy season, a trade show, a rebrand.",
        maxLength: 300,
      },
      {
        name: "anything_else",
        label: "Anything else we should know",
        kind: "textarea",
        rows: 4,
        hint: "Optional. Including anything above that did not have a box.",
        maxLength: 3000,
      },
    ],
  },
] as const;

/** Every field, flat, in form order. What the digest and the validator iterate. */
export const INTAKE_FIELDS: readonly IntakeField[] = INTAKE_SECTIONS.flatMap(
  (section) => section.fields
);

export const REQUIRED_FIELD_COUNT = INTAKE_FIELDS.filter(
  (field) => field.required
).length;

/** Look a field up by its storage key. Used when rendering stored answers. */
export function intakeField(name: string): IntakeField | undefined {
  return INTAKE_FIELDS.find((field) => field.name === name);
}

/**
 * Human wording for a stored select value.
 *
 * The digest shows "Ranges, not exact figures", not "ranges". The raw value is
 * what is stored, because a label is copy and copy changes.
 */
export function displayAnswer(field: IntakeField, value: string): string {
  if (field.kind !== "select") return value;
  return field.options?.find((option) => option.value === value)?.label ?? value;
}

/* ── validation ───────────────────────────────────────────────────────────── */

/**
 * One field's rules, derived from its definition.
 *
 * Empty passes for anything optional, which is why the format checks sit in a
 * refinement after the emptiness check rather than in the base type: an
 * optional email field left blank is not a malformed email address.
 */
function fieldSchema(field: IntakeField): z.ZodType<string> {
  let schema = z
    .string()
    .trim()
    .max(
      field.maxLength,
      `"${field.label}" is longer than we can store. Trim it to ${field.maxLength} characters or fewer.`
    );

  if (field.required) {
    schema = schema.min(
      1,
      field.kind === "select"
        ? `Choose an option for "${field.label}".`
        : `"${field.label}" is needed before we can start.`
    );
  }

  return schema.superRefine((value, ctx) => {
    if (value === "") return;

    if (field.kind === "email" && !z.email().safeParse(value).success) {
      ctx.addIssue({
        code: "custom",
        message: "That email address doesn't look right.",
      });
    }

    if (
      field.kind === "select" &&
      !field.options?.some((option) => option.value === value)
    ) {
      ctx.addIssue({
        code: "custom",
        message: `"${value}" isn't one of the options for "${field.label}".`,
      });
    }
  });
}

/** Every answer, keyed by field name. Built from the list above, never by hand. */
export const IntakeAnswersSchema = z.object(
  Object.fromEntries(
    INTAKE_FIELDS.map((field) => [field.name, fieldSchema(field)])
  ) as Record<string, z.ZodType<string>>
);

export type IntakeAnswers = Record<string, string>;

/**
 * Wording beside the box they tick before submitting.
 *
 * Stored verbatim with the submission for the same reason CONSENT_TEXT is: a
 * record that somebody confirmed something is worth very little if nobody can
 * say what they were confirming. This one matters more than the marketing
 * consent does, because it is the sentence that says they are entitled to hand
 * over the accounts they are about to hand over.
 */
export const INTAKE_DECLARATION =
  "Everything here is accurate to the best of my knowledge, and I'm authorized to act for this business.";

export const IntakeRequestSchema = z.object({
  answers: IntakeAnswersSchema,
  declaration: z.literal(true, {
    message: "Please tick the box at the bottom to confirm the details.",
  }),
  declarationText: z.string().max(500).optional(),
  /** Their scan token, when they arrived from a report link. Optional. */
  scanToken: z.string().trim().max(200).optional(),
  /** Decoy field. Anything in it means the submission was automated. */
  honeypot: z.string().optional(),
  /** Milliseconds between the form rendering and the submission. */
  elapsedMs: z.number().optional(),
});

export type IntakeRequest = z.infer<typeof IntakeRequestSchema>;
