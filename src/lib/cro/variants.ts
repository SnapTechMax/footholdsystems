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
    "Drop your email and we'll send the guide straight over. Find the level your business is really on, and what the next one up is worth to an owner like you.",
  submitLabel: "Send me the guide →",
  // Says what actually happens: the guide, then the nurture sequence. Anything
  // here that promises a single email contradicts the 22 over 38 days that
  // ticking the box starts — see the note above VARIANT_LIBRARY.formFootnote.
  formFootnote:
    "Free. The guide now, then short AI tips over the next few weeks. Unsubscribe in one click.",
  heroCtaLabel: "Get the free guide →",
  formAboveFold: false,
};

/**
 * Layer an experiment's overrides over the shipped copy.
 *
 * Anything layered on has to still exist in this file. Experiments store a
 * *fully resolved* copy of the page — all six fields, not just the one under
 * test — so an experiment about the headline also freezes a copy of the
 * footnote as it read the day it started, and the winner of that experiment
 * becomes the baseline the next one builds on. Left alone, a line of copy
 * retired here goes on being served indefinitely, from a database row nobody
 * is looking at.
 *
 * That is not hypothetical: it is how a footnote promising a single email
 * outlived being deleted from the codebase while a 22-email sequence ran
 * behind it. Discarding unrecognised copy makes this file the last word on
 * what a visitor can be shown, which is the only version of this the legal
 * text can be audited against.
 *
 * Both arms of a running test are corrected identically, so this cannot bias a
 * result — it changes what the arms have in common, not what separates them.
 */
export function resolveContent(
  ...layers: (VariantContent | null | undefined)[]
): Required<VariantContent> {
  const resolved = { ...BASE_CONTENT };
  for (const layer of layers) {
    if (!layer) continue;
    for (const [key, value] of Object.entries(layer)) {
      if (value === undefined || value === null) continue;
      if (!isCurrentCopy(key, value)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (resolved as any)[key] = value;
    }
  }
  return resolved;
}

/**
 * Is this value still copy this codebase would choose to serve?
 *
 * Non-strings (the layout toggle) pass through — they carry no promises. A
 * field with no library has nothing to check against, so it passes too rather
 * than being silently pinned to the shipped default.
 */
function isCurrentCopy(field: string, value: unknown): boolean {
  if (typeof value !== "string") return true;
  const library = VARIANT_LIBRARY[field as LibraryField] as
    | readonly string[]
    | undefined;
  if (!library) return true;
  return value === BASE_CONTENT[field as keyof VariantContent] ||
    library.includes(value);
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
  /**
   * Every option here has to be true of what ticking the box actually starts:
   * 22 emails over 38 days, roughly daily for the first fortnight and spacing
   * out after. Reassurance is fine; a promise of one email and nothing further
   * is not, and it is the provider's terms rather than the law that punishes it.
   * Reassure with the unsubscribe and the fact we don't sell details instead.
   */
  formFootnote: [
    BASE_CONTENT.formFootnote,
    "Free. Unsubscribe in one click, and we never sell your details.",
    "The guide, then a few weeks of short, practical tips. Stop them any time.",
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
