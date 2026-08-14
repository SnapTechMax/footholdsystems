/**
 * How the Meta Pixel's custom data reaches the thank-you page.
 *
 * The Lead event fires on /guide/thanks rather than in the form, so a recorded
 * conversion means a page someone actually arrived at. But the form is where the
 * experiment arm is known, and the form soft-navigates — no props cross that
 * boundary, and putting the variant in the URL would put it in the address bar
 * of every lead. sessionStorage is the smallest thing that works.
 *
 * One key, defined once, because a writer and a reader that disagree about a
 * string fail silently and look exactly like a pixel that isn't installed.
 */
export const PIXEL_HANDOFF_KEY = "fh_pixel_lead";

/** Custom data attached to the Lead event. Shapes what lib/cro/meta.ts can split by. */
export interface PixelLeadPayload {
  content_name?: string;
  variant?: "a" | "b";
  experiment_id?: number | null;
}
