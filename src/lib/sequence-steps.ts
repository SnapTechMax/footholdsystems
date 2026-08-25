/**
 * The sequence, flattened for the dashboard.
 *
 * Generated from content/nurture-sequence.mjs by scripts/build-sequence-steps.mjs.
 * Do not edit by hand.
 */
export interface SequenceStep {
  key: string;
  subject: string;
  /** Day the email lands, counted from enrolment. */
  day: number;
  delay: string;
}

export const SEQUENCE_STEPS: SequenceStep[] = [
  { key: "entity", subject: "You are not a website any more", day: 1, delay: "1 day" },
  { key: "askit", subject: "Go and ask it about yourself", day: 2, delay: "1 day" },
  { key: "schema", subject: "The block that does the most work", day: 3, delay: "1 day" },
  { key: "sameas", subject: "The one line that ties you together", day: 4, delay: "1 day" },
  { key: "specifics", subject: "Why quality work never gets recommended", day: 5, delay: "1 day" },
  { key: "questions", subject: "Write the question, not the service", day: 6, delay: "1 day" },
  { key: "crawlers", subject: "You might be blocking them without knowing", day: 7, delay: "1 day" },
  { key: "javascript", subject: "Turn JavaScript off and look", day: 8, delay: "1 day" },
  { key: "pricing", subject: "Publish a number, any number", day: 9, delay: "1 day" },
  { key: "whennot", subject: "Say what you do not do", day: 10, delay: "1 day" },
  { key: "llmstxt", subject: "The file almost nobody has yet", day: 11, delay: "1 day" },
  { key: "trust", subject: "The boring pages carry more weight than you think", day: 12, delay: "1 day" },
  { key: "consensus", subject: "It does not trust you about you", day: 13, delay: "1 day" },
  { key: "checkpoint", subject: "Two weeks in. Where are you?", day: 14, delay: "1 day" },
  { key: "retrieval", subject: "Being known is not the same as being fetched", day: 16, delay: "2 days" },
  { key: "yourname", subject: "When your own name does not find you", day: 18, delay: "2 days" },
  { key: "competitor", subject: "Find out who is getting your call", day: 20, delay: "2 days" },
  { key: "ceiling", subject: "What the checklist cannot do", day: 22, delay: "2 days" },
  { key: "rewrite", subject: "What a rewritten page actually looks like", day: 24, delay: "2 days" },
  { key: "whatyouget", subject: "What $1,500 actually buys", day: 26, delay: "2 days" },
  { key: "cost", subject: "The number nobody can show you", day: 31, delay: "5 days" },
  { key: "last", subject: "Last one from me", day: 38, delay: "7 days" },
];
