import { ANGLES, CTA_LABELS, CTA_LINES } from "./angles.mjs";
import { lintSet, lintScrollStop, lintVerdict, lintScenario, lintReferents } from "./voice.mjs";
import { COPY_LIMITS } from "./placements.mjs";

/**
 * One creative text set per query, three images under it.
 *
 * Everything is derived from a single integer seed, so a set can be handed to
 * somebody else as five digits and rebuilt exactly. That matters once an ad is
 * live and you want the file that produced it.
 */

/** mulberry32. Small, fast, and good enough that consecutive seeds don't rhyme. */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

/**
 * The three shapes from the swipe file, in the order they hit the reader.
 *
 * `fold` names the slot that has to survive truncation. Meta cuts the primary
 * text at roughly 125 characters on mobile and everything after it costs a tap,
 * so whichever slot is first is the entire ad for most people who see it.
 */
const STRUCTURES = [
  {
    id: "qualifier-open",
    name: "Qualifier open",
    note: "Names who this is for in line one. Repels everyone else on purpose.",
    order: ["qualifier", "hook", "body", "hammer", "ctaLine"],
  },
  {
    id: "skip-the-fluff",
    name: "Skip the fluff",
    note: "No runway. The claim lands first, the explanation is the reward for clicking.",
    order: ["hook", "body", "hammer", "ctaLine"],
  },
  {
    id: "loss-first",
    name: "Loss first",
    note: "Opens on what it costs, then says who it costs it from.",
    order: ["hook", "qualifier", "body", "hammer", "ctaLine"],
  },
];

/**
 * Build one set.
 *
 * `angleId` pins the argument when you want three variations on the same case
 * rather than three unrelated ones. Left off, the seed chooses.
 */
export function generateSet({ seed, angleId, voice }) {
  const r = rng(seed);
  const angle = angleId ? ANGLES.find((a) => a.id === angleId) ?? pick(r, ANGLES) : pick(r, ANGLES);
  const structure = pick(r, STRUCTURES);

  const qualifier = pick(r, angle.qualifier);
  const bodyBlock = pick(r, angle.body);
  const hammer = pick(r, angle.hammer);
  const ctaLabel = pick(r, CTA_LABELS);
  const ctaLine = pick(r, CTA_LINES);

  // The fold slot has to fit. Prefer a hook that survives truncation, and only
  // fall back to a long one when the angle has nothing shorter.
  const foldSlot = structure.order[0];
  const candidates = foldSlot === "qualifier" ? angle.qualifier : angle.hook;
  const fitting = candidates.filter((c) => c.length <= COPY_LIMITS.primaryText.soft);
  const foldText = fitting.length ? pick(r, fitting) : shortest(candidates);
  const hook = foldSlot === "hook" ? foldText : pick(r, angle.hook);
  const qual = foldSlot === "qualifier" ? foldText : qualifier;

  const slots = { qualifier: qual, hook, body: bodyBlock, hammer, ctaLine };
  const paragraphs = [];
  for (const key of structure.order) {
    const value = slots[key];
    if (Array.isArray(value)) paragraphs.push(...value);
    else paragraphs.push(value);
  }

  const headline = pick(r, angle.headline);
  const description = pick(r, angle.descriptor);

  /**
   * The lines the image must not simply repeat.
   *
   * The hammer, because on the statement concept it is literally printed under
   * the hook. The fold line, because it is the only copy most of the audience
   * reads. Deliberately not the headline field: that sits in its own row under
   * the image, and an image reinforcing the headline is how a good ad works.
   */
  const echo = [hammer, paragraphs[0]];

  const set = {
    seed,
    angle: { id: angle.id, name: angle.name },
    structure: { id: structure.id, name: structure.name, note: structure.note },
    primaryText: paragraphs.join("\n\n"),
    foldLine: paragraphs[0],
    headline,
    description,
    ctaLabel,
    ctaLine,
    hammer,
    stamp: angle.stamp,
    concepts: buildConcepts(r, angle, hammer, echo),
  };

  set.measure = measure(set);
  set.lint = lintSet(
    {
      "Primary text": set.primaryText,
      Headline: set.headline,
      Description: set.description,
      "CTA line": set.ctaLine,
      ...Object.fromEntries(set.concepts.map((c, i) => [`Image ${i + 1} text`, conceptText(c)])),
    },
    voice
  );

  /**
   * The big type clears a second bar.
   *
   * Body copy is read by somebody who has already stopped. The largest text on
   * the canvas is what makes them stop, and a line that closes a paragraph well
   * is the wrong tool for it. Applied to the headline of the two type-led
   * concepts: on the answer panel the largest text is a real question a buyer
   * typed, which is concrete by construction, and its caption is support type
   * doing the same job as the statement's subline.
   */
  /**
   * The copy carries the referent rules too, scoped by where it is read.
   *
   * In a Facebook feed the primary text sits above the image, so its first
   * line is read before the reader has seen anything at all. It gets the same
   * bar as image text: name the actor. After that, prose may use a pronoun as
   * long as the thing it points at has already been named, and the two short
   * fields get no pronouns because right column and inbox show them with no
   * primary text above.
   */
  for (const [field, value, mode] of [
    ["Fold line", set.foldLine, "cold"],
    ["Primary text", set.primaryText, "prose"],
    ["Headline", set.headline, "short"],
    ["Description", set.description, "short"],
  ]) {
    for (const problem of lintReferents(value, mode)) {
      set.lint.push({ field, ...problem });
    }
  }

  set.concepts.forEach((concept, i) => {
    if (concept.headline) {
      for (const problem of lintScrollStop(concept.headline, echo)) {
        set.lint.push({ field: `Image ${i + 1} hook`, ...problem });
      }
    }
    // The answer panel's verdict has its own bar: state the rule, not the result.
    if (concept.caption) {
      for (const problem of lintVerdict(concept.caption)) {
        set.lint.push({ field: `Image ${i + 1} verdict`, ...problem });
      }
    }
    // And the panel itself must not name a business, real or invented.
    if (concept.prompt) {
      for (const problem of lintScenario(concept)) {
        set.lint.push({ field: `Image ${i + 1} panel`, ...problem });
      }
    }
  });

  return set;
}

const shortest = (arr) => [...arr].sort((a, b) => a.length - b.length)[0];

/**
 * Three images, one argument.
 *
 * The brief is three ready-to-go ads under one block of text, so these are
 * three ways of saying the same thing rather than three different pitches.
 * The forms come straight from what Becker says performs: one bold statement,
 * one infographic, one that does not look like an ad at all.
 */
function buildConcepts(r, angle, hammer, echo) {
  // Prefer hooks that do not repeat a field the reader is about to read. Where
  // every hook in the angle collides, take them anyway and let the linter say
  // so on screen: a silent fallback that quietly ships a duplicate is worse
  // than a visible one.
  const usable = angle.imageHook.filter((h) => !lintScrollStop(h, echo).length);
  const pool = usable.length ? usable : angle.imageHook;

  const imageHook = pick(r, pool);
  // Two images saying the identical thing is worse than one of them echoing a
  // copy line, so the second concept takes a different hook either way.
  const alt = pool.filter((h) => h !== imageHook);
  const altPool = alt.length ? alt : angle.imageHook.filter((h) => h !== imageHook);

  return [
    {
      id: "statement",
      name: "Statement",
      note: "One focal point, poster type, nothing else on the canvas.",
      stamp: angle.stamp,
      headline: imageHook,
      subline: hammer.length <= 90 ? hammer : shortest(angle.hammer),
    },
    {
      id: "infographic",
      name: "Comparison",
      note: "The old world on the left, this one on the right. Reads in two seconds.",
      stamp: angle.stamp,
      headline: (altPool.length ? pick(r, altPool) : imageHook).replace(/\n/g, " "),
      rows: angle.proof,
      subline: hammer,
    },
    {
      id: "answer-panel",
      name: "Answer panel",
      note: "Looks like a result, not an ad. The mystery does the clicking.",
      stamp: "Cold search · no login, no history, no location",
      prompt: angle.scenario.prompt,
      answer: angle.scenario.answer,
      caption: angle.scenario.caption,
    },
  ];
}

const conceptText = (c) =>
  [c.headline, c.subline, c.prompt, c.answer, c.caption, ...(c.rows ?? []).flat()]
    .filter(Boolean)
    .join(" ")
    .replace(/\n/g, " ");

/** Character counts against Meta's display limits, for the UI's counters. */
function measure(set) {
  const check = (value, limit) => ({
    length: value.length,
    limit: limit.soft,
    over: value.length > limit.soft,
    label: limit.label,
    note: limit.note,
  });
  return {
    foldLine: check(set.foldLine, COPY_LIMITS.primaryText),
    headline: check(set.headline, COPY_LIMITS.headline),
    description: check(set.description, COPY_LIMITS.description),
  };
}

export function randomSeed() {
  return Math.floor(Math.random() * 90000) + 10000;
}

export { STRUCTURES };
