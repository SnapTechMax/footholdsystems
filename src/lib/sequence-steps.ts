/**
 * The sequence, flattened for the dashboard.
 *
 * Generated from content/nurture-sequence.mjs by scripts/build-sequence-steps.mjs.
 * The content file is plain JS and the app is TypeScript, so rather than import
 * across that boundary the shape the dashboard needs is written out here.
 * Regenerate after changing the copy or the cadence.
 */
export interface SequenceStep {
  key: string;
  subject: string;
  /** Day the email lands, counted from enrolment. */
  day: number;
  delay: string;
}

export const SEQUENCE_STEPS: SequenceStep[] = [
  { key: "context", subject: "The habit that fixes most bad AI answers", day: 1, delay: "1 day" },
  { key: "draft", subject: "Stop asking it to write things", day: 2, delay: "1 day" },
  { key: "explain", subject: "How to catch it making things up", day: 3, delay: "1 day" },
  { key: "documents", subject: "Feed it your actual paperwork", day: 4, delay: "1 day" },
  { key: "questions", subject: "Make it ask you questions", day: 5, delay: "1 day" },
  { key: "shorter", subject: "Say make it shorter three times", day: 6, delay: "1 day" },
  { key: "voice", subject: "Talk instead of typing", day: 7, delay: "1 day" },
  { key: "inbox", subject: "Use it on your inbox, but not to write", day: 8, delay: "1 day" },
  { key: "onepage", subject: "The one page that pays for itself", day: 9, delay: "1 day" },
  { key: "quotes", subject: "Quotes take longer than they should", day: 10, delay: "1 day" },
  { key: "repeat", subject: "The email you have written 200 times", day: 11, delay: "1 day" },
  { key: "needtoknow", subject: "What would you need to know", day: 12, delay: "1 day" },
  { key: "notouch", subject: "Where I would not let it near", day: 13, delay: "1 day" },
  { key: "checkpoint", subject: "Two weeks in. Where are you?", day: 14, delay: "1 day" },
  { key: "leveltool", subject: "What a Level 3 tool actually looks like", day: 16, delay: "2 days" },
  { key: "firstbuild", subject: "How to pick the first thing to build", day: 18, delay: "2 days" },
  { key: "whyfail", subject: "Why most of these projects die", day: 20, delay: "2 days" },
  { key: "cost", subject: "What you actually get for the money", day: 22, delay: "2 days" },
  { key: "data", subject: "Where your customer data is actually going", day: 24, delay: "2 days" },
  { key: "handover", subject: "The question to ask anyone who builds for you", day: 26, delay: "2 days" },
  { key: "standingstill", subject: "The cost of leaving this alone", day: 31, delay: "5 days" },
  { key: "last", subject: "Last one from me", day: 38, delay: "7 days" },
];
