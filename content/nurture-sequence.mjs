/**
 * The nurture sequence sent after someone requests a free AI visibility scan.
 *
 * Written to André Chaperon's method rather than to a conventional
 * value-plus-pitch cadence. What that means in practice, and why the shape of
 * this file is what it is:
 *
 * ONE STORY, TOLD IN ORDER. Not 22 self-contained tips. There is a narrative
 * through-line: Max built a scanner, pointed it at his own site first, and it
 * came back 20 out of 100. Everything he learned afterwards is told in the
 * order he learned it. A reader who joins at email 9 is missing something, and
 * is meant to feel that.
 *
 * THE STORY IS TRUE. Chaperon's method runs on real stories, and a fabricated
 * case study would be both dishonest and, in this niche, trivially checkable.
 * The 20/100 is real and reproducible: run footholdsystems.com through the scan
 * and you get it. Nothing here invents a client, a testimonial or a result.
 *
 * OPEN LOOPS. Most emails end by opening something they do not close. The next
 * one closes it and opens another. That is the engine; without it this is just
 * a list of tips arriving on a schedule.
 *
 * THE OFFER ARRIVES LATE AND QUIETLY. Chaperon's position is that selling
 * happens after trust, not alongside it. So `cta` and `ask` are optional here,
 * and the first fifteen emails have neither. No button, no link, nothing to
 * click. A reader gets two full weeks of a person telling them something useful
 * with nothing asked in return, because that is the whole mechanism by which
 * the ask at the end carries any weight.
 *
 * WRITTEN TO ONE PERSON. Not to a segment. One owner, reading on a phone,
 * between jobs.
 *
 * WHAT THIS FILE CANNOT DO. Chaperon's system is interest-based: clicks reveal
 * what someone cares about and branch them into different threads, a choose
 * your own adventure. A single linear Resend automation cannot express that.
 * This is the best linear version of the method, and the branching is the
 * obvious next thing to build once there is enough traffic to justify it.
 *
 * ---
 *
 * Content only. Resend owns the sequence, as templates plus an automation. This
 * file is the source of truth for the copy: edit here, then run
 * `node scripts/create-email-sequence.mjs` to push it.
 *
 * That builds a *new* automation rather than updating the live one, because
 * Resend does not allow an enabled automation's steps to be edited. Switching
 * over means enabling the new one, disabling the old, and updating
 * RESEND_AUTOMATION_ID. Editing this file alone changes nothing being sent.
 *
 * After changing the copy or the cadence, run
 * `node scripts/build-sequence-steps.mjs` as well. The dashboard and the click
 * attribution both read the generated key list.
 *
 * Shape: 22 emails over 38 days. Daily for the first fortnight, then every
 * other day for six, then a 5 day and a 7 day gap to close.
 *
 * House style: short sentences, plain English, no hype, no exclamation marks.
 * No em-dashes anywhere. Anything technical has to be copy-pasteable or it does
 * not belong here.
 */

export const SCAN_URL = "https://www.footholdsystems.com/#scan";
export const BRAND_ADDRESS = "403 E Arrow Hwy Suite 306, San Dimas, CA 91773";

/** What the human tier costs. Named once, mentioned in only three emails. */
export const UPGRADE_PRICE = "$1,500";

export function tagged(url, campaign, content = "cta") {
  const target = new URL(url);
  target.searchParams.set("utm_source", "footholdsystems");
  target.searchParams.set("utm_medium", "email");
  target.searchParams.set("utm_campaign", campaign);
  target.searchParams.set("utm_content", content);
  return target.toString();
}

export const UPGRADE_TRACKER = "https://www.footholdsystems.com/api/go/upgrade";

/**
 * The upgrade link, pointed at our own redirect rather than at Whop.
 *
 * That hop creates the checkout server-side so the campaign can be attached as
 * metadata, which is the only way a purchase can be traced to the email that
 * caused it. Built by hand rather than with URL, because `new URL().toString()`
 * percent-encodes the braces in the merge tag and Resend only substitutes a tag
 * it can still recognise.
 */
function upgrade(campaign, content = "cta-button") {
  const params = new URLSearchParams({ e: campaign, c: content });
  return `${UPGRADE_TRACKER}?${params}&r={{{EMAIL}}}`;
}

function tagLinks(html, campaign) {
  let index = 0;
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (_match, url) => {
    index += 1;
    if (url.includes("/api/go/upgrade")) {
      return `href="${upgrade(campaign, `body-link-${index}`)}"`;
    }
    return `href="${tagged(url, campaign, `body-link-${index}`)}"`;
  });
}

const p = (text) => `      <p style="margin:0 0 16px;">${text}</p>`;

/**
 * A copy-pasteable block.
 *
 * Set in mono on a tinted panel so it reads as "this is the thing, take it"
 * without a word of instruction. `pre-wrap` because these are read on phones,
 * and a code block that scrolls sideways inside a mail client is one nobody
 * copies.
 */
const code = (text) =>
  `      <pre style="margin:0 0 16px;padding:14px 16px;background:#e2dfd4;border-radius:8px;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:#1f1f1d;">${text}</pre>`;

/**
 * The line that opens a loop into the next email.
 *
 * Its own helper rather than another paragraph because it is doing structural
 * work, and because giving it a name makes it obvious at a glance which emails
 * have one and which do not. Set apart and slightly quieter, the way a "next
 * week on" caption is.
 */
const loop = (text) =>
  `      <p style="margin:22px 0 18px;padding-top:14px;border-top:1px solid #d4d1c6;color:#57564f;">${text}</p>`;

/**
 * Shared shell.
 *
 * `cta` and `ask` are optional and usually absent. An email with nothing to
 * click is the point for the first two thirds of this sequence, and a template
 * that always renders a button would quietly undo that.
 */
function shell({ body, ask, cta, campaign }) {
  return `<div style="background:#eae8e1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:28px 16px;">
  <div style="max-width:520px;margin:0 auto;">
    <p style="margin:0 0 20px;color:#7a786f;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">FootHold AEO</p>
    <div style="color:#1f1f1d;font-size:16px;line-height:1.65;">
${body}
${ask ? p(ask) : ""}
${p("Max")}
    </div>
${
  cta
    ? `    <a href="${upgrade(campaign)}" style="display:inline-block;margin-top:8px;background:#1b1b1b;color:#f2efe6;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:8px;">${cta} &rarr;</a>`
    : ""
}
    <hr style="border:none;border-top:1px solid #d4d1c6;margin:28px 0 16px;">
    <p style="margin:0;color:#7a786f;font-size:12px;line-height:1.6;">
      FootHold Systems &middot; ${BRAND_ADDRESS}<br>
      <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#7a786f;">Unsubscribe</a>. One click, no hard feelings.
    </p>
  </div>
</div>`;
}

/**
 * The same email with every marketing marker stripped out.
 *
 * Gmail files bulk mail on what it looks like, not on who sent it, and the
 * shell above still carries five things personal email never has: a coloured
 * canvas, a fixed-width column, an uppercase letterspaced masthead, a rule, and
 * a padded inline-block anchor. That last one is the loudest. A button exists in
 * exactly one kind of email.
 *
 * This shell has none of them, which matters more here than it did before: a
 * sequence whose whole premise is that it reads like a person writing to you
 * should not arrive looking like a newsletter. The default.
 */
function bareShell({ body, ask, cta, campaign }) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1d;">
${body}
${ask ? p(ask) : ""}
${cta ? p(`<a href="${upgrade(campaign)}">${cta}</a>`) : ""}
${p("Max")}
      <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#7a786f;">
        FootHold Systems &middot; ${BRAND_ADDRESS}<br>
        <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#7a786f;">Unsubscribe</a>. One click, no hard feelings.
      </p>
</div>`;
}

/**
 * The same email as plain text.
 *
 * Not optional. An HTML-only message is one of the oldest spam heuristics there
 * is, and this domain publishes DMARC p=reject. Derived from the already-tagged
 * HTML rather than written twice, so the two parts cannot drift.
 */
function textify(html) {
  return html
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, "$2: $1")
    .replace(/<\/p>/g, "\n")
    .replace(/<\/pre>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&rarr;/g, "")
    .replace(/&middot;/g, "·")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    // Strips exactly the six spaces the HTML template indents each block with,
    // and nothing deeper. A blanket trim would flatten the indentation inside a
    // code block, which is the one place here where leading whitespace matters.
    .map((line) => line.replace(/^ {6}/, "").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function plainShell({ body, ask, cta, campaign }) {
  // Built by pushing rather than by filtering a fixed array. The filter that
  // removed absent optional parts also removed the empty strings acting as
  // paragraph breaks, which ran the sign-off straight into the last line of the
  // body. Optional parts are now simply not pushed, so every "" left in here is
  // a blank line somebody meant.
  const parts = [textify(body)];
  if (ask) parts.push("", textify(ask));
  parts.push("", "Max");
  if (cta) parts.push("", `${cta}: ${upgrade(campaign)}`);
  parts.push(
    "",
    "--",
    `FootHold Systems · ${BRAND_ADDRESS}`,
    "Unsubscribe (one click, no hard feelings): {{{RESEND_UNSUBSCRIBE_URL}}}"
  );
  return parts.join("\n");
}

const emails = [
  /* ── Act 1, days 1-7. The discovery. Nothing to click, nothing asked. ──── */
  {
    key: "ownsite",
    delay: "1 day",
    subject: "I ran it on my own site first",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Your scan is either in your inbox by now or about to be. Before you open it, I want to tell you what happened when I ran this on myself, because it will make the report easier to read."),
      p("I built the scanner because I kept noticing something at work. People were describing a problem to ChatGPT and taking whatever business it named. Not searching. Not comparing. Asking, and going with the answer."),
      p("So I built a thing that checks whether a business is set up to be that answer. Twenty-five checks. Took a few weeks."),
      p("Then, because it seemed like the honest thing to do before pointing it at anyone else, I ran it on footholdsystems.com."),
      p("Twenty out of a hundred."),
      p("Grade F."),
      p("I run an AI consultancy. I had just spent three weeks building a tool to measure exactly this, and my own site was in the bottom fifth of everything I have scanned since."),
      loop("There was one line in that report that I have not been able to stop thinking about. I will show you tomorrow."),
    ],
  },
  {
    key: "oneline",
    delay: "1 day",
    subject: "The line I couldn't stop thinking about",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Here it is, word for word:"),
      code("You're invisible to agents right now. That's fixable."),
      p("Two sentences. I sat looking at them for longer than I would like to admit."),
      p("Not because it was harsh. Because of the second half. Fixable means it was never about how good the business is, or how long it has been running, or whether the work is any good. None of that was ever in question."),
      p("It was about whether a machine reading my website could tell what I did and who for. And it could not, because I had never once written the site for a reader that was not a person."),
      p("Twenty years of everybody optimising for human beings and for Google. Nobody writing for the third thing that turned up."),
      p("That is the whole of it, really. The rest of what I am going to send you over the next few weeks is just the specifics."),
      loop("The first specific is a test you can run in five minutes, on your phone, right now. It is the one that made me go quiet. Tomorrow."),
    ],
  },
  {
    key: "askit",
    delay: "1 day",
    subject: "Five minutes, and you'll know",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Open ChatGPT. Ask it three things, in this order. It matters that it is this order."),
      code("1. What do you know about [your business name] in [your town]?\n2. Who would you recommend for [the thing you do] in [your area]?\n3. Why did you pick those?"),
      p("The first tells you whether you exist to it."),
      p("The second tells you who is getting the call you wanted."),
      p("The third is the one that matters, and almost nobody asks it. It tells you what the model is actually weighing. Not what you assume it weighs."),
      p("Do the same in Gemini and Perplexity while you are there. They read different sources and they disagree with each other more than you would expect, which is itself worth seeing."),
      p("Write the answers down. Somewhere you will find them again. In six weeks you are going to want to compare, and you will not remember."),
      loop("When I did this for my own business, question one came back with something that was not me at all. I will tell you what it was, and what it turned out to mean, tomorrow."),
    ],
  },
  {
    key: "notme",
    delay: "1 day",
    subject: "It didn't know I existed",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("I asked what it knew about Foothold Systems. It told me, confidently and at length, about a company that was not mine."),
      p("Not a competitor. Not a mistake I could argue with. Just a different business that happened to share most of a name, and had made itself easier to find."),
      p("The scan had already told me why, in a line I had skimmed past the first time:"),
      code("\"Foothold Systems\" search returned 10 results but domain did not appear."),
      p("My own name. Ten results. Not one of them me."),
      p("Here is the part that took a while to accept. It is not that the model dislikes you or has judged you. It is that when it goes looking to check whether you are real, and finds a lot of other things wearing your name, it does what anyone would do. It goes with what it can verify."),
      p("The fix starts with one line, and it is the highest-leverage line on your entire site."),
      code("&lt;title&gt;Riverside Commercial HVAC | Rooftop Unit Replacement, Riverside County&lt;/title&gt;"),
      p("Name, what you do, where. Not Home. Not Welcome. Not your tagline."),
      p("Then say the same name, spelled identically, everywhere else you exist. Google Business Profile, the directories, your socials. Ltd or Limited, ampersand or the word and, with or without the LLC. Pick one. The inconsistency is doing more damage than the name itself."),
      loop("There is a reason fixing your own website only gets you part of the way, and it is the thing I found hardest to swallow. Tomorrow."),
    ],
  },
  {
    key: "notrust",
    delay: "1 day",
    subject: "It doesn't take your word for it",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Here is the hard part."),
      p("A model does not trust your website about your website."),
      p("Read that again, because I did. Everything you write about yourself is, from its position, a claim. Claims are cheap. What it weighs is corroboration: what independent sources say when you are not in the room. Directories, review platforms, industry bodies, local press, forums, other people's pages."),
      p("If the internet is quiet about your business, it has nothing to form an opinion from. And silence does not read as neutral. It reads as unproven."),
      p("Which is a strange thing to sit with when you have twenty years of happy customers, because none of that counts unless some of it is written down somewhere that is not yours."),
      p("The unglamorous fix, in the order I would do it:"),
      code("1. Google Business Profile: claimed, complete, categories right.\n2. The two or three directories that matter in YOUR trade.\n   Not the fifty generic ones. Two good ones beat twenty bad.\n3. Your trade association or licensing body listing.\n4. Chamber of commerce, local business associations.\n5. Wikidata, if you can support an entry."),
      p("Same name, same address format, same phone, everywhere. Inconsistency is worse than absence, because it makes the model less certain rather than more."),
      loop("Tomorrow I want to give you the single block of code that moved my own score more than anything else. It takes about twenty minutes and you can hand it to whoever runs your site."),
    ],
  },
  {
    key: "schema",
    delay: "1 day",
    subject: "The twenty minutes that moved it most",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Structured data. Stay with me, because this is the least interesting sentence I will write to you and the most useful thing in the sequence."),
      p("Every other part of your page is prose that something has to interpret. This part is facts, stated in a form that needs no interpretation at all. It is the difference between a model inferring what you do and simply reading it."),
      p("Paste this into the &lt;head&gt; of your homepage and fill in your own details."),
      code("&lt;script type=\"application/ld+json\"&gt;\n{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"LocalBusiness\",\n  \"name\": \"Your Business Name\",\n  \"description\": \"What you do, where, for whom.\",\n  \"url\": \"https://yoursite.com\",\n  \"telephone\": \"+1-555-555-5555\",\n  \"email\": \"you@yoursite.com\",\n  \"address\": {\n    \"@type\": \"PostalAddress\",\n    \"streetAddress\": \"123 Example St\",\n    \"addressLocality\": \"Your Town\",\n    \"addressRegion\": \"CA\",\n    \"postalCode\": \"91773\",\n    \"addressCountry\": \"US\"\n  },\n  \"areaServed\": \"Your county or metro\",\n  \"priceRange\": \"$$\",\n  \"openingHours\": \"Mo-Fr 08:00-17:00\"\n}\n&lt;/script&gt;"),
      p("Swap LocalBusiness for the specific type if one fits: Plumber, HVACBusiness, RoofingContractor, Electrician, Dentist, Attorney. Schema.org lists them all and the specific one always beats the general one."),
      p("Then check it in Google's Rich Results Test. If it validates, you are done, and you have just done the thing most of your competitors have not heard of."),
      loop("There is one line you can add to that block that does something the rest of it cannot. It is short enough to fit in a text message. Tomorrow."),
    ],
  },
  {
    key: "sameas",
    delay: "1 day",
    subject: "The one line that ties you together",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Remember the corroboration problem from a few days ago. Here is the line that starts solving it."),
      code("\"sameAs\": [\n  \"https://www.google.com/maps/place/your-listing\",\n  \"https://www.facebook.com/yourbusiness\",\n  \"https://www.linkedin.com/company/yourbusiness\",\n  \"https://www.yelp.com/biz/yourbusiness\",\n  \"https://www.bbb.org/us/ca/your-listing\"\n]"),
      p("Drop it inside yesterday's block, after openingHours. Every profile you actually control. Nothing you do not."),
      p("What it does is collapse four or five things that currently look unrelated into one. Right now your website, your Google listing, your Facebook page and your directory entries look to a model like separate entities that happen to share a name. That is the same confusion that had it telling me about a company that was not mine."),
      p("This is the cheapest corroboration there is. You are pointing at the evidence and saying: go and check. A claim something can verify is worth more than a claim it cannot, and this costs you ten minutes."),
      loop("Tomorrow, the thing I did that made me feel slightly ill. It takes two minutes and I would do it before anything else on this list."),
    ],
  },

  /* ── Act 2, days 8-14. What he found, still nothing asked. ─────────────── */
  {
    key: "javascript",
    delay: "1 day",
    subject: "Turn JavaScript off and look",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("In Chrome: Settings, Privacy and security, Site settings, JavaScript, Don't allow. Then load your own homepage."),
      p("Whatever is still on the screen is roughly what a lot of AI crawlers get. Many of them do not run JavaScript at all."),
      p("If your site is on a page builder, a heavy theme, or anything React-shaped, there is a real chance you are looking at a mostly empty page right now. Your prices, your service area, your phone number, all painted in a half second after load, all invisible to the thing you are trying to be found by."),
      p("The rule does not change even though the fix depends on your stack: the facts that decide whether you match a question have to be in the HTML that arrives, not added afterwards."),
      p("Turn it back on before the rest of the internet annoys you."),
      p("I want to be straight that this one is not always a quick fix. If your page came back blank, that is a conversation with whoever built it rather than an afternoon. But you need to know, and almost nobody checks."),
      loop("There is a version of this that is worse, because the site is perfect and it still cannot be read. I found one last month. Tomorrow."),
    ],
  },
  {
    key: "blocked",
    delay: "1 day",
    subject: "Perfect site. Completely invisible.",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Everything right. Fast, clean, server-rendered, real content, proper structure. Better built than most sites I look at."),
      p("And nothing could read it."),
      p("The firewall was turning the AI crawlers away. Not maliciously, not by anyone's decision. The bot protection could not tell an assistant from a scraper, so it treated both the same way, which is what bot protection is for."),
      p("This is the one that catches the businesses who did everything else properly, and it is invisible from the inside. Your site works perfectly when you visit it. You are not a bot."),
      p("Open yoursite.com/robots.txt and look. Then add these:"),
      code("User-agent: GPTBot\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /\n\nUser-agent: Applebot-Extended\nAllow: /"),
      p("Then, and this is the part people miss, check your firewall as well. If you are behind Cloudflare, the bot fight settings will block most of these regardless of what your robots.txt says. The file is a request. The firewall is the door."),
      p("Allowing them is not the same as allowing scrapers. These are documented, published agents with names, which is exactly why you can name them."),
      loop("Tomorrow: the four most expensive words on most websites. I would bet they are on yours."),
    ],
  },
  {
    key: "pricing",
    delay: "1 day",
    subject: "The four most expensive words on your site",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Call for a quote."),
      p("I understand entirely why it is there. Every job is different, the price depends on things you cannot know from a form, and putting a number up invites people to compare you on the wrong axis. I have had this argument with enough owners to know it is not laziness."),
      p("Here is what it costs, though, and it is not what you think."),
      p("It is not that customers hate it. Some do, most do not. It is that it is a dead end for anything trying to compare options on someone's behalf. A model that cannot tell whether you fit somebody's budget will recommend one that can, and you will never learn that you were in the running."),
      p("You do not have to publish a rate card. Any of these work:"),
      code("Starting at $X for the most common version of the job.\nMost jobs land between $X and $Y.\n$X per unit, per hour, per square foot.\nA worked example: a 3,000 sq ft single storey came to $X last month."),
      p("A band beats silence. And silence is not protecting you, because the customer is getting a number from somewhere regardless. It is just somebody else's number, attached to somebody else's name."),
      p("On the page, in text. Not in an image, not in a PDF."),
      loop("Tomorrow, the opposite advice to everything you have been told about your website, and the one that has surprised people most."),
    ],
  },
  {
    key: "whennot",
    delay: "1 day",
    subject: "Say what you won't do",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Every instinct says widen. List everything. Do not talk yourself out of work you could take."),
      p("Do the opposite, and you get recommended more."),
      p("A model deciding whether to name you is doing a matching job. Every boundary you state makes the match sharper, because it tells it when you are right and, just as usefully, when you are not."),
      p("Three sentences will do it. \"We handle commercial only, no residential. Units under 25 tons. Riverside and San Bernardino counties, we do not travel to LA.\""),
      p("Without that it has to guess, and guessing is where you lose to somebody who was clear."),
      p("There is a business argument too, which is that the enquiries you lose from this are the ones you were going to turn down anyway, after two phone calls and a site visit you did not get paid for."),
      p("About page, or the top of your services page. Plain sentences. No hedging."),
      loop("Tomorrow: the file almost nobody has yet, and how to write yours in an afternoon."),
    ],
  },
  {
    key: "llmstxt",
    delay: "1 day",
    subject: "The file almost nobody has",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("llms.txt is a plain markdown file at the root of your site that tells a model what you are and which pages matter. It is new enough that having one is still unusual, which will not be true for long."),
      p("Here is an entire one. Copy the shape and change the words."),
      code("# Riverside Commercial HVAC\n\n&gt; Commercial rooftop HVAC replacement and repair across Riverside\n&gt; and San Bernardino counties. Units under 25 tons. Same-week\n&gt; service on most jobs.\n\n## Services\n- [Rooftop unit replacement](https://site.com/rooftop-replacement):\n  $8,000-$22,000 installed, usually within five business days.\n- [Emergency repair](https://site.com/emergency): 24 hour response\n  for existing service customers.\n\n## About\n- [Who we are](https://site.com/about): Family owned since 1998,\n  14 technicians, NATE certified.\n- [Service area](https://site.com/area): Riverside and San\n  Bernardino counties. Commercial only.\n\n## Contact\n- Phone: (555) 555-5555\n- [Get a quote](https://site.com/quote)"),
      p("Save it as llms.txt, upload to the root so it sits at yoursite.com/llms.txt. Keep it to what you would tell somebody in thirty seconds."),
      p("I will be honest about the state of this one: nobody can promise you yet what weight it carries. It is a convention, not a standard, and it is young. It costs an afternoon, and the sites that end up being read tend to be the ones that made themselves easy to read."),
      loop("Tomorrow, the pages you have never thought about, which turn out to matter more than your homepage."),
    ],
  },
  {
    key: "trust",
    delay: "1 day",
    subject: "The boring pages",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("About. Contact. Privacy. Terms."),
      p("Nobody reads them. They matter more than your homepage for this, and here is why: they are how anything verifies that a business is real. Missing them reads as thin. Thin reads as risky. Risky does not get recommended to somebody who asked for help."),
      p("What actually helps:"),
      code("About: the real history, the actual people, how many of you\nthere are, what you are certified in. Not a mission statement.\n\nContact: a physical address and a phone number as TEXT, not\nin an image. Nothing can read a phone number in a JPEG.\n\nPrivacy and terms: they only need to exist and be linked."),
      p("The text one is the trap. Designers love putting contact details in a graphic because it looks tidier, and it renders the single most important fact on your site unreadable to the thing you are trying to reach."),
      p("While you are in there, check they match your Google Business Profile exactly. Same suite number, same abbreviations, same phone format. That consistency is worth more than any one of them being perfect."),
      loop("Tomorrow is the halfway point, and I want to give you the whole list in one place so you can see what you have actually done."),
    ],
  },
  {
    key: "checkpoint",
    delay: "1 day",
    subject: "Two weeks in. Where are you?",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Everything so far, in one place:"),
      code("[ ] Title tag: name, what you do, where\n[ ] Business name spelled identically everywhere\n[ ] JSON-LD block on the homepage\n[ ] sameAs array listing your profiles\n[ ] Checked the site with JavaScript off\n[ ] AI crawlers allowed in robots.txt AND the firewall\n[ ] A price, a range, or a worked example published\n[ ] What you do not do, stated plainly\n[ ] llms.txt at the root\n[ ] About and contact with real details in text\n[ ] Google Business Profile claimed and consistent"),
      p("Six or more and you are genuinely ahead of nearly everyone in your category. Go back and re-run the three questions from day three and see whether anything has moved."),
      p("None of them is also a real answer, and the most common one. They are all easy and not one of them is urgent, which is precisely why they never get done."),
      p("I have not asked you for anything in two weeks and I am not about to start. But the shape of what I do changes from here, because everything above is the part you can do from a list."),
      loop("What comes next is what I found when I stopped looking at my own site and started looking at everybody else's. Tomorrow."),
    ],
  },

  /* ── Act 3, days 16-26. The pattern, and the ceiling. ──────────────────── */
  {
    key: "pattern",
    delay: "2 days",
    subject: "What every site had in common",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Once the scanner worked I pointed it at everything I could. Clients, competitors, businesses I admire, a few enormous companies to see whether they were doing something I was not."),
      p("Two things came out of that, and neither is what I expected."),
      p("The first is that size has almost nothing to do with it. I scanned businesses with real budgets and marketing teams that scored worse than a two-person operation with a five-page site. Because none of this is expensive. It is just nobody's job."),
      p("The second is the one that reframed the whole thing for me. The businesses that scored well had not done anything clever. They had been specific. They said what they did, for whom, where, and roughly what it cost, in plain sentences, because that is how they talk. The score was almost a side effect of not being vague."),
      p("Which means the technical list I have been sending you is real, and it is also the smaller half."),
      loop("There is a check I got wrong, in a way that had me telling somebody something untrue about their own business. I would rather tell you about it than not. Tomorrow."),
    ],
  },
  {
    key: "competitor",
    delay: "2 days",
    subject: "Find out who is getting your call",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Since I have been telling you what I found looking at other people's sites, here is how to do it for your own category. It is worth an hour, once, properly, with a notepad."),
      p("Write down the ten questions a customer would actually ask before hiring you. Real ones, in their words. Not your service names."),
      p("Then put each one to ChatGPT, Gemini and Perplexity, and record who gets named."),
      p("You are watching for three things. Who comes up most. What the model says about them, in its own words. And whether the reason it gives is something that could just as easily be true of you."),
      p("That last column is the useful one. Nine times out of ten the winner is not the better operator. They are the better documented one. They published a price. They named their service area. They answered the question on a page instead of burying it in a brochure."),
      p("Which is good news, because documentation is something you can change this week. Being genuinely better takes years, and you have probably already done it."),
      p("Once a month, same ten questions, same notepad. That series is the only real measure of whether any of this is working. Everything else is a proxy."),
      loop("Next time: a check I got wrong, in a way that had me telling somebody something untrue about their own business."),
    ],
  },
  {
    key: "wrong",
    delay: "2 days",
    subject: "I got one wrong",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("A friend ran his site through it. The report told him his business name did not bring up his website."),
      p("It was not true. He is number one for his own name. He checked, on his phone, in about four seconds, and told me so."),
      p("What the scan had actually recorded was that he appeared at position four or five. Present, just not top. My wording turned a partial pass into a flat failure, and he read it, and it was wrong."),
      p("I fixed the wording. But the more useful thing is why the two disagreed, because it applies to you as well."),
      p("The check runs a cold search. No login, no history, no location, no personalisation. That is how a model looks you up when a stranger asks about you."),
      p("When you search your own name you are logged in, in your own town, with years of your own behaviour behind it. Of course you are first. Your browser knows exactly who you are."),
      p("Both results are real. They are answering different questions. The cold one is the question that matters here, because the thing looking you up on a customer's behalf is not sitting in your office."),
      p("So: if something in your report contradicts what you see, that gap is usually the finding rather than a mistake. And if it is a mistake, tell me. I would rather know."),
      loop("Tomorrow, the part I have been circling for three weeks: what a scanner cannot see."),
    ],
  },
  {
    key: "ceiling",
    delay: "2 days",
    subject: "What the checklist can't do",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Seventeen emails. You have the whole technical list, and I want to be straight about what it gets you."),
      p("Everything I have sent is detectable. A scanner finds it, which means every competitor running the same scan gets the same list. Do all of it and you are level with the best-prepared business in your category."),
      p("Level is a good place to be. It is not the same as being the one that gets named."),
      p("Three things decide that last part, and not one of them appears on a checklist."),
      p("<strong>Positioning.</strong> Not what you do. What you should be known for. Most businesses are three things and would be recommended far more often as one. Deciding which one is judgement, and it is the highest-value hour anybody spends on this."),
      p("<strong>The language.</strong> Whether the words on your pages are the words your customers use when they describe the problem out loud. They are usually not the words the industry uses, and almost never the words on the average website."),
      p("<strong>The corroboration.</strong> Getting the rest of the web to agree with you. Outreach, relationships, weeks."),
      p("You can do all three yourself. They are slow, and they need somebody to make a call rather than follow an instruction."),
      loop("Tomorrow I will show you what the second one looks like, with a real before and after, so it stops being abstract."),
    ],
  },
  {
    key: "rewrite",
    delay: "2 days",
    subject: "Before and after",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Before. This is close to verbatim from a real site, with the identifying bits changed."),
      code("Welcome to our website\n\nWith over 25 years of experience, we pride ourselves on quality\nworkmanship and outstanding customer service. Our team of highly\ntrained professionals is dedicated to exceeding your expectations\non every project, large or small. Contact us today for a free\nestimate!"),
      p("Nothing there is false. Nothing there is usable either. Not one fact that could be matched to a question."),
      p("After."),
      code("Commercial rooftop HVAC replacement in Riverside County\n\nWe replace commercial rooftop units under 25 tons across\nRiverside and San Bernardino counties. Most replacements run\n$8,000 to $22,000 installed and take five business days from\napproval. We are commercial only and we do not travel to LA.\n\n14 technicians, NATE certified, family owned since 1998."),
      p("Same business. Same truth. Roughly the same length. The difference is that the second one can be matched to somebody describing their situation, and the first one cannot be matched to anything."),
      p("Now do that for every page."),
      p("That is the bit that takes a fortnight, and the bit that almost nobody finishes, because writing about yourself specifically is genuinely hard and there is always something more urgent on a Tuesday."),
      loop("Tomorrow I will tell you what I actually do for people, since I have spent three weeks not mentioning it."),
    ],
  },
  {
    key: "whatido",
    delay: "2 days",
    subject: "What I actually do",
    cta: "See how it works",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Three weeks, nineteen emails, nothing asked. Here is the thing I do, once, and then I will leave it alone."),
      p("Some people read a list like this one and go and do it. That is a completely fine outcome and it is why I sent the list rather than teasing it."),
      p("For the ones who will not, because it is a fortnight of work and the phone keeps ringing, I do it for them."),
      p("<strong>Every technical fix from the last three weeks, implemented.</strong> Schema, sameAs, crawler access, llms.txt, metadata, trust pages, title tags. On your actual site, properly."),
      p("<strong>Your pages rewritten.</strong> Positioning decided first, then the homepage and your main service pages rewritten the way yesterday's example was. In your voice, checked with you, not generated and pasted."),
      p("<strong>The corroboration work.</strong> Listings claimed, corrected, made consistent across the sources that matter in your trade."),
      p("<strong>A monthly re-run.</strong> Same prompts, same competitors, every month. Named or not named. That is the whole scoreboard."),
      p(`${UPGRADE_PRICE}, once, not a retainer. Two to three weeks. You keep everything, including a written record of what changed and why, so if you never speak to me again the next person can pick it up.`),
      p("What it is not: a guarantee that ChatGPT will recommend you. Nobody controls a model's output, and anybody telling you otherwise is selling you something. What I control is every input it uses, and I will show you the movement month by month."),
    ],
    ask: "That is the only time I will describe it at length. If it is useful, the link is there. If not, the list still works.",
  },

  /* ── Act 4, days 31 and 38. Close. Quiet. ──────────────────────────────── */
  {
    key: "invisible",
    delay: "5 days",
    subject: "The number nobody can show you",
    cta: "See how it works",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("One last idea, and it is the one that made me build any of this."),
      p("When your ads underperform, you see it. When your rankings slip, you see it. There is a number, it moves, you react. Every marketing problem you have ever had announced itself."),
      p("This one does not."),
      p("Nobody asks an assistant, gets told about a competitor, and leaves a trace on anything you own. No impression. No bounce. No line in Analytics saying lost to an AI recommendation. The lead simply never becomes a lead, and your reporting looks exactly like last month."),
      p("It is the first channel I know of that is completely invisible to the business losing it."),
      p("Which is why the useful question is not what this is costing you. You cannot know that, and I would not trust anybody who put a figure on it. The question is how many months of not knowing you are willing to buy."),
      p("I sent you the list because the list genuinely works. Whether you do it yourself or hand it to me matters much less than whether it gets done at all."),
    ],
    ask: "If you would rather it was just done, that is what the link is for.",
  },
  {
    key: "last",
    delay: "7 days",
    subject: "Last one from me",
    cta: "See how it works",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("This is the last email in this sequence. Nothing more from me after today unless you ask for it."),
      p("You have had every technical fix I know, in the order I learned them, starting with the one where I scanned my own site and scored twenty out of a hundred. That was not a device. It genuinely happened, and it is genuinely why any of this exists."),
      p("If the timing is wrong, that is fine. Start with the three that cost an afternoon: the title tag, the schema block, and the crawler permissions. Those three alone move most sites."),
      p("If it is not timing but something else, reply and tell me. Wrong fit, wrong size, too expensive, you tried it and nothing happened. I would rather know, and I will take the answer without arguing."),
      p("And if you have been meaning to deal with this for five weeks while it slid down the list behind things that were shouting louder, this is the nudge. That is all it is."),
      p("Thanks for reading this far. Genuinely. Twenty-two emails is a lot to ask of anyone."),
    ],
    ask: "The link stays open whether or not you use it today.",
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
    plainHtml: bareShell({ body, ask: email.ask, cta: email.cta, campaign }),
    text: plainShell({ body, ask: email.ask, cta: email.cta, campaign }),
  };
});
