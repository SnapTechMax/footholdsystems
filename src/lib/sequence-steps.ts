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
  { key: "ownsite", subject: "I ran it on my own site first", day: 1, delay: "1 day" },
  { key: "oneline", subject: "The line I couldn't stop thinking about", day: 2, delay: "1 day" },
  { key: "askit", subject: "Five minutes, and you'll know", day: 3, delay: "1 day" },
  { key: "notme", subject: "It didn't know I existed", day: 4, delay: "1 day" },
  { key: "notrust", subject: "It doesn't take your word for it", day: 5, delay: "1 day" },
  { key: "schema", subject: "The twenty minutes that moved it most", day: 6, delay: "1 day" },
  { key: "sameas", subject: "The one line that ties you together", day: 7, delay: "1 day" },
  { key: "javascript", subject: "Turn JavaScript off and look", day: 8, delay: "1 day" },
  { key: "blocked", subject: "Perfect site. Completely invisible.", day: 9, delay: "1 day" },
  { key: "pricing", subject: "The four most expensive words on your site", day: 10, delay: "1 day" },
  { key: "whennot", subject: "Say what you won't do", day: 11, delay: "1 day" },
  { key: "llmstxt", subject: "The file almost nobody has", day: 12, delay: "1 day" },
  { key: "trust", subject: "The boring pages", day: 13, delay: "1 day" },
  { key: "checkpoint", subject: "Two weeks in. Where are you?", day: 14, delay: "1 day" },
  { key: "pattern", subject: "What every site had in common", day: 16, delay: "2 days" },
  { key: "competitor", subject: "Find out who is getting your call", day: 18, delay: "2 days" },
  { key: "wrong", subject: "I got one wrong", day: 20, delay: "2 days" },
  { key: "ceiling", subject: "What the checklist can't do", day: 22, delay: "2 days" },
  { key: "rewrite", subject: "Before and after", day: 24, delay: "2 days" },
  { key: "whatido", subject: "What I actually do", day: 26, delay: "2 days" },
  { key: "invisible", subject: "The number nobody can show you", day: 31, delay: "5 days" },
  { key: "last", subject: "Last one from me", day: 38, delay: "7 days" },
];
