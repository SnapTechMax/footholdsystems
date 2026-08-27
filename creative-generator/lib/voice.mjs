import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTEXT_DIR = join(HERE, "..", "..", "context");

/**
 * The voice file is the source of truth, not a copy of it.
 *
 * Two of the house rules live as lists inside `context/voice.md` and get edited
 * there, so they are parsed out at boot rather than duplicated here. Editing
 * the banned-vocabulary line in voice.md changes what this generator will
 * refuse to ship, with no code change. The structural rules below (dashes,
 * exclamation marks, spelling, invented numbers) are not lists in that file,
 * so they are stated here and cite the line they come from.
 */
export async function loadVoice() {
  const voice = await readFile(join(CONTEXT_DIR, "voice.md"), "utf8");
  return {
    raw: voice,
    banned: [...parseList(voice, "Overused AI vocabulary:"), ...parseList(voice, "Sales-brochure language:")],
    signaturePhrases: parseQuotedBullets(voice, "### Phrases it uses"),
  };
}

/** Pull `a, b, c` out of a bullet that starts with the given label. */
function parseList(md, label) {
  const idx = md.indexOf(label);
  if (idx === -1) return [];
  // The list may wrap over several lines and ends at the next bullet or blank line.
  const rest = md.slice(idx + label.length);
  const end = rest.search(/\n\s*\n|\n- /);
  return rest
    .slice(0, end === -1 ? undefined : end)
    .replace(/\n\s+/g, " ")
    .split(",")
    .map((s) => s.trim().replace(/\.$/, "").toLowerCase())
    .filter(Boolean);
}

/** The `- "…"` bullets under a heading. */
function parseQuotedBullets(md, heading) {
  const idx = md.indexOf(heading);
  if (idx === -1) return [];
  const block = md.slice(idx + heading.length).split(/\n### /)[0];
  return [...block.matchAll(/^- "(.+)"$/gm)].map((m) => m[1]);
}

/* --------------------------------------------------------------- RULES -- */

/**
 * Numbers the business can actually stand behind. Everything here is either a
 * price, a reproducible scan result, or a count of something that exists.
 * `offer.md`: "Invented statistics. No fabricated percentages, adoption figures
 * or '93% of buyers' claims."
 */
const TRUE_NUMBERS = [
  "20 out of 100", "20/100", "twenty out of a hundred", "grade f",
  "91/100", "42/100", "91 out of 100", "42 out of 100",
  "$49", "$1,497", "1,497",
  "60 seconds", "four signals", "4 signals",
  "two to three weeks", "ten results", "one answer", "page two",
];

const BRITISH = [
  ["optimise", "optimize"], ["optimised", "optimized"], ["optimisation", "optimization"],
  ["personalised", "personalized"], ["personalisation", "personalization"],
  ["prioritise", "prioritize"], ["prioritised", "prioritized"],
  ["recognise", "recognize"], ["realise", "realize"], ["organise", "organize"],
  ["analyse", "analyze"], ["apologise", "apologize"],
  ["colour", "color"], ["favour", "favor"], ["behaviour", "behavior"],
  ["centre", "center"], ["defence", "defense"], ["licence", "license"],
];

/**
 * Claims that would contradict the page the ad points at. The sales page tells
 * the reader outright that anyone promising a ranking is lying, so an ad that
 * promises one buys a bounce and a lost trust.
 */
const FORBIDDEN_CLAIMS = [
  { re: /\bguarantee[ds]?\b/i, why: "offer.md forbids any guaranteed ranking. The sales page calls it lying." },
  { re: /\b(number one|#1|no\.? ?1)\b/i, why: "Implies a guaranteed position. Explicitly disowned on the page." },
];

const AFFILIATION = [
  { re: /\b(partner|partnered|official|affiliated)\b.{0,24}\b(openai|google|gemini|perplexity|microsoft|anthropic|chatgpt)\b/i, why: "No affiliation with any model provider. Stated in the footer." },
];

/**
 * A negator anywhere in the field flips a forbidden claim into a disavowal.
 *
 * The strongest angle in the bank is the one that says nobody can guarantee
 * this and anyone promising it is lying, which is the sales page's own
 * position. A flat keyword ban would delete FootHold's best hook to protect it
 * from a claim it is in the middle of refusing to make. Checked across the
 * whole field rather than the sentence, because ad fields are short and the
 * refusal often sits in the line before the claim.
 */
const NEGATORS = /\b(no|nobody|no one|not|cannot|can'?t|won'?t|never|isn'?t|lying|lie[sd]?|walk away|cautious|caution|suspicious|beware|refuse)\b/i;

/**
 * Tier 3 lives in a closed funnel behind a published handover. `offer.md`:
 * "Nothing on the site or in the email sequence mentions it otherwise."
 * A cold ad is the furthest thing from that page.
 */
const TIER_3_LEAKS = [
  { re: /\$15,?000/, why: "The $15,000 guarantee is tier 3 only." },
  { re: /\$?2,?500\s*(\/|per )?\s*(mo|month)/i, why: "The retainer price is tier 3 only." },
  { re: /\$4,?500/, why: "Retainer setup fee is tier 3 only." },
  { re: /\b180 days?\b/i, why: "The 180-day clause is tier 3 only." },
  { re: /\.gov\b/i, why: "The .gov backlinks are tier 3 only." },
];

/**
 * Two tier-3 words that a negation makes legitimate rather than dangerous.
 *
 * offer.md calls the $1,497 being one-off "a selling point against agencies,"
 * so "not a retainer" and "no monthly fee" are the copy doing its job. Offering
 * a retainer in cold traffic is the thing that must not happen, and that reads
 * the same way to the negator check as an unqualified guarantee does.
 */
const TIER_3_UNLESS_NEGATED = [
  { re: /\bretainer\b/i, why: "Tier 3 must not be offered in top-of-funnel copy." },
  { re: /\bmonthly\b/i, why: "offer.md: no monthly anything in tiers 1 or 2." },
];

/* -------------------------------------------------------- SCROLL STOP -- */

/**
 * The extra bar image text has to clear.
 *
 * Body copy gets read because somebody already stopped. Image text is what
 * makes them stop, and the two jobs are not the same: a line that closes a
 * paragraph beautifully ("Vague businesses are unrecommendable") is a
 * conclusion, and a conclusion is something you agree with rather than
 * something that arrests your thumb.
 *
 * Becker's own stoppers are never conclusions. "If your business buys ads, I
 * can guarantee that your tracking is off by 30-40%." "You're going to spend
 * $100,000 on ads this year, and $15,000 of that is going to be wasted."
 * "This is not for beginners." Every one is an accusation or an event aimed at
 * a specific reader, and every one leaves a question the click has to answer.
 *
 * Three testable things fall out of that, and they are what this checks.
 */
export const SCROLL_STOP = {
  maxWords: 8,
  maxChars: 48,
};

/** Somebody has to be in it, or something specific has to be. */
const PRESENCE = /\b(you|your|yours|we|our|ours|us|my|me|i)\b/i;


const norm = (v) => String(v).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Words that carry the meaning. Function words are dropped because two lines
 * both containing "it" and "so" are not saying the same thing, and leaving
 * them in floats the overlap score on every pair.
 */
const STOPWORDS = new Set(
  ("a all an and are as at be been but by can do does for from get gets got had has have how i if in is it " +
   "its me my no not of on one only or our ours out so than that the their them then there they this to two " +
   "up us was we what when which who why will with you your yours").split(" ")
);

function contentWords(text) {
  return new Set(norm(text).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w)));
}


/**
 * Who is doing the thing. One of these has to appear in image text.
 * Deliberately excludes Google: an ad that names only Google reads as an SEO
 * ad, which is the exact confusion this whole product exists to correct.
 */
const NAMED_ACTOR = /\b(ai|chatgpt|gemini|perplexity|copilot|assistant|answer engine)\b/i;


/** Pronouns that stand in for whoever else is in the story. */
const THIRD_PARTY = /\b(they|them|their|they'?re)\b/i;

/**
 * Nouns that give those pronouns something to point at.
 *
 * "Competitor" is the one that matters: it is the word the reader feels, and
 * any line that means the rival should use it rather than gesture at it. The
 * rest are here because prose legitimately says "they" about customers,
 * sources or businesses, and a rule that only accepted "competitor" would
 * force the word into sentences that are not about the rival at all.
 *
 * This checks that *some* noun precedes the pronoun, not that the reader picks
 * the right one. For the rival specifically the swipe file is the authority:
 * say "your competitor".
 */
const NAMED_PARTY = /\b(competitors?|rivals?|agenc(?:y|ies)|vendors?|somebody|someone|nobody|people|customers?|buyers?|businesses|owners?|specialists?|providers?|sources?|reviews?|models?|assistants?|engines?|leads?|clients?|directories|listings?|business|categor(?:y|ies)|trades?|sites?|websites?)\b/i;

/**
 * Image text that a body-copy line would pass but a scroll-stopper should not.
 *
 * @param text     the on-image line, hard breaks and all
 * @param echoOf   copy already in the ad, so the image cannot just repeat it
 */
export function lintScrollStop(text, echoOf = []) {
  const problems = [];
  const push = (rule, why) => problems.push({ rule, why });

  const flat = String(text).replace(/\s*\n\s*/g, " ").trim();
  const words = flat.split(/\s+/).filter(Boolean);

  // 1. Under a second to read. Anything longer is a caption being read by
  //    somebody who already stopped, which is the audience this is not for.
  if (words.length > SCROLL_STOP.maxWords) {
    push(`${words.length} words`, `Over ${SCROLL_STOP.maxWords}. Nobody reads a sentence at thumb speed.`);
  }
  if (flat.length > SCROLL_STOP.maxChars) {
    push(`${flat.length} characters`, `Over ${SCROLL_STOP.maxChars}. Too long to set at poster size and still be read.`);
  }

  // 2. Stake. A person in it, a real number, an overheard line, or a question
  //    put to the reader. Without one it is a statement about the category
  //    rather than about them.
  const hasStake = PRESENCE.test(flat) || /\d/.test(flat) || /["'“”]/.test(flat) || /\?/.test(flat);
  if (!hasStake) {
    push("no stake", "Nobody in it, no number, nothing overheard, no question. Reads as a slogan about the category.");
  }

  // 3. A turn. Setup then reversal, or a question. One declarative phrase is a
  //    label, and a label is the thing that got skipped.
  const beats = flat.split(/[.?]+/).map((b) => b.trim()).filter(Boolean).length;
  if (beats < 2 && !/\?/.test(flat)) {
    push("no turn", "One flat statement. A stopper needs a setup and a reversal, or it needs to ask something.");
  }

  // 5. Name the actor.
  //
  //    Somebody scrolling a feed was not thinking about AI ten seconds ago.
  //    "Ask it right now. Whose name comes back?" reads as a riddle to them:
  //    the first thing they do is wonder what "it" is, and by the time they
  //    would have worked it out they have scrolled. The hook has to supply the
  //    subject of its own sentence.
  //
  //    Google alone does not count. Naming the old search engine without
  //    naming the new one leaves the reader thinking this is an SEO ad.
  if (!NAMED_ACTOR.test(flat)) {
    push("no actor named", "Nothing says this is about AI. The reader has to guess what \"it\" is, and they were not thinking about AI a second ago.");
  }

  // 4b. Name the other party.
  //
  //     Same failure as "it", one step over. "ChatGPT named them" leaves the
  //     reader asking who "them" is, and the answer is the whole point: it is
  //     the business down the road that does what they do. Say "your
  //     competitor". The word is doing the emotional work of the ad and a
  //     pronoun throws it away.
  if (THIRD_PARTY.test(flat) && !NAMED_PARTY.test(flat)) {
    push("unnamed third party", "\"They\" and \"them\" have no antecedent here. If it means the rival, say \"your competitor\".");
  }

  // 4. Not a line the reader is about to read anyway. If the image repeats the
  //    hammer, the ad says one thing twice and stops nobody.
  //
  //    Substring matching is not enough. "Your homepage fits everyone, so it
  //    fits nobody" shares no phrase with "It matches everyone, so it matches
  //    nobody" and is plainly the same sentence, so content words are compared
  //    too: half of them in common means the reader is being told twice.
  const me = contentWords(flat);
  for (const other of echoOf) {
    const it = contentWords(other);
    if (!it.size || !me.size) continue;

    if (norm(flat) === norm(other) || norm(other).includes(norm(flat))) {
      push("echoes the copy", "Word for word what the copy underneath already says.");
      break;
    }

    // Calibrated at 0.6, not 0.5. Every line inside one angle is about the same
    // subject and will share some vocabulary; the bar has to sit above "shares
    // the topic" and below "is the same sentence."
    const shared = [...me].filter((w) => it.has(w)).length;
    if (shared / Math.min(me.size, it.size) >= 0.6) {
      push("restates the copy", "Same sentence in different words as a line in the ad below it.");
      break;
    }
  }

  return problems;
}

/**
 * Check one string against every house rule.
 * Returns [] when the line is shippable.
 */
export function lint(text, voice) {
  const problems = [];
  const push = (rule, why) => problems.push({ rule, why });

  if (/[—–]/.test(text)) push("em dash", "voice.md: em dashes reduced to five survivors, all price separators.");
  if (/!/.test(text)) push("exclamation mark", "voice.md: no exclamation marks anywhere.");

  for (const [uk, us] of BRITISH) {
    if (new RegExp(`\\b${uk}\\b`, "i").test(text)) push(`British spelling "${uk}"`, `voice.md: US throughout. Use "${us}".`);
  }

  for (const word of voice.banned) {
    if (word.length > 2 && new RegExp(`\\b${word}\\b`, "i").test(text)) {
      push(`banned word "${word}"`, "voice.md: listed under phrases it avoids.");
    }
  }

  if (/\bnot just\b[^.]{0,40}\b(it'?s|but)\b/i.test(text)) {
    push("not-just-X-it's-Y", "voice.md: the shape became audible and was cut.");
  }

  // Any percentage at all. The site deliberately contains none.
  const pct = text.match(/\d+(\.\d+)?\s?%/);
  if (pct) push(`invented statistic "${pct[0]}"`, "offer.md: no fabricated percentages. There is no sourced figure to use.");

  const multiplier = text.match(/\b\d+(\.\d+)?x\b/i);
  if (multiplier) push(`unsourced multiplier "${multiplier[0]}"`, "offer.md: no fabricated figures.");

  // The same claim spelled out in words. "Nine out of ten businesses" is no
  // more sourced than "90%", and it is the form that slips past a digit check.
  const WORD_NUM = "one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred";
  const worded = text.match(new RegExp(`\\b(${WORD_NUM})\\s+(?:out of|in)\\s+(${WORD_NUM})\\b`, "i"));
  if (worded && !TRUE_NUMBERS.some((n) => worded[0].toLowerCase().includes(n))) {
    push(`unverified ratio "${worded[0]}"`, "offer.md: no fabricated figures, spelled out or otherwise.");
  }

  for (const m of text.matchAll(/\b(\d[\d,]*)\s*(?:out of|\/)\s*(\d[\d,]*)\b/gi)) {
    const claim = m[0].toLowerCase().replace(/\s+/g, " ");
    if (!TRUE_NUMBERS.some((n) => claim.includes(n) || n.includes(claim))) {
      push(`unverified ratio "${m[0]}"`, "offer.md: only reproducible scan results may be quoted.");
    }
  }

  const disavowed = NEGATORS.test(text);
  for (const { re, why } of FORBIDDEN_CLAIMS) {
    const hit = text.match(re);
    if (hit && !disavowed) push(`forbidden claim "${hit[0]}"`, why);
  }

  for (const { re, why } of [...AFFILIATION, ...TIER_3_LEAKS]) {
    const hit = text.match(re);
    if (hit) push(`forbidden claim "${hit[0]}"`, why);
  }

  for (const { re, why } of TIER_3_UNLESS_NEGATED) {
    const hit = text.match(re);
    if (hit && !disavowed) push(`forbidden claim "${hit[0]}"`, why);
  }

  return problems;
}


/* ------------------------------------------------------------- VERDICT -- */

/**
 * The line under the answer panel is a verdict, and a verdict states a rule.
 *
 * "It did not matter here" reports the outcome of one search: true, small, and
 * arguable. "That does not matter anymore" states what is now the case, which
 * is the claim the whole page is built on and the reason to keep reading. Same
 * fact, and only one of them sounds like somebody who knows.
 *
 * Two things separate them, and both are checkable. A verdict does not scope
 * itself to the instance ("here", "this time"), and it does not report in the
 * past what it could assert in the present ("did", "was", "were", "had").
 *
 * Scoped to the answer-panel caption on purpose. The hammers in the copy bank
 * include "You did not lose. You were never entered." straight out of
 * voice.md, and that line is doing something else: it is the turn at the end of
 * an argument the reader has already been walked through.
 */
export const VERDICT_MAX_WORDS = 12;

const SCOPE_LIMITER = /\b(here|this time|in this case|for this one|that time|on this one)\b/i;
// Auxiliaries plus the handful of past main verbs that actually show up in a
// verdict position. Not a tense parser: it catches the mechanical tells, and a
// line can still be limp while passing. The rule narrows the failure mode, the
// rewrite does the rest.
const PAST_REPORT = /\b(did|was|were|had|happened|used to)\b/i;

export function lintVerdict(text) {
  const problems = [];
  const flat = String(text).replace(/\s+/g, " ").trim();
  const words = flat.split(/\s+/).filter(Boolean).length;

  if (words > VERDICT_MAX_WORDS) {
    problems.push({ rule: `${words} words`, why: `Over ${VERDICT_MAX_WORDS}. A verdict is short or it is a paragraph.` });
  }
  if (SCOPE_LIMITER.test(flat)) {
    problems.push({ rule: "scoped to the instance", why: "Shrinks the claim to this one search. State what is true now, not what happened once." });
  }
  if (PAST_REPORT.test(flat)) {
    problems.push({ rule: "reports instead of ruling", why: "Past tense reports an outcome. A verdict is present tense: this is how it works now." });
  }
  return problems;
}



/* ----------------------------------------------------------- REFERENTS -- */

/**
 * Name it before you lean on it.
 *
 * The image-text rules stopped hooks from making the reader supply the subject
 * of the sentence. The copy has the same problem and one place where it is
 * worse: in a Facebook feed the primary text sits *above* the image, so its
 * first line is read before the reader has seen anything at all. "You will
 * never know it happened" is the first thing a stranger reads, and "it" refers
 * to something they have not been told about yet.
 *
 * Prose is not image text, though, and a blanket ban would be wrong. Once AI
 * has been named, "it" is ordinary good writing and repeating "ChatGPT" in
 * every sentence reads like a robot. So the rule follows the reading order:
 *
 *   "cold"   the fold line. Nothing precedes it. Name the actor outright.
 *   "prose"  the whole primary text. A pronoun is fine, but only after its
 *            antecedent has been named.
 *   "short"  headline and description. Too short to establish an antecedent,
 *            and right column and inbox placements show them with no primary
 *            text at all, so a bare pronoun has nothing to point at anywhere.
 */
const ACTOR_PRONOUN = /\bit(?:'s)?\b/i;

export function lintReferents(text, mode) {
  const problems = [];
  const flat = String(text).replace(/\s+/g, " ").trim();
  const push = (rule, why) => problems.push({ rule, why });

  const actorAt = flat.search(NAMED_ACTOR);
  const pronounAt = flat.search(ACTOR_PRONOUN);
  const partyAt = flat.search(NAMED_PARTY);
  const thirdAt = flat.search(THIRD_PARTY);

  if (mode === "cold" && actorAt === -1) {
    push("no actor named", "This is the first line a stranger reads, above the image. Nothing has told them yet that any of this is about AI.");
  }

  if (mode === "short" && pronounAt !== -1 && actorAt === -1) {
    push("bare pronoun", "Right column and inbox show this field with no primary text above it, so \"it\" has nothing to point at.");
  }

  if (mode === "prose") {
    if (pronounAt !== -1 && (actorAt === -1 || pronounAt < actorAt)) {
      push("leans before it names", "A pronoun for the actor turns up before AI has been named. Name it first, then \"it\" is fine for the rest.");
    }
    // No third-party check here on purpose. Across paragraphs "they" almost
    // always points at the noun in the sentence before, and a rule that cannot
    // parse that flags correct writing far more often than it catches anything:
    // "Both positions were defensible right up until they were not" is fine.
    // The cold and short fields are where a bare pronoun genuinely has nothing
    // to point at, and that is where this is enforced.
  } else if (thirdAt !== -1 && partyAt === -1) {
    push("unnamed third party", "\"They\" and \"them\" have no antecedent here. If it means the rival, say \"your competitor\".");
  }

  return problems;
}

/* ------------------------------------------------------------ SCENARIO -- */

/**
 * The answer panel never names a business. Not a real one, not an invented one.
 *
 * A real name puts somebody else's brand in your ad, which is their lawyer's
 * problem to raise and yours to answer. An invented one is worse in a quieter
 * way: it is a fabricated record dressed up as a screenshot, and `offer.md`
 * rules out manufactured proof for good reasons.
 *
 * The placeholder is also the better ad. "Clearwater Glass lists same-day
 * service" asks the reader to accept a stranger and then map it onto somebody
 * they know. "(YOUR COMPETITOR) lists same-day service" makes them do the
 * naming, and the name they supply is the one that stings. You cannot write a
 * business name more threatening than the one already in their head.
 *
 * Place names stay. "San Dimas" is where the reader lives, not a claim.
 */
const PLACE_NAMES = /^(San Dimas|Inland Empire|Riverside County|Los Angeles|New York|San Diego|Santa Ana)$/;
const BUSINESS_NAME = /\b[A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|Co\.|Inc\.|LLC))+/g;

export function lintScenario({ prompt, answer }) {
  const problems = [];
  for (const [field, text] of [["prompt", prompt], ["answer", answer]]) {
    for (const hit of String(text).matchAll(BUSINESS_NAME)) {
      if (PLACE_NAMES.test(hit[0])) continue;
      problems.push({
        rule: `names a business "${hit[0]}"`,
        why: `The ${field} should say (YOUR COMPETITOR). A named business is either somebody's real brand or invented proof, and the reader's own rival is the scarier name anyway.`,
      });
    }
  }
  return problems;
}

/** Lint every string on an object, returning a flat report. */
export function lintSet(fields, voice) {
  const report = [];
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value !== "string") continue;
    for (const p of lint(value, voice)) report.push({ field, ...p });
  }
  return report;
}
