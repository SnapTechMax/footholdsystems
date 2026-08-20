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
  captureHeading: "Get the guide and the two prompts",
  captureSubcopy:
    "Give us an email address and it comes straight over. Two prompts printed in full that you can paste into a chat box today, the three frameworks we build with you, and the level your business is really on.",
  submitLabel: "Send me the guide →",
  heroCtaLabel: "Get the free guide →",
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
    BASE_CONTENT.captureHeading,
    "Two AI prompts you can use today",
    "Which of the 5 levels is your business on?",
    "The AI guide that skips the hype",
  ],
  captureSubcopy: [
    BASE_CONTENT.captureSubcopy,
    "Nine pages in plain English. Two prompts printed in full, and the three that are systems rather than something you paste.",
    "It's a ten minute read. You'll finish it with the level you're on and a prompt you can put to work the same afternoon.",
  ],
  submitLabel: [
    "Send me the guide →",
    "Send me the prompts →",
    "Get my copy →",
    "Show me my level →",
  ],
  heroCtaLabel: [
    "Get the free guide →",
    "Send me the prompts →",
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
