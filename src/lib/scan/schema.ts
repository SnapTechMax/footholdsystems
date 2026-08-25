import { z } from "zod";
import { DEFAULT_CATEGORY } from "./categories";

/**
 * What a scan request has to look like.
 *
 * Client-safe — no server-only import — so the form and the route validate
 * against exactly the same rules. Every message is written to be shown to the
 * person who typed the thing, and comes back tagged with its field so the form
 * can put it under the right input.
 *
 * The route is a public endpoint. This is the only validation that actually
 * holds; the browser's `required` attributes are a convenience.
 */

export const ScanRequestSchema = z.object({
  /**
   * Validated loosely here and normalised properly in the route.
   *
   * Deliberately not `z.url()`: people type "example.com" without a scheme,
   * and rejecting that would fail the single most common way a website address
   * gets entered. `normaliseDomain` in ora.ts does the real parsing, and it is
   * server-side because it is also what stops us being pointed at internal
   * hosts.
   */
  url: z
    .string()
    .trim()
    .min(3, "Please add your website address.")
    .max(300, "That address is too long to be real.")
    .refine((v) => v.includes("."), {
      message: "That doesn't look like a website address. Try yourbusiness.com",
    }),

  email: z.email("That email address doesn't look right.").trim().max(200),

  /**
   * What kind of business this is, which decides the check set the scan is
   * scored against. Defaulted rather than required: the form preselects the
   * most common answer, and a submission that somehow arrives without one
   * should produce a slightly generic report rather than an error.
   */
  category: z
    .enum(["sbo", "ecommerce", "saas"])
    .optional()
    .default(DEFAULT_CATEGORY),

  /**
   * One box covering both the report and the follow-up emails.
   *
   * Required, so a literal rather than a boolean — there is no version of this
   * flow where we have somewhere to send the report but no permission to send
   * it. The exact wording shown is stored alongside, because "they ticked a
   * box" is worth very little if nobody can say what the box said at the time.
   */
  consent: z.literal(true, {
    message: "Please tick the box so we know where to send your results.",
  }),
  consentText: z.string().max(500).optional(),

  /** Campaign parameters from the landing URL. Sanitised in the route. */
  attribution: z.record(z.string(), z.unknown()).nullable().optional(),

  /** Decoy field — anything in it means the submission was automated. */
  honeypot: z.string().optional(),
  /** Milliseconds between the form rendering and the submission. */
  elapsedMs: z.number().optional(),
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;

/** Shape the form expects back on failure, so it can place messages per field. */
export interface ScanErrorResponse {
  error: string;
  field?: "url" | "email" | "consent" | "category";
}
