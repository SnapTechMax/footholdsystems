/**
 * Regenerates src/lib/sequence-steps.ts from the sequence copy.
 *
 *   node scripts/build-sequence-steps.mjs
 *
 * The copy lives in plain JS so it can be edited without touching the app, and
 * the dashboard needs the subjects and cadence in TypeScript. Rather than import
 * across that boundary, the shape the dashboard needs is generated. Run this
 * after changing subjects or delays, or the funnel labels drift from the emails
 * actually being sent.
 */

import { writeFileSync } from "node:fs";
import { SEQUENCE } from "../content/nurture-sequence.mjs";

let day = 0;
const rows = SEQUENCE.map((email) => {
  day += parseInt(email.delay, 10);
  return `  { key: ${JSON.stringify(email.key)}, subject: ${JSON.stringify(
    email.subject
  )}, day: ${day}, delay: ${JSON.stringify(email.delay)} },`;
});

writeFileSync(
  "src/lib/sequence-steps.ts",
  `/**
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
${rows.join("\n")}
];
`
);

console.log(
  `wrote src/lib/sequence-steps.ts: ${SEQUENCE.length} steps over ${day} days`
);
