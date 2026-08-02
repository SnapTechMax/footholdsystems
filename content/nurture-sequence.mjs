/**
 * The nurture sequence sent after someone downloads The 5 Levels of AI.
 *
 * Content only. MailerLite owns the sequence and its API cannot create
 * automation steps or email content, so the sequence is built by hand in their
 * builder. This file is the source of truth for the copy: edit here, then run
 * `node scripts/build-sequence-sheet.mjs` to regenerate the build sheet used to
 * paste it in.
 *
 * Nothing on the website reads this file.
 *
 * Shape: 22 emails over 38 days. Daily for the first fortnight, then every
 * other day for six, then a 5 day and a 7 day gap to close.
 *
 * Every email carries one usable tip and one ask. The ratio moves across the
 * sequence: early emails are almost all tip with the calendar mentioned in
 * passing, later ones lead with the ask. The `ask` field is the dial:
 *
 *   1-4    the link exists, no pressure applied
 *   5-9    a soft offer
 *   10-14  explicit, still low pressure
 *   15-19  direct
 *   20-22  hard
 *
 * House style: short sentences, plain English, no hype, no exclamation marks.
 * No em-dashes anywhere. Assume a busy owner reading on a phone between jobs.
 */

export const BOOKING_URL =
  "https://calendly.com/max-snaptechrepair/20-minute-ai-strategy-call";
export const GUIDE_URL =
  "https://www.footholdsystems.com/downloads/Foothold-The-Five-Levels-of-AI-for-Small-Business.pdf";
export const BRAND_ADDRESS = "403 E Arrow Hwy Suite 306, San Dimas, CA 91773";

export function tagged(url, campaign, content = "cta") {
  const target = new URL(url);
  target.searchParams.set("utm_source", "footholdsystems");
  target.searchParams.set("utm_medium", "email");
  target.searchParams.set("utm_campaign", campaign);
  // Which link inside the email was clicked. Two links to the same destination
  // in one email are indistinguishable in analytics without it.
  target.searchParams.set("utm_content", content);
  return target.toString();
}

function booking(campaign) {
  return tagged(BOOKING_URL, campaign, "cta-button");
}

/**
 * Tag every link in an email body, not just the button.
 *
 * Written before the campaign existed, so the inline links, the guide download
 * in email one and anything added later, arrive in analytics as untagged direct
 * traffic and cannot be told apart from someone finding the site on their own.
 * Resend reports no opens or clicks through its API, so these parameters are the
 * only click data there is.
 */
function tagLinks(html, campaign) {
  let index = 0;
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (_match, url) => {
    index += 1;
    return `href="${tagged(url, campaign, `body-link-${index}`)}"`;
  });
}

const p = (text) => `      <p style="margin:0 0 16px;">${text}</p>`;

/**
 * Shared shell. Deliberately plainer than the guide delivery email. A nurture
 * message that looks like a newsletter gets read like one.
 */
function shell({ body, ask, cta, campaign }) {
  return `<div style="background:#eae8e1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:28px 16px;">
  <div style="max-width:520px;margin:0 auto;">
    <p style="margin:0 0 20px;color:#7a786f;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">Foothold Systems</p>
    <div style="color:#1f1f1d;font-size:16px;line-height:1.65;">
${body}
${p(ask)}
${p("Max")}
    </div>
    <a href="${booking(campaign)}" style="display:inline-block;margin-top:8px;background:#1b1b1b;color:#f2efe6;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:8px;">${cta} &rarr;</a>
    <hr style="border:none;border-top:1px solid #d4d1c6;margin:28px 0 16px;">
    <p style="margin:0;color:#7a786f;font-size:12px;line-height:1.6;">
      Foothold Systems &middot; ${BRAND_ADDRESS}<br>
      <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#7a786f;">Unsubscribe</a>. One click, no hard feelings.
    </p>
  </div>
</div>`;
}

const emails = [
  /* ── Days 1-14: daily. Almost all value, the ask barely present. ────────── */
  {
    key: "context",
    delay: "1 day",
    subject: "The habit that fixes most bad AI answers",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Most people get poor answers because they open with the question. Try opening with the context instead."),
      p("Not: <em>write me a follow up email</em>. Instead: <em>I run a 12 person HVAC company. This customer got a quote three weeks ago for $4,200 and has gone quiet. We have worked with them twice before. Write the follow up.</em>"),
      p("Same tool, completely different output. The model is not short of ability. It is short of facts about your business."),
      p("Try it once today on something real and see the difference."),
    ],
    ask: "The guide walks through where this stops being enough. If you would rather just talk it through, my calendar is open.",
  },
  {
    key: "draft",
    delay: "1 day",
    subject: "Stop asking it to write things",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Asking AI to write from nothing gets you something generic that sounds like everyone else."),
      p("Give it your raw material instead. Paste in your rough notes, your last three emails to that customer, the messy voice note you dictated in the van. Then ask it to shape that."),
      p("The difference is that the second version is yours. It already has your pricing, your tone, your history with that client. It just did not have punctuation."),
      p("Writing from nothing is a party trick. Shaping your own material is the useful bit."),
    ],
    ask: "That distinction is most of Level 2 in the guide. Calendar link is below if it is easier to ask me directly.",
  },
  {
    key: "explain",
    delay: "1 day",
    subject: "How to catch it making things up",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("AI will state something wrong with total confidence. This is the single biggest risk for a business using it on real work."),
      p("The cheapest defence: ask it to explain how it got there."),
      p('After any answer that matters, send back: <em>walk me through how you worked that out, and tell me which parts you are unsure about.</em>'),
      p("A model working from real information will show its reasoning. A model that invented something tends to get vague, or quietly corrects itself. Ten seconds, and it catches most of the damage."),
    ],
    ask: "Worth knowing before you trust it with anything that touches money. Happy to talk through where the real risks sit.",
  },
  {
    key: "documents",
    delay: "1 day",
    subject: "Feed it your actual paperwork",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Most owners are still typing questions into a chat box. Meanwhile the tools will happily read a file."),
      p("Upload the 40 page supplier contract and ask what your termination notice period is. Upload last quarter's numbers and ask what changed. Upload the manual and ask where the fault code is listed."),
      p("This is where it stops being a novelty. You are not asking it what it knows. You are asking it about your business, using your documents."),
      p("Pick the longest document on your desk right now and ask it one question about it."),
    ],
    ask: "This is the doorway to Level 2. If you want to know which of your paperwork is worth pointing it at, ask me.",
  },
  {
    key: "questions",
    delay: "1 day",
    subject: "Make it ask you questions",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("A trick almost nobody uses. Before it answers, make it interview you."),
      p("Add this to any request: <em>before you answer, ask me up to five questions you need answered to do this well.</em>"),
      p("It will ask about things you forgot to mention. Your margins. Your usual turnaround. Whether this customer is price sensitive. Answer those, then let it run."),
      p("You get a far better result, and you often notice you had not thought it through properly either."),
    ],
    ask: "If you would rather have that conversation with a person who knows businesses, that is what the call is.",
  },
  {
    key: "shorter",
    delay: "1 day",
    subject: "Say make it shorter three times",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("First drafts out of an AI are almost always too long and too polished. Padded, corporate, faintly desperate."),
      p("Reply with: <em>make it shorter.</em> Then do it again. Then once more."),
      p("By the third pass it usually sounds like a person. The filler burns off and what is left is the actual point. Most customers read the short version and ignore the long one anyway."),
      p("Works on emails, quotes, proposals, and your website copy."),
    ],
    ask: "Small habit, real difference. There is a bigger conversation about what to automate rather than shorten, whenever you want it.",
  },
  {
    key: "voice",
    delay: "1 day",
    subject: "Talk instead of typing",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("If you are typing your notes, you are doing the slow version."),
      p("Dictate instead. Ramble into your phone for two minutes after a site visit, then hand the transcript over and ask for a structured job note, a customer summary, and the three follow up actions."),
      p("Owners talk faster than they type and think better out loud. The mess is the point. Cleaning up mess is exactly what these tools are good at."),
      p("Try it after your next call, before you have forgotten half of it."),
    ],
    ask: "Most of the time saved in a business hides in jobs like this. Worth twenty minutes to find yours.",
  },
  {
    key: "inbox",
    delay: "1 day",
    subject: "Use it on your inbox, but not to write",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Everyone points AI at their inbox to write replies. That is the wrong end of the problem."),
      p("Point it at triage instead. Paste in the morning's unread subject lines and senders and ask which three actually need you today and why."),
      p("Writing the email was never the hard part. Deciding what deserves your attention is. That decision is where the day gets lost."),
      p("The reply you can write yourself in ninety seconds, and it will sound like you."),
    ],
    ask: "If your inbox is the bottleneck, say so on a call and I will tell you what I would do about it.",
  },
  {
    key: "onepage",
    delay: "1 day",
    subject: "The one page that pays for itself",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Pick the job your business does most often. Write down how it gets done, start to finish, on one page. What you would hand a new hire."),
      p("It is on the last page of the guide as homework, and it is the single most valuable hour you will spend this month."),
      p("Two things happen. You find steps nobody can justify, which you then delete. And you end up holding the exact document that makes automating that job possible later."),
      p("You cannot automate a process that only exists in someone's head. Everything upstream of Level 3 starts here."),
    ],
    ask: "Write it, then book twenty minutes and I will tell you what I would build from it.",
  },
  {
    key: "quotes",
    delay: "1 day",
    subject: "Quotes take longer than they should",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Quoting is where businesses quietly lose hours. Same shapes, different numbers, every single time."),
      p("Start here. Take your last ten quotes, paste them in, and ask what structure they share and where you tend to be inconsistent."),
      p("It usually finds something uncomfortable. Wildly different margins on similar jobs. Line items you forget half the time. Wording that is vague enough to cost you an argument later."),
      p("Fixing the inconsistency is worth money before you automate anything."),
    ],
    ask: "Quoting is the most common first build I do for people. Ask me what that looks like for your trade.",
  },
  {
    key: "repeat",
    delay: "1 day",
    subject: "The email you have written 200 times",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("There is an email you write most weeks. The chase. The booking confirmation. The one explaining your terms again."),
      p("Find your last five versions of it. Hand them over and ask for one template with the variable bits marked out."),
      p("You will get something better than any of the five, because it is drawing from the versions where you explained it well, not the one you rushed on a Friday."),
      p("Then it stops being a writing job and becomes filling in three blanks."),
    ],
    ask: "This is Level 2 done properly. Level 3 is when the blanks fill themselves in. Book a call and I will show you the difference.",
  },
  {
    key: "needtoknow",
    delay: "1 day",
    subject: "What would you need to know",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("When an answer comes back thin, most people give up and decide the tool is overrated."),
      p("Ask this instead: <em>what would you need to know about my business to answer that properly?</em>"),
      p("It will tell you. Your pricing model, your customer type, your capacity, whatever is missing. Now you know exactly what context to give it, rather than guessing."),
      p("Most bad AI output is a missing information problem wearing a costume."),
    ],
    ask: "Same is true of advice generally. The call is twenty minutes because that is how long it takes to get the context.",
  },
  {
    key: "notouch",
    delay: "1 day",
    subject: "Where I would not let it near",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Worth being straight about the limits, since most of what you read is selling you something."),
      p("I would not hand it final pricing decisions. I would not let it send anything to a customer unread. I would not use it for anything involving an employee's performance or personal circumstances. And I would not put customer data into a free consumer account, which is the one that catches people out."),
      p("None of that is because it cannot produce an answer. It is because those decisions carry consequences that land on you, not on a model."),
      p("Judgment stays with you. Everything upstream of the judgment is fair game."),
    ],
    ask: "If you are not sure which side of that line something sits on, that is a good question for a call.",
  },
  {
    key: "checkpoint",
    delay: "1 day",
    subject: "Two weeks in. Where are you?",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("That is a fortnight of tips. Honest question: has anything actually changed in how you work?"),
      p("If yes, you are on Level 2 or moving there. You hand it real work, with your material, and use what comes back."),
      p("If nothing has changed, that is worth knowing too, and it is the normal outcome. Reading about it and doing it are different activities, and you are busy running a business."),
      p("Either way you now know your level, which is more than most owners can say."),
    ],
    ask: "The next part is the bit a guide cannot do: which move is yours, and what it is worth. That is the call.",
  },

  /* ── Days 16-26: every other day. Ask gets direct. ──────────────────────── */
  {
    key: "leveltool",
    delay: "2 days",
    subject: "What a Level 3 tool actually looks like",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Level 3 sounds abstract until you see one. They are always smaller than people expect."),
      p("A form your team fills in on site that writes the customer report itself. A sheet that reads your supplier's price list and reprices your quotes. Something that watches an inbox and files what arrives against the right job."),
      p("Not a product. Not a platform. A small, ugly, specific thing that does one job your business does constantly, built around how you actually work."),
      p("That is the level almost nobody reaches, and it is the one that pays."),
    ],
    ask: "Twenty minutes and I will tell you which one I would build for you first. Free, whether or not you hire me.",
  },
  {
    key: "firstbuild",
    delay: "2 days",
    subject: "How to pick the first thing to build",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Owners pick the biggest problem. That is the wrong instinct."),
      p("Pick the thing that annoys you every single week. Not the crisis. The small recurring irritation you have stopped noticing because you have always done it that way."),
      p("Big problems are big because they are tangled up in people, money and judgment. Weekly irritations are small, well understood, and repetitive, which is exactly what a tool is good at."),
      p("Fix one of those and you get the time back every week, forever. Then you do the next one."),
    ],
    ask: "Bring me your weekly irritation and I will tell you if it is buildable. That is a twenty minute conversation.",
  },
  {
    key: "whyfail",
    delay: "2 days",
    subject: "Why most of these projects die",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Skipped levels. Almost every time."),
      p("Someone reads about autonomous agents, jumps from Level 1 to Level 4, and tries to automate an entire job nobody had written down. It half works, produces something wrong at a bad moment, and everyone quietly stops using it."),
      p("The failure gets blamed on the technology. The actual cause was building on a process that was never documented and a team that had never used the tools on anything small."),
      p("One level at a time is not caution. It is the fastest route that actually arrives."),
    ],
    ask: "If you have already had one of these die on you, tell me what happened. I can usually spot which level got skipped.",
  },
  {
    key: "cost",
    delay: "2 days",
    subject: "What you actually get for the money",
    cta: "Get your price",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("People ask what this costs before they ask what it does, which is fair, but it is the wrong order. The price only means something once you know what you are getting."),
      p("So here is what you get. A written plan you keep whether or not you work with me. Every job in your business ranked by hours saved, with a go or no-go on each. Tool picks with real pricing. A map of where your customer data is going today. And the payback math, so you can see what the first build returns before you commit to it."),
      p("Then the tools themselves get built, documented, and handed over. Yours to keep. If you stop working with me you keep everything, and someone else can pick it up."),
      p("I will not put a figure in an email, because a figure without your context is a number I made up. What it costs depends on how many jobs are worth building and how tangled your setup is, and I cannot know that from here."),
      p("Twenty minutes on the phone and I can tell you exactly. No pressure to buy anything on that call."),
    ],
    ask: "Book the call and ask me the price directly. You will get a straight answer, and the call itself is free either way.",
  },
  {
    key: "data",
    delay: "2 days",
    subject: "Where your customer data is actually going",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Ask your team which AI tools they use and on what accounts. Most owners are surprised by the answer."),
      p("Personal accounts. Free tiers. Customer names and addresses pasted into a chat box that trains on the input. Nobody did anything malicious, they were just trying to get through the day faster."),
      p("This is on the audit list for a reason. I have never looked at a business and found nothing."),
      p("The fix is usually simple and cheap. Finding out is the part people avoid."),
    ],
    ask: "This is one of the four things I check on a call. Twenty minutes, and you would know.",
  },
  {
    key: "handover",
    delay: "2 days",
    subject: "The question to ask anyone who builds for you",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Ask them this: if you disappear tomorrow, what do I still have?"),
      p("If the answer is a login to their platform, you are renting. When they raise the price or fold, your process leaves with them."),
      p("My answer is that you get the tool and the written documentation of how it works. No black boxes. If you sack me, you keep everything, and someone else can pick it up."),
      p("Ask me that question, and ask it of anyone else you talk to."),
    ],
    ask: "Book the call and ask it to my face. The answer is the same either way.",
  },

  /* ── Days 31 and 38: closing. Hard ask. ────────────────────────────────── */
  {
    key: "standingstill",
    delay: "5 days",
    subject: "The cost of leaving this alone",
    cta: "Get your number",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("For a business of five to fifty people, going from Level 1 to Level 3 usually frees five to fifteen hours a week across the team."),
      p("Your number will not be that number. It depends on your jobs and your people. But the shape holds, and the hours are not dramatic ones. They are the same small tasks, done by hand, every week, indefinitely."),
      p("The quieter cost is that what lives in someone's head stays there. If that person leaves, the process leaves. If you sell, you are selling a business that depends on people rather than systems, and it is priced accordingly."),
      p("Doing nothing is a decision with a price. Most owners have just never seen the figure."),
    ],
    ask: "Twenty minutes and you would have your figure. That is the entire purpose of the call, and it costs you nothing.",
  },
  {
    key: "last",
    delay: "7 days",
    subject: "Last one from me",
    cta: "Book the call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("This is the last email in this sequence. No more from me after today unless you ask."),
      p("If the timing is wrong, that is genuinely fine. The three tasks on the last page of the guide are free, they work, and you do not need me to do them."),
      p("If it is not timing but something else, reply and tell me. Wrong fit, wrong size, wrong problem, too expensive. I would rather know, and I will take the answer without arguing."),
      p("And if you have been meaning to book this for five weeks and it keeps sliding down the list, this is the nudge. It is twenty minutes and it is free."),
    ],
    ask: "Last chance to take me up on it without having to remember I exist. The link stays open.",
  },
];

export const SEQUENCE = emails.map((email, index) => {
  const campaign = `nurture-${String(index + 1).padStart(2, "0")}-${email.key}`;
  const body = tagLinks(email.body.join("\n"), campaign);
  return {
    ...email,
    campaign,
    name: `foothold-nurture-${String(index + 1).padStart(2, "0")}-${email.key}`,
    body,
    html: shell({ body, ask: email.ask, cta: email.cta, campaign }),
  };
});
