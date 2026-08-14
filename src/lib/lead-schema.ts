import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * What a lead submission has to look like.
 *
 * Deliberately client-safe — no server-only import — but nothing here is a
 * substitute for the browser's own `required` attributes. The route is a public
 * endpoint and this is the only validation that actually holds.
 *
 * Every message is written to be shown to the person who typed the thing. A
 * validation failure comes back with the field it belongs to so the form can put
 * it under the right input, which is the difference between "fix this" and
 * "something went wrong".
 */

/** Phone numbers are entered by Americans on a US landing page. */
const DEFAULT_COUNTRY = "US";

/**
 * Normalised to E.164 as part of parsing, not after it.
 *
 * The stored value is what a dialler and a CRM can both use — `+19094076602`
 * rather than whichever of the six ways to write that number someone chose. A
 * number that cannot be parsed is rejected here rather than being written to the
 * sheet as typed, because a sheet full of unreachable numbers looks exactly like
 * a sheet full of reachable ones.
 */
const phone = z
  .string()
  .trim()
  .min(1, "Please add a phone number so we can reach you.")
  .transform((value, ctx) => {
    const parsed = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
    if (!parsed || !parsed.isValid()) {
      ctx.addIssue({
        code: "custom",
        message:
          "That doesn't look like a working phone number. Include the area code — for example (909) 407-6602.",
      });
      return z.NEVER;
    }
    return parsed.number;
  });

export const LeadSchema = z.object({
  name: z.string().trim().min(1, "Please add your first name."),
  email: z.email("That email address doesn't look right.").trim(),
  phone,

  /**
   * Agreement to be contacted about their results. Separate from `optIn`, which
   * is agreement to marketing email — different permissions, different laws, and
   * collapsing them would make neither record worth anything. Required, so a
   * literal rather than a boolean.
   */
  contactConsent: z.literal(true, {
    message: "Please tick the box so we know we can contact you.",
  }),

  /** Marketing email opt-in. Gated by geography in the route, not here. */
  optIn: z.boolean().optional().default(false),
  /** Wording shown beside the marketing checkbox, stored with the consent record. */
  consentText: z.string().max(500).optional(),

  source: z.string().max(200).optional(),

  /** Set when a CRO experiment is running on the page that produced the lead. */
  experimentId: z.number().int().nullable().optional(),
  variant: z.enum(["a", "b"]).nullable().optional(),

  /** Campaign parameters from the landing URL. Sanitised in the route. */
  attribution: z.record(z.string(), z.unknown()).nullable().optional(),

  /** Decoy field — anything in it means the submission was automated. */
  honeypot: z.string().optional(),
  /** Milliseconds between the form rendering and the submission. */
  elapsedMs: z.number().optional(),
});

export type LeadInput = z.infer<typeof LeadSchema>;

export interface FieldError {
  /** Which input to put the message under, when it belongs to one. */
  field: string | null;
  message: string;
}

/**
 * First problem, as something the form can render.
 *
 * One at a time rather than all of them: the form shows errors inline beside the
 * input, and a person fixing a phone number does not benefit from also being told
 * about their email in the same breath.
 */
export function firstFieldError(error: z.ZodError): FieldError {
  const issue = error.issues[0];
  const path = issue?.path?.[0];
  return {
    field: typeof path === "string" ? path : null,
    message: issue?.message ?? "Please check the form and try again.",
  };
}
