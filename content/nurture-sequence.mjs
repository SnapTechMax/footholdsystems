/**
 * The nurture sequence sent after someone downloads The 5 Levels of AI and The
 * Prompts That Get You There.
 *
 * The guide prints the Level 1 and Level 2 prompts in full and leaves Levels 3
 * to 5 as frameworks. That split is the spine of this sequence: the early
 * emails sharpen a prompt the reader already has, the later ones are about the
 * three they cannot paste. Anything here that cites the guide has to match what
 * is actually in the PDF, so check a claim against the file before adding one.
 *
 * Content only. Resend owns the sequence, as templates plus an automation. This
 * file is the source of truth for the copy: edit here, then run
 * `node scripts/create-email-sequence.mjs` to push it.
 *
 * That builds a *new* automation rather than updating the live one, because
 * Resend does not allow an enabled automation's steps to be edited. Switching
 * over means enabling the new one, disabling the old, and updating
 * RESEND_AUTOMATION_ID. Editing this file alone changes nothing that is
 * currently being sent.
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
  "https://www.footholdsystems.com/downloads/Foothold-The-5-Levels-of-AI-and-The-Prompts.pdf";
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

export const BOOKING_TRACKER = "https://www.footholdsystems.com/api/go/book";

/**
 * The booking button, pointed at our own redirect rather than at Calendly.
 *
 * That hop is what makes per-email attribution possible: the click is logged
 * server-side before the visitor is handed on, and the redirect re-applies the
 * UTM parameters so Calendly still echoes the email's key back through the
 * webhook when a call is actually booked. Clicks and bookings then join on that
 * key, which is how "which email did this call come from" gets an answer.
 *
 * Built by hand rather than with URL, on purpose. `new URL().toString()`
 * percent-encodes the braces in the merge tag, and Resend only substitutes a
 * tag it can still recognise — encoded, `{{{EMAIL}}}` would be delivered
 * literally to every recipient. The redirect discards any value still carrying
 * braces, so if this tag is ever wrong the attribution degrades to anonymous
 * counts instead of inventing a contact.
 */
function booking(campaign, content = "cta-button") {
  const params = new URLSearchParams({ e: campaign, c: content });
  return `${BOOKING_TRACKER}?${params}&r={{{EMAIL}}}`;
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
    // A booking link written inline in body copy goes through the tracker too,
    // otherwise it would be the one Calendly link in the sequence that produces
    // no click record and no attribution.
    if (url.includes("calendly.com")) {
      return `href="${booking(campaign, `body-link-${index}`)}"`;
    }
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

/**
 * The same email with every marketing marker stripped out.
 *
 * Gmail's tab classifier is not reading your reputation when it files something
 * under Promotions — that decision is made on mail it has already accepted into
 * the inbox, on what the message looks like. `shell()` above, restrained as it
 * is, still carries five things personal email never has: a coloured canvas, a
 * fixed-width column, an uppercase letterspaced masthead, a horizontal rule, and
 * an `inline-block` anchor with padding and a border radius. That last one is
 * the loudest. A button exists in exactly one kind of email.
 *
 * This shell has none of them. One font declaration, paragraphs, and the CTA as
 * an ordinary inline link left in the client's default styling — deliberately
 * not brand-coloured, because a restyled link is a designed link. What is left
 * is close to what the text part already says, which is the point.
 *
 * Two things stay, because they are not optional: the postal address, which
 * CAN-SPAM requires, and the unsubscribe link, which Gmail requires of bulk
 * senders. `List-Unsubscribe` is itself a Promotions signal and there is no
 * version of this that removes it. That is the ceiling on how far this can go,
 * and it is worth being honest that the ceiling is real.
 *
 * Not wired up by default. `SEQUENCE_STYLE=plain` selects it at push time, so
 * the two can be compared before either reaches a recipient — and reverted by
 * dropping the variable rather than by editing anything.
 */
function bareShell({ body, ask, cta, campaign }) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1d;">
${body}
${p(ask)}
${p(`<a href="${booking(campaign)}">${cta}</a>`)}
${p("Max")}
      <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#7a786f;">
        Foothold Systems &middot; ${BRAND_ADDRESS}<br>
        <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#7a786f;">Unsubscribe</a>. One click, no hard feelings.
      </p>
</div>`;
}

/**
 * The same email as plain text, for the `text/plain` part.
 *
 * Not optional. An HTML-only message is one of the oldest spam heuristics there
 * is, and this domain publishes DMARC p=reject, so there is no margin for
 * anything that costs reputation. It also covers the readers who never see the
 * HTML at all: text-only clients, screen readers, and the preview pane of a
 * client that has images and styling switched off.
 *
 * Derived from the already-tagged HTML rather than written twice, so the two
 * parts cannot drift and the tracked booking link is identical in both. Only the
 * tags this file's own `p()` and `shell()` produce are handled — `<p>`, `<em>`
 * and `<a>`, plus the two entities used — because that is the whole vocabulary.
 *
 * Merge tags pass through untouched: `{{{FIRST_NAME}}}` and
 * `{{{RESEND_UNSUBSCRIBE_URL}}}` are substituted by Resend in the text part
 * exactly as they are in the HTML one.
 */
function textify(html) {
  return html
    // Links become "label: url", so the destination is readable rather than lost.
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, "$2: $1")
    .replace(/<\/p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&rarr;/g, "")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    // Collapse the indentation the HTML template carries, then trim each line.
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    // No more than one blank line anywhere.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Plain-text counterpart to `shell()`, built from the same pieces. */
function plainShell({ body, ask, cta, campaign }) {
  return [
    textify(body),
    "",
    textify(ask),
    "",
    "Max",
    "",
    `${cta}: ${booking(campaign)}`,
    "",
    "--",
    `Foothold Systems · ${BRAND_ADDRESS}`,
    "Unsubscribe (one click, no hard feelings): {{{RESEND_UNSUBSCRIBE_URL}}}",
  ].join("\n");
}

const emails = [
  /* ── Days 1-14: daily. Almost all value, the ask barely present. ────────── */
  {
    key: "context",
    delay: "1 day",
    subject: "The one block everyone skips",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("You have the guide now. If you only ever use one part of it, use the Context block on page four."),
      p("Most people open with the question. <em>Write me a follow up email.</em> What comes back sounds like everybody else's follow up email, because nothing in that sentence told it a single thing about you."),
      p("Open with the facts instead. <em>I run a 12 person HVAC company. This customer got a quote three weeks ago for $4,200 and has gone quiet. We have worked with them twice before. Write the follow up.</em>"),
      p("Same tool, same thirty seconds of typing, completely different answer. It had the ability all along. What it was missing was anything at all about your business, and you are the only one who can hand it that."),
      // The link lands at the end of the sentence on purpose: in the text part
      // this becomes "label: url", and a URL in the middle of a sentence leaves
      // the rest of it stranded after forty characters of query string.
      p(`Try it today on something real. If the guide has already gone missing in your inbox, <a href="${GUIDE_URL}">here it is again</a>`),
    ],
    ask: "Prompts 1 and 2 are yours to use this afternoon. Levels 3 to 5 are the ones that get built rather than pasted, and that is what the call is for.",
  },
  {
    key: "draft",
    delay: "1 day",
    subject: "Stop asking it to write things",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Ask one of these tools to write something from nothing and you get prose that sounds like everybody else's. Hand it your own raw material and ask it to shape that, and you get something you can actually send."),
      p("Your rough notes. Your last three emails to that customer. The messy voice note you dictated in the van. Paste any of it in and ask for the tidy version."),
      p("What comes back is yours. Your pricing is in it, your tone, your history with that client. All it was ever missing was punctuation and a bit of structure."),
    ],
    ask: "That distinction is most of Level 2 in the guide. The calendar link is below if it is easier to just ask me.",
  },
  {
    key: "explain",
    delay: "1 day",
    subject: "How to catch it making things up",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("AI will tell you something wrong with complete confidence, and for a business using it on real work that is the risk worth taking seriously."),
      p('The cheapest defence costs you one line. After any answer that matters, send back: <em>walk me through how you worked that out, and tell me which parts you are unsure about.</em>'),
      p("One that is working from real information will show you its reasoning. One that invented something goes vague, or corrects itself on the spot. It takes about ten seconds, and it catches most of what would otherwise have reached a customer."),
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
      p("These tools will read a file, and hardly anybody uses them that way."),
      p("Upload the 40 page supplier contract and ask what your termination notice period is. Upload last quarter's numbers and ask what changed. Upload the manual and ask where the fault code is listed."),
      p("That is the point where it stops being a novelty, because the answers coming back are about your business rather than about the world in general."),
      p("Pick the longest document on your desk right now and ask it one question."),
    ],
    ask: "This is the doorway to Level 2. If you want to know which of your paperwork is worth pointing it at, that is a short conversation.",
  },
  {
    key: "questions",
    delay: "1 day",
    subject: "Make it ask you questions",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Before it answers, make it interview you. Almost nobody does this and it changes the output more than any other single habit."),
      p("Add this line to the bottom of the 5-block prompt: <em>before you answer, ask me up to five questions you need answered to do this well.</em>"),
      p("It will ask about things you forgot to mention. Your margins, your usual turnaround, whether this customer is price sensitive. Answer those and then let it run."),
      p("You get a better result out of it, and about half the time you notice you had not thought the job through properly either."),
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
      p("If you are typing up your notes, you are doing the slow version of that job."),
      p("Ramble into your phone for two minutes after a site visit, then hand the transcript over and ask for a structured job note, a customer summary and the three follow up actions."),
      p("Owners talk faster than they type and think better out loud, and it does not matter that what comes out is a mess. Tidying up a mess is the thing these tools are genuinely good at."),
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
      p("Everybody points AI at their inbox to write the replies. Triage is where it actually earns its keep."),
      p("Paste in the morning's unread subject lines and senders and ask which three genuinely need you today, and why."),
      p("The writing was never what cost you the morning. Working out what deserves your attention is, and that is the decision the day disappears into. Once it is made, the reply takes you ninety seconds and it sounds like you."),
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
      p("Pick the job your business does most often and write down how it gets done, start to finish, on one page. Roughly what you would hand a new hire on their first morning."),
      p("The Level 4 page in the guide puts it in one line: you cannot automate a job you have never written down. This is that hour."),
      p("Two things come out of it. You find steps nobody can justify any more, which you then delete. And you end up holding the document that makes automating that job possible later, because a process that only exists in somebody's head cannot be automated by anyone. Everything above Level 2 depends on having done this once."),
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
      p("Quoting is where businesses lose hours without ever noticing it happen. The same shapes, different numbers, every single time."),
      p("Take your last ten quotes, paste them in, and ask what structure they share and where you tend to be inconsistent."),
      p("It usually turns up something uncomfortable: wildly different margins on similar jobs, line items you forget half the time, wording vague enough to cost you an argument later. Fixing that is worth money on its own, before you automate anything at all."),
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
      p("There is an email you write most weeks. The chase, the booking confirmation, the one explaining your terms again."),
      p("Find your last five versions of it, hand them over, and ask for a single template with the variable bits marked out."),
      p("What comes back is better than any of the five, because it is drawing on the versions where you explained it well rather than the one you rushed on a Friday afternoon. After that it stops being a writing job and becomes filling in three blanks."),
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
      p("Try one more message before you do: <em>what would you need to know about my business to answer that properly?</em>"),
      p("It will tell you. Your pricing model, your customer type, your capacity, whatever it was short of. Now you know what context to hand it rather than guessing at it, and most of what looks like a bad answer turns out to have been a missing information problem."),
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
      p("Most of what you read about AI is selling you something, so it is worth saying where I would not use it myself."),
      p("I would not hand it final pricing decisions. I would not let it send anything to a customer unread. I would not use it for anything involving an employee's performance or personal circumstances. And I would not put customer data into a free consumer account, which is the one that catches people out."),
      p("None of that is because it cannot produce an answer. It is because the consequences of those decisions land on you rather than on a model, so the judgment has to stay where it is. Everything that happens before the judgment is fair game."),
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
      p("That is a fortnight of tips. So: has anything actually changed in how you work?"),
      p("If it has, you are on Level 2 or heading there. You hand it real work, with your own material, and you use what comes back. That is both of the prompts in the guide doing their job, and it is further than most owners get."),
      p("If nothing has changed, that is worth knowing too, and it is the normal outcome. Reading about something and doing it are different activities, and you have a business to run."),
      p("Either way, the guide runs out here. Levels 3, 4 and 5 print as frameworks rather than something you paste, because there is nothing to paste. They get built."),
    ],
    ask: "Which of the three is yours, and what it is worth once it is running, is the whole of the call.",
  },

  /* ── Days 16-26: every other day. Ask gets direct. ──────────────────────── */
  {
    key: "leveltool",
    delay: "2 days",
    subject: "What a Level 3 tool actually looks like",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("You saw the four headings of the build brief in the guide and not much else, so here is what actually sits under them. Level 3 tools are always smaller than people expect."),
      p("A form your team fills in on site that writes the customer report itself. A sheet that reads your supplier's price list and reprices your quotes. Something that watches an inbox and files what arrives against the right job."),
      p("None of those is a product or a platform. Each one is a small, ugly, specific thing that does a job your business does constantly, built around the way you already work. That is the level almost nobody reaches, and it is the one that pays."),
    ],
    ask: "Twenty minutes and I will tell you which one I would build for you first. No charge for that either way.",
  },
  {
    key: "firstbuild",
    delay: "2 days",
    subject: "How to pick the first thing to build",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Owners almost always reach for the biggest problem first, and that is the one I would leave alone."),
      p("Pick the thing that irritates you every single week, not the thing that blew up last month. Usually it is something small you have stopped noticing, because you have always done it that way."),
      p("Big problems are big because they are tangled up in people, money and judgment. Weekly irritations are small, well understood and repetitive, which is precisely what a tool is good at."),
      p("Fix one of those and you get the time back every week from then on. Then you do the next one."),
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
      p("It is nearly always the same cause: a skipped level."),
      p("Someone reads about autonomous agents, jumps from Level 1 to Level 4, and tries to automate a whole job that nobody had ever written down. It half works, produces something wrong at a bad moment, and everybody drifts back to doing it by hand."),
      p("The technology gets the blame. What actually went wrong is that it was built on a process nobody had documented, by a team that had never used the tools on anything small."),
      p("Going one level at a time looks slower on paper. It is the only version of this I have watched arrive anywhere."),
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
      p("People ask what this costs before they ask what it does. Fair enough, though the price only means something once you know what is attached to it."),
      p("What you get is a written plan you keep whether or not you work with me: every job in your business ranked by hours saved with a go or no-go on each, tool picks with real pricing, a map of where your customer data is going today, and the payback math so you can see what the first build returns before you commit to it."),
      p("Then the tools themselves get built, documented and handed over. If you stop working with me you keep all of it, and somebody else can pick it up."),
      p("I will not put a figure in an email, because a figure without your context is a number I made up. What it costs depends on how many jobs are worth building and how tangled your setup is, and I cannot know that from here."),
      p("Twenty minutes on the phone and I can tell you exactly. Nothing to buy on that call."),
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
      p("Personal accounts. Free tiers. Customer names and addresses pasted into a chat box that trains on whatever it is given. Nobody did anything malicious, they were trying to get through the day faster."),
      p("It is one of the three things the guide asks you to do this week, and it is there because I have never looked at a business and found nothing. The fix is usually simple and cheap once you know, which makes the finding out the only hard part."),
    ],
    ask: "You can do that one without me. If you would rather have someone go through it with you, that is twenty minutes.",
  },
  {
    key: "handover",
    delay: "2 days",
    subject: "The question to ask anyone who builds for you",
    cta: "Book a call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Ask them this: if you disappear tomorrow, what do I still have?"),
      p("If the answer is a login to their platform, you are renting. When they put the price up or fold, your process walks out with them."),
      p("My answer is that you get the tool and the written documentation of how it works, in language you could hand to somebody else. If you sack me you keep all of it, and the next person can pick it up without ringing me."),
      p("Ask me that question. Ask it of everyone else you talk to as well."),
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
      p("In a business that already works, going from Level 1 to Level 3 usually frees five to fifteen hours a week across the team."),
      p("Your number will not be that number, because it depends on your jobs and your people. The shape of it holds though, and the hours are not dramatic ones. They are the same small tasks, done by hand, every week, for as long as you carry on."),
      p("The cost that gets less attention is that what lives in somebody's head stays there. If that person leaves, the process leaves with them. If you sell, you are selling a business that runs on people rather than systems, and it gets priced that way."),
      p("Doing nothing is a decision with a price on it, and most owners have simply never seen the figure."),
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
      p("If the timing is wrong, that is genuinely fine. The three tasks on the last page of the guide cost nothing and you do not need me for any of them. Pin the 5-block prompt where you work. Find out which AI accounts your team is using. Name the one job that keeps coming back."),
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
    // The stripped-down alternative. Both are built every time so the two can be
    // rendered side by side; which one is pushed is decided at push time.
    plainHtml: bareShell({ body, ask: email.ask, cta: email.cta, campaign }),
    // One text part, shared. It was already free of every marker the bare shell
    // removes, which is the clearest illustration of what the difference is.
    text: plainShell({ body, ask: email.ask, cta: email.cta, campaign }),
  };
});
