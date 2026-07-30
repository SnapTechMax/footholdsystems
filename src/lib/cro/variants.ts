import type { VariantContent } from "./types";

/**
 * The knobs an experiment may turn on /guide, and the copy that ships when no
 * experiment is running.
 *
 * Keeping the surface small and explicit is deliberate. Every extra knob splits
 * the same traffic further, and at this site's volume a test needs well over a
 * thousand impressions per arm to conclude anything. A handful of high-leverage
 * fields is worth more than free rein over the page.
 */

export const BASE_CONTENT: Required<VariantContent> = {
  captureHeading: "Get the 5 Levels of AI",
  captureSubcopy:
    "Drop your email and we'll send the guide straight over. Find the level your small business is really on, and what the next one up is worth to an owner like you.",
  submitLabel: "Send me the guide →",
  formFootnote: "Free. One email. No spam, no drip sequence you can't escape.",
  heroCtaLabel: "Get the free guide →",
  formAboveFold: false,
};

/** Layer an experiment's overrides over the shipped copy. */
export function resolveContent(
  ...layers: (VariantContent | null | undefined)[]
): Required<VariantContent> {
  const resolved = { ...BASE_CONTENT };
  for (const layer of layers) {
    if (!layer) continue;
    for (const [key, value] of Object.entries(layer)) {
      if (value !== undefined && value !== null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (resolved as any)[key] = value;
      }
    }
  }
  return resolved;
}

/** Candidate copy the rules engine may reach for, grouped by the field it changes. */
export const VARIANT_LIBRARY = {
  captureHeading: [
    "Get the 5 Levels of AI",
    "Find your level in ten minutes",
    "Which of the 5 levels is your business on?",
    "The AI guide that skips the hype",
  ],
  captureSubcopy: [
    BASE_CONTENT.captureSubcopy,
    "Nine pages, plain English, no jargon. Find your level, then find out what staying there costs you every month.",
    "Send it over and you'll know your level before your next coffee. What that level is costing you is the part most owners get wrong.",
  ],
  submitLabel: [
    "Send me the guide →",
    "Send it to me →",
    "Get my copy →",
    "Show me my level →",
  ],
  formFootnote: [
    "Free. One email. No spam, no drip sequence you can't escape.",
    "Free. One email, then nothing unless you ask.",
    "No spam. Unsubscribe is one click, and we never sell your details.",
  ],
  heroCtaLabel: [
    "Get the free guide →",
    "Send me the guide →",
    "Find my level →",
  ],
} as const satisfies Record<string, readonly string[]>;

export type LibraryField = keyof typeof VARIANT_LIBRARY;

/**
 * Pick a challenger value for a field that isn't the one currently live.
 * Returns null when the library has nothing new to offer.
 */
export function nextCandidate(
  field: LibraryField,
  current: string,
  alreadyTried: string[]
): string | null {
  const seen = new Set([current, ...alreadyTried]);
  for (const option of VARIANT_LIBRARY[field]) {
    if (!seen.has(option)) return option;
  }
  return null;
}
