/**
 * The nurture sequence sent after someone downloads The 5 Levels of AI.
 *
 * Content only — `create-email-sequence.mjs` is what pushes it to Resend. Kept
 * separate so the copy can be edited and reviewed without touching the plumbing.
 *
 * Voice notes, for whoever edits this next: short sentences, plain English, no
 * hype, no exclamation marks. The guide's whole premise is that everyone else
 * is selling noise, so the emails cannot sound like everyone else. Assume a
 * busy owner reading on a phone between jobs.
 */

export const BOOKING_URL =
  "https://calendly.com/max-snaptechrepair/20-minute-ai-strategy-call";
export const GUIDE_URL =
  "https://www.footholdsystems.com/downloads/Foothold-The-Five-Levels-of-AI-for-Small-Business.pdf";
export const BRAND_ADDRESS =
  "403 E Arrow Hwy Suite 306, San Dimas, CA 91773";

function booking(campaign) {
  return `${BOOKING_URL}?utm_source=footholdsystems&utm_medium=email&utm_campaign=${campaign}`;
}

/**
 * Shared shell. Deliberately plainer than the guide delivery email — a nurture
 * message that looks like a newsletter gets read like one.
 */
function shell({ body, cta, campaign }) {
  return `<div style="background:#eae8e1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:28px 16px;">
  <div style="max-width:520px;margin:0 auto;">
    <p style="margin:0 0 20px;color:#7a786f;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">Foothold Systems</p>
    <div style="color:#1f1f1d;font-size:16px;line-height:1.65;">
${body}
    </div>${
      cta
        ? `
    <a href="${booking(campaign)}" style="display:inline-block;margin-top:24px;background:#1b1b1b;color:#f2efe6;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:8px;">${cta} &rarr;</a>`
        : ""
    }
    <hr style="border:none;border-top:1px solid #d4d1c6;margin:28px 0 16px;">
    <p style="margin:0;color:#7a786f;font-size:12px;line-height:1.6;">
      Foothold Systems &middot; ${BRAND_ADDRESS}<br>
      <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#7a786f;">Unsubscribe</a> &mdash; one click, no hard feelings.
    </p>
  </div>
</div>`;
}

const p = (text) => `      <p style="margin:0 0 16px;">${text}</p>`;

export const SEQUENCE = [
  {
    key: "level",
    delay: "2 days",
    campaign: "nurture-1-level",
    name: "foothold-nurture-1-which-level",
    subject: "Which level did you land on?",
    cta: "Book a call",
    body: [
      p(`Hi {{{FIRST_NAME}}},`),
      p(`You grabbed The 5 Levels of AI a couple of days ago. Most people who download a guide never open it, so this is the only nudge I'll send about actually reading it.`),
      p(`If you only do one thing, do the five boxes on page 8. Two minutes. It tells you the level you're really on, not the one you'd like to be on.`),
      p(`The trick is being honest about the question. It isn't "has anyone here tried it once." It's "is this how we work on a normal Tuesday."`),
      p(`<a href="${GUIDE_URL}" style="color:#1b1b1b;font-weight:600;">Open the guide</a></p>`),
      p(`Reply and tell me the number you landed on. I read every one.`),
      p(`&mdash; Max`),
    ].join("\n"),
  },
  {
    key: "levelthree",
    delay: "3 days",
    campaign: "nurture-2-level-three",
    name: "foothold-nurture-2-level-three",
    subject: "Almost nobody is on Level 3",
    cta: "Book a call",
    body: [
      p(`Hi {{{FIRST_NAME}}},`),
      p(`Most small businesses I look at are on Level 1. Someone uses a chat box instead of Google. That's it.`),
      p(`Level 3 is where it starts paying. That's where AI builds you a small tool you'd never have paid a developer to make. A quoting sheet that fills itself in. Something that reads your job notes and writes the follow-up. Unglamorous, specific to how your shop runs, and yours to keep.`),
      p(`Almost nobody gets there. Not because it's hard, but because they skip to Level 4, land on a mess and a bill, and decide the whole thing was hype.`),
      p(`One level at a time. That's the entire method.`),
      p(`&mdash; Max`),
    ].join("\n"),
  },
  {
    key: "cost",
    delay: "4 days",
    campaign: "nurture-3-cost",
    name: "foothold-nurture-3-what-it-costs",
    subject: "Five to fifteen hours a week",
    cta: "Get your number",
    body: [
      p(`Hi {{{FIRST_NAME}}},`),
      p(`For a business with five to fifty people, moving from Level 1 to Level 3 usually frees five to fifteen hours a week across the team.`),
      p(`Your number won't be that number. It depends on your jobs and your people. But the shape holds, and the part owners underestimate is what the hours were being spent on: the same handful of small jobs, done by hand, every week, forever.`),
      p(`The bigger win is quieter. What used to live in someone's head starts living in a tool the business owns. That's the part that makes a business worth something when you eventually sell it.`),
      p(`The guide can tell you your level. It can't tell you what staying there is costing you every month. That's the first thing we work out on a call.`),
      p(`&mdash; Max`),
    ].join("\n"),
  },
  {
    key: "ask",
    delay: "5 days",
    campaign: "nurture-4-ask",
    name: "foothold-nurture-4-twenty-minutes",
    subject: "Twenty minutes, bring your level",
    cta: "Book the call",
    body: [
      p(`Hi {{{FIRST_NAME}}},`),
      p(`Straight ask: book twenty minutes with me.`),
      p(`Tell me the level you landed on. I'll tell you what I usually find at that level, what it tends to cost a business your size, and which one move I'd make first. Free, whether or not you hire me.`),
      p(`No deck, no discovery process, no follow-up sequence you can't escape. Twenty minutes, weekday afternoons &mdash; the only window I keep for these.`),
      p(`If it isn't a fit I'll say so on the call and we'll both get on with our day.`),
      p(`&mdash; Max`),
    ].join("\n"),
  },
  {
    key: "last",
    delay: "7 days",
    campaign: "nurture-5-last",
    name: "foothold-nurture-5-last-one",
    subject: "Last one on this",
    cta: "Book a call",
    body: [
      p(`Hi {{{FIRST_NAME}}},`),
      p(`This is the last email I'll send about the guide.`),
      p(`If the timing's wrong, that's genuinely fine &mdash; the three things on the last page are free and they work whether or not we ever speak. Start there.`),
      p(`If it isn't the timing but something else, reply and tell me what. Wrong fit, wrong size, wrong problem. It's useful to know and I'll take the answer either way.`),
      p(`And if you've been meaning to book and it keeps sliding down the list, the link's below. It stays open.`),
      p(`&mdash; Max`),
    ].join("\n"),
  },
].map((email) => ({
  ...email,
  html: shell({ body: email.body, cta: email.cta, campaign: email.campaign }),
}));
