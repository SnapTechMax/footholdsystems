/**
 * The nurture sequence sent after someone requests a free AI visibility scan.
 *
 * The scan report tells them what is wrong and hands them the free half: the
 * diagnosis. This sequence is the follow-up, and its job is to give away the
 * fixes, in full, one a day, until the reader is in no doubt that we know how
 * this works.
 *
 * That is the strategy, not a mistake. Everything a checklist can express is
 * given away here, because a checklist is not what the offer is. What the
 * $1,500 tier buys is the half that has no checklist: deciding what this
 * business should be positioned as, rewriting the pages so a model can tell
 * what it is for, going and building third-party corroboration, and re-running
 * the prompts every month to prove it moved. Emails 1 to 17 hand over the
 * tactics. 18 to 20 name the ceiling those tactics hit. The offer is the way
 * through it.
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
 * After changing the copy or the cadence, run
 * `node scripts/build-sequence-steps.mjs` as well. The dashboard and the click
 * attribution both read the generated key list, and a key that exists in the
 * emails but not there is a click that gets dropped.
 *
 * Nothing on the website reads this file.
 *
 * Shape: 22 emails over 38 days, matching the cadence this replaced. Daily for
 * the first fortnight, then every other day for six, then a 5 day and a 7 day
 * gap to close.
 *
 * Every email carries one usable tip and one ask. The ratio moves across the
 * sequence: early emails are almost all tip with the offer mentioned in
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
 * Anything technical has to be copy-pasteable or it does not belong here.
 */

export const SCAN_URL = "https://www.footholdsystems.com/#scan";
export const BRAND_ADDRESS = "403 E Arrow Hwy Suite 306, San Dimas, CA 91773";

/** What the human tier costs. Stated in the copy often enough to be worth a constant. */
export const UPGRADE_PRICE = "$1,500";

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

export const UPGRADE_TRACKER = "https://www.footholdsystems.com/api/go/upgrade";

/**
 * The upgrade button, pointed at our own redirect rather than at Whop.
 *
 * That hop is what makes per-email attribution possible: the click is logged
 * server-side before the visitor is handed on, and the redirect attaches the
 * campaign as Whop metadata so a completed purchase can be traced back to the
 * email that caused it. Clicks and sales then join on that key, which is how
 * "which email sold this" gets an answer.
 *
 * Built by hand rather than with URL, on purpose. `new URL().toString()`
 * percent-encodes the braces in the merge tag, and Resend only substitutes a
 * tag it can still recognise. Encoded, `{{{EMAIL}}}` would be delivered
 * literally to every recipient. The redirect discards any value still carrying
 * braces, so if this tag is ever wrong the attribution degrades to anonymous
 * counts instead of inventing a contact.
 */
function upgrade(campaign, content = "cta-button") {
  const params = new URLSearchParams({ e: campaign, c: content });
  return `${UPGRADE_TRACKER}?${params}&r={{{EMAIL}}}`;
}

/**
 * Tag every link in an email body, not just the button.
 *
 * Inline links would otherwise arrive in analytics as untagged direct traffic
 * and could not be told apart from someone finding the site on their own.
 * Resend reports no opens or clicks through its API, so these parameters are
 * the only click data there is.
 */
function tagLinks(html, campaign) {
  let index = 0;
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (_match, url) => {
    index += 1;
    // An upgrade link written inline in body copy goes through the tracker too,
    // otherwise it would be the one offer link in the sequence that produces no
    // click record and no attribution.
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
 * Half this sequence hands over snippets the reader is meant to paste into
 * their own site. In a proportional font with normal line height they read as
 * prose and get skimmed past, so they are set in mono on a tinted panel: it
 * signals "this is the thing, take it" without a word of instruction.
 *
 * `pre-wrap` rather than `pre`, because these are read on phones and a code
 * block that scrolls sideways inside an email client is a code block nobody
 * copies.
 */
const code = (text) =>
  `      <pre style="margin:0 0 16px;padding:14px 16px;background:#e2dfd4;border-radius:8px;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word;color:#1f1f1d;">${text}</pre>`;

/**
 * Shared shell. Deliberately plainer than a marketing template. A nurture
 * message that looks like a newsletter gets read like one.
 */
function shell({ body, ask, cta, campaign }) {
  return `<div style="background:#eae8e1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:28px 16px;">
  <div style="max-width:520px;margin:0 auto;">
    <p style="margin:0 0 20px;color:#7a786f;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;">FootHold AEO</p>
    <div style="color:#1f1f1d;font-size:16px;line-height:1.65;">
${body}
${p(ask)}
${p("Max")}
    </div>
    <a href="${upgrade(campaign)}" style="display:inline-block;margin-top:8px;background:#1b1b1b;color:#f2efe6;font-weight:700;font-size:15px;text-decoration:none;padding:13px 26px;border-radius:8px;">${cta} &rarr;</a>
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
 * Gmail's tab classifier is not reading your reputation when it files something
 * under Promotions. That decision is made on mail it has already accepted, on
 * what the message looks like. `shell()` above, restrained as it is, still
 * carries five things personal email never has: a coloured canvas, a
 * fixed-width column, an uppercase letterspaced masthead, a horizontal rule,
 * and an `inline-block` anchor with padding and a border radius. That last one
 * is the loudest. A button exists in exactly one kind of email.
 *
 * This shell has none of them. One font declaration, paragraphs, and the CTA as
 * an ordinary inline link left in the client's default styling, deliberately
 * not brand-coloured, because a restyled link is a designed link.
 *
 * The code blocks stay monospaced here, because that is not decoration. A
 * schema snippet reflowed as prose is a snippet nobody can use.
 *
 * Two things stay because they are not optional: the postal address, which
 * CAN-SPAM requires, and the unsubscribe link, which Gmail requires of bulk
 * senders. `List-Unsubscribe` is itself a Promotions signal and there is no
 * version of this that removes it. That is the ceiling on how far this can go.
 *
 * `SEQUENCE_STYLE=designed` selects the shell above instead, so the two can be
 * compared before either reaches a recipient.
 */
function bareShell({ body, ask, cta, campaign }) {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1f1f1d;">
${body}
${p(ask)}
${p(`<a href="${upgrade(campaign)}">${cta}</a>`)}
${p("Max")}
      <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#7a786f;">
        FootHold Systems &middot; ${BRAND_ADDRESS}<br>
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
 * client with images and styling switched off.
 *
 * Derived from the already-tagged HTML rather than written twice, so the two
 * parts cannot drift and the tracked link is identical in both.
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
    .replace(/<\/pre>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&rarr;/g, "")
    .replace(/&middot;/g, "·")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    // &amp; last, so an escaped entity inside a snippet does not get
    // double-decoded into a tag by the replacements above.
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    // Strip exactly the six spaces the HTML template indents each p() and
    // code() with, and nothing deeper. A blanket trim() would also flatten the
    // indentation *inside* a code block, which is the one place here where
    // leading whitespace is load-bearing: an unindented JSON-LD snippet is
    // still valid but it is markedly harder to read, and these blocks exist to
    // be copied. Worth knowing if a future snippet is ever indented six or more
    // spaces at its own top level, which none currently are.
    .map((line) => line.replace(/^ {6}/, "").trimEnd())
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
    `${cta}: ${upgrade(campaign)}`,
    "",
    "--",
    `FootHold Systems · ${BRAND_ADDRESS}`,
    "Unsubscribe (one click, no hard feelings): {{{RESEND_UNSUBSCRIBE_URL}}}",
  ].join("\n");
}

const emails = [
  /* ── Days 1-14: daily. Almost all value, the offer barely present. ─────── */
  {
    key: "entity",
    delay: "1 day",
    subject: "You are not a website any more",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Your scan has landed by now. Before you touch any of it, the one idea that makes the rest make sense."),
      p("Google ranks pages. It asks which URL best matches a string of words, and twenty years of advice is built on winning that."),
      p("An AI assistant does not rank pages. It recommends <em>entities</em>. Businesses. Named things it has formed an opinion about from everything it has ever read."),
      p("That is why a site can sit at number one on Google and never once get named by ChatGPT. They are not the same question. One is document matching. The other is closer to reputation."),
      p("Every email in this sequence is one thing you can do to make that opinion exist and be correct. Most of them take under an hour. None of them need me."),
    ],
    ask: "Twenty one more of these coming, one a day. If you would rather skip to the end and have it done for you, that is what the button is.",
  },
  {
    key: "askit",
    delay: "1 day",
    subject: "Go and ask it about yourself",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Five minutes, and it will tell you more than any dashboard."),
      p("Open ChatGPT. Ask it three things, in this order:"),
      code("1. What do you know about [your business name] in [your town]?\n2. Who would you recommend for [the thing you do] in [your area]?\n3. Why did you pick those?"),
      p("The first tells you whether you exist. The second tells you who is taking the call you wanted. The third is the useful one, because it tells you what the model is actually weighing, and it is almost never what owners expect."),
      p("Do it in Gemini and Perplexity too. They read different sources and they disagree more than you would think."),
      p("Write the answers down somewhere. In six weeks you will want to compare."),
    ],
    ask: "If question two comes back with three competitors and not you, that is the exact problem we fix.",
  },
  {
    key: "schema",
    delay: "1 day",
    subject: "The block that does the most work",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("If you only do one technical thing from this sequence, do this one."),
      p("Structured data is the only part of your page that states facts without ambiguity. Everything else is prose a model has to interpret. This it can simply read."),
      p("Paste this into the &lt;head&gt; of your homepage and fill in your details. It is the same shape whatever trade you are in."),
      code("&lt;script type=\"application/ld+json\"&gt;\n{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"LocalBusiness\",\n  \"name\": \"Your Business Name\",\n  \"description\": \"What you do, where, for whom.\",\n  \"url\": \"https://yoursite.com\",\n  \"telephone\": \"+1-555-555-5555\",\n  \"email\": \"you@yoursite.com\",\n  \"address\": {\n    \"@type\": \"PostalAddress\",\n    \"streetAddress\": \"123 Example St\",\n    \"addressLocality\": \"Your Town\",\n    \"addressRegion\": \"CA\",\n    \"postalCode\": \"91773\",\n    \"addressCountry\": \"US\"\n  },\n  \"areaServed\": \"Your county or metro\",\n  \"priceRange\": \"$$\",\n  \"openingHours\": \"Mo-Fr 08:00-17:00\"\n}\n&lt;/script&gt;"),
      p("Swap LocalBusiness for the specific type if one fits you: Plumber, HVACBusiness, RoofingContractor, Electrician, Dentist, Attorney. Schema.org lists them all and the specific one is always better than the general one."),
      p("Then check it at Google's Rich Results Test. If it validates, you are done."),
    ],
    ask: "That block alone moves most of the sites we scan. It is also the easiest thing on the list, which tells you something about how much room there is.",
  },
  {
    key: "sameas",
    delay: "1 day",
    subject: "The one line that ties you together",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Yesterday's block, plus one array, and it does something the rest of it cannot."),
      p("Right now your website, your Google Business Profile, your Facebook page and your trade directory listings look to a model like four unrelated things that happen to share a name. sameAs collapses them into one entity."),
      code("\"sameAs\": [\n  \"https://www.google.com/maps/place/your-listing\",\n  \"https://www.facebook.com/yourbusiness\",\n  \"https://www.linkedin.com/company/yourbusiness\",\n  \"https://www.yelp.com/biz/yourbusiness\",\n  \"https://www.bbb.org/us/ca/your-listing\"\n]"),
      p("Drop it inside the same JSON-LD block, after openingHours. Every profile you actually control, nothing you do not."),
      p("This is the cheapest corroboration there is. You are telling the model where to go and check, and a claim it can verify is worth more than a claim it cannot."),
    ],
    ask: "Two days in and you have done the two things most of your competitors have not heard of.",
  },
  {
    key: "specifics",
    delay: "1 day",
    subject: "Why quality work never gets recommended",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Go and read your homepage as if you had never seen it. Count how many sentences would still be true if a competitor put their name on them."),
      p("<em>Quality workmanship. Customer first. Family owned and operated since 1998. Free estimates.</em> All fine. All completely unusable to something deciding who to recommend, because they match everyone and therefore no one."),
      p("Now the version that works:"),
      p("<em>We replace commercial rooftop HVAC units under 25 tons across Riverside and San Bernardino counties, usually within five business days. Most jobs land between $8,000 and $22,000.</em>"),
      p("That is not better writing. It is a machine-readable trigger. The moment somebody describes that exact situation to an assistant, you are the obvious answer, because you are the only one who said so."),
      p("Pick your top three services. Write one specific sentence for each. What, for whom, where, how fast, roughly what it costs."),
    ],
    ask: "Vague businesses are not disliked. They are unrecommendable. That distinction is most of the job.",
  },
  {
    key: "questions",
    delay: "1 day",
    subject: "Write the question, not the service",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Your services page is probably organised the way your business is organised. That is the wrong axis."),
      p("Nobody types <em>commercial HVAC services</em> into ChatGPT. They type <em>our rooftop unit keeps tripping the breaker, who do we call in Riverside and what will it cost.</em>"),
      p("So make the page the question. Literally: put it in the heading, and answer it in the first two sentences before any preamble."),
      code("H1: How much does it cost to replace a rooftop HVAC unit in Riverside County?\n\nFirst line: Most commercial rooftop replacements under 25 tons run\n$8,000 to $22,000 installed, and we usually complete them within\nfive business days.\n\nThen: what changes the price, what is included, how to get a number\nfor your building.")
      ,
      p("One page per real question. Three good ones beat thirty thin ones. The answer goes first because retrieval grabs the top of the page, and a page that buries the answer under a paragraph about your values gets skipped."),
    ],
    ask: "This is the highest-value writing you will do all year, and it is also the part owners put off longest.",
  },
  {
    key: "crawlers",
    delay: "1 day",
    subject: "You might be blocking them without knowing",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("This is the one that catches good sites. Everything is right, and nobody can read it, because the security tooling cannot tell an AI assistant from a scraper and turns both away."),
      p("Open yoursite.com/robots.txt and look. Then add these explicitly:"),
      code("User-agent: GPTBot\nAllow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /\n\nUser-agent: Applebot-Extended\nAllow: /"),
      p("Being explicit is worth more than a permissive wildcard, because it is unambiguous to a crawler deciding whether it has permission."),
      p("Then check your firewall. If you are behind Cloudflare, the bot fight settings will block most of these regardless of what robots.txt says. Allow those user agents there too, or the file is decoration."),
      p("Allowing them is not the same as allowing scrapers. These are documented, published agents with names."),
    ],
    ask: "We find this on maybe a fifth of the sites we scan, and every one of them was invisible for a reason nobody had ever looked for.",
  },
  {
    key: "javascript",
    delay: "1 day",
    subject: "Turn JavaScript off and look",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Two minute test, and it is the one that makes people wince."),
      p("In Chrome: Settings, Privacy and security, Site settings, JavaScript, Don't allow. Then load your homepage."),
      p("Whatever is still on the screen is roughly what a lot of AI crawlers get. Many of them do not run JavaScript at all."),
      p("If your site is built on a page builder, a heavy theme, or anything React-based, there is a decent chance you are looking at a mostly empty page right now. Your prices, your service area, your phone number, all painted in after load, all invisible."),
      p("The fix depends on your stack, but the rule does not: the facts that decide whether you fit a question have to be in the HTML that arrives, not added afterwards. Server-side rendering, static pages, or at minimum the key facts hard-coded into the initial markup."),
      p("Turn it back on afterwards or the rest of the internet will annoy you."),
    ],
    ask: "If your page came back blank, nothing else in this sequence matters until that is fixed. Reply and tell me what you are built on.",
  },
  {
    key: "pricing",
    delay: "1 day",
    subject: "Publish a number, any number",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Call for a quote is the most expensive four words on most trade websites."),
      p("Not because customers hate it, though some do. Because it is a dead end for anything trying to compare options. An assistant that cannot tell whether you fit somebody's budget will recommend one that can, and you never find out you were in the running."),
      p("You do not have to publish a rate card. Any of these work:"),
      code("Starting at $X for the most common version of the job.\nMost jobs land between $X and $Y.\n$X per unit, per hour, per square foot.\nA worked example: a 3,000 sq ft single storey came to $X last month.")
      ,
      p("A band beats silence. Silence removes you from every comparison before it starts, and it is not even protecting you, because the customer is getting a number from somewhere. It is just somebody else's."),
      p("Put it on the service page, in text, not in an image or a PDF."),
    ],
    ask: "This one costs nothing and owners resist it more than anything else on the list. Worth asking yourself why.",
  },
  {
    key: "whennot",
    delay: "1 day",
    subject: "Say what you do not do",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Counterintuitive one. Naming what you will not take on makes you get recommended more, not less."),
      p("A model deciding whether to name you is doing a matching job. Every boundary you state makes the match sharper. <em>We handle commercial only, no residential. Units under 25 tons. Riverside and San Bernardino counties, we do not travel to LA.</em>"),
      p("Three sentences, and you have just told it exactly when you are the right answer and when you are not. Without them it has to guess, and guessing is where you get dropped in favour of someone who was clear."),
      p("There is a business reason too. The enquiries you lose from this are the ones you were going to turn down anyway, after two calls and a site visit."),
      p("Add it to your about page or the top of your services page. Plain sentences, no hedging."),
    ],
    ask: "Nine days in. If you have done all of these, you are already ahead of nearly everyone in your category.",
  },
  {
    key: "llmstxt",
    delay: "1 day",
    subject: "The file almost nobody has yet",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("This one is new enough that having it is still unusual. That will not last."),
      p("llms.txt is a plain markdown file at the root of your site that tells a model what you are and which pages matter. Here is a whole one:"),
      code("# Riverside Commercial HVAC\n\n&gt; Commercial rooftop HVAC replacement and repair across Riverside\n&gt; and San Bernardino counties. Units under 25 tons. Same-week\n&gt; service on most jobs.\n\n## Services\n- [Rooftop unit replacement](https://site.com/rooftop-replacement):\n  $8,000-$22,000 installed, usually within five business days.\n- [Emergency repair](https://site.com/emergency): 24 hour response\n  for existing service customers.\n\n## About\n- [Who we are](https://site.com/about): Family owned since 1998,\n  14 technicians, NATE certified.\n- [Service area](https://site.com/area): Riverside and San\n  Bernardino counties. Commercial only.\n\n## Contact\n- Phone: (555) 555-5555\n- [Get a quote](https://site.com/quote)"),
      p("Save it as llms.txt, upload it to the root so it sits at yoursite.com/llms.txt, done. Keep it to what you would tell somebody in thirty seconds."),
      p("Nobody can promise you what weight this carries yet. It costs an afternoon and the sites that get read tend to be the ones that made themselves easy to read."),
    ],
    ask: "Ten emails, ten things you can do yourself. The offer at the bottom is for when you would rather it was just done.",
  },
  {
    key: "trust",
    delay: "1 day",
    subject: "The boring pages carry more weight than you think",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("About, contact, privacy, terms. Nobody reads them and they matter more than your homepage for this."),
      p("They are how anything verifies a business is real. Missing them reads as thin, and thin reads as risky, and risky does not get recommended to somebody asking for help."),
      p("What actually helps:"),
      code("About: the real history, the actual people, how many of you\nthere are, what you are certified in. Not a mission statement.\n\nContact: a physical address and a phone number as TEXT, not\nin an image. A model cannot read a phone number in a JPEG.\n\nPrivacy and terms: they just need to exist and be linked.")
      ,
      p("The address and phone in text is the part people get wrong most. Designers love putting contact details in a graphic. It looks tidy and it is invisible."),
      p("While you are there, check they match your Google Business Profile exactly. Same suite number, same abbreviations, same phone format."),
    ],
    ask: "Consistency across those is worth more than any single one of them being perfect.",
  },
  {
    key: "consensus",
    delay: "1 day",
    subject: "It does not trust you about you",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Everything so far has been your own website. Here is the uncomfortable part: a model does not take your word for your own business."),
      p("It weighs consensus. What independent sources say about you. Directories, review platforms, industry bodies, local press, forums, other people's pages. If the internet is quiet about you, it has nothing to form an opinion from."),
      p("Silence does not read as neutral. It reads as unproven."),
      p("The unglamorous fix, in order of value:"),
      code("1. Google Business Profile: claimed, complete, categories correct.\n2. The two or three directories that actually matter in YOUR trade,\n   not the fifty generic ones.\n3. Your trade association or licensing body listing.\n4. Chamber of commerce, local business associations.\n5. Wikidata, if you can support an entry.")
      ,
      p("Same business name, same address format, same phone, everywhere. Inconsistency is worse than absence, because it makes the model less sure rather than more."),
    ],
    ask: "This is the half that takes weeks rather than an afternoon, and it is the half that decides most outcomes.",
  },
  {
    key: "checkpoint",
    delay: "1 day",
    subject: "Two weeks in. Where are you?",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Halfway. Here is everything so far, so you can see what you have actually done:"),
      code("[ ] JSON-LD block on the homepage\n[ ] sameAs array listing your profiles\n[ ] One specific sentence per top service\n[ ] At least one page written as a real customer question\n[ ] AI crawlers allowed in robots.txt and the firewall\n[ ] Checked the site with JavaScript off\n[ ] A price, a range, or a worked example published\n[ ] What you do not do, stated plainly\n[ ] llms.txt at the root\n[ ] About and contact with real details in text\n[ ] Google Business Profile claimed and consistent")
      ,
      p("If you have done six or more, you are genuinely ahead. Go back and re-run the three questions from email two and see whether anything has shifted."),
      p("If you have done none, that is also useful information, and it is the most common answer. These are all easy and none of them are urgent, which is exactly why they never get done."),
    ],
    ask: "The honest question is not whether you can do this list. It is whether you will, and when.",
  },

  /* ── Days 16-26: every other day. The ceiling of DIY starts showing. ───── */
  {
    key: "retrieval",
    delay: "2 days",
    subject: "Being known is not the same as being fetched",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("There are two ways a model can know about you and they behave completely differently."),
      p("Training is what it absorbed months ago. Slow to change, and you cannot edit it. Retrieval is what it goes and fetches mid-answer, live, when it needs current information."),
      p("Almost everything in this sequence is aimed at retrieval, because that is the half you control and the half that responds this month rather than next year."),
      p("Which means a site that is stale, thin or slow gets skipped at the moment of retrieval even when the brand is already known. Being in the training data is a start. It is not a seat you keep."),
      p("Practically: keep your key pages updated and dated, keep them fast, do not hide them behind interstitials or cookie walls that a fetcher will not get past."),
      p("Training data gets you known. Retrieval gets you named. You need both and only one of them is available to you this quarter."),
    ],
    ask: "Everything on the list so far is retrieval work. The training side is slower and it is mostly what the consensus building buys you.",
  },
  {
    key: "yourname",
    delay: "2 days",
    subject: "When your own name does not find you",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("The single most common critical failure we see, and the one owners find hardest to believe."),
      p("Search your exact business name. Not your service, your name. If your own website is not what comes back, an assistant looking you up has no way to confirm you are real, let alone recommend you."),
      p("It usually comes down to one of three things:"),
      code("1. Your name is generic. \"Foothold Systems\" competes with every\n   other Foothold. Anchor it: name plus town, name plus trade,\n   in the title tag and the H1 and the first paragraph.\n\n2. Your name is spelled differently in different places. Ltd vs\n   Limited, & vs and, with or without the LLC. Pick one and make\n   every profile match it exactly.\n\n3. Nothing links to you under that name, so there is nothing to\n   associate it with.")
      ,
      p("Fix the title tag today. It is one line and it is the highest-leverage line on your site."),
      code("&lt;title&gt;Riverside Commercial HVAC | Rooftop Unit Replacement, Riverside County&lt;/title&gt;"),
      p("Name, what you do, where. Not Home. Not Welcome."),
    ],
    ask: "Everything else on this list is downstream of this one. If your name does not resolve, nothing else gets a chance to matter.",
  },
  {
    key: "competitor",
    delay: "2 days",
    subject: "Find out who is getting your call",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Worth doing properly, once, with a notepad."),
      p("Write down the ten questions a customer would actually ask before hiring you. Real ones, in their words, not your service names. Then put each one to ChatGPT, Gemini and Perplexity and record who gets named."),
      p("You are looking for three things. Who comes up most. What the model says <em>about</em> them, in its own words. And whether the reason it gives is something you could also be true of."),
      p("That last one is the useful column. Nine times out of ten the winner is not the better operator. They are the better documented one. They published a price, they named their service area, they answered the question on a page instead of in a brochure."),
      p("Which is good news, because documentation is something you can go and change this week. Being genuinely better takes years."),
      p("Do it once a month. Same ten questions, same notepad. That series is the only real measure of whether any of this is working."),
    ],
    ask: "If you would rather not run that by hand every month, it is the thing we do for clients and it is the only number we report.",
  },
  {
    key: "ceiling",
    delay: "2 days",
    subject: "What the checklist cannot do",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Seventeen emails and I have given you the whole technical list. I want to be straight with you about what it gets you."),
      p("Everything so far is detectable. A scanner can find it, which means every competitor who runs the same scan gets the same list. Do all of it and you are level with the best prepared business in your category."),
      p("Level is a good place to be. It is not the same as being the one that gets named."),
      p("Three things decide that last part and none of them appear on a checklist."),
      p("<strong>Positioning.</strong> Not what you do, but what you should be known for. Most businesses are three things and would be recommended far more often as one. Deciding which one is judgement, and it is the highest-value hour anyone spends on this."),
      p("<strong>The language.</strong> Whether the words on your pages are the words your customers actually use when describing the problem to an assistant. Those are usually not the words the industry uses, and never the words on the average website."),
      p("<strong>The corroboration.</strong> Getting the rest of the web to agree, which is outreach and relationships and takes weeks."),
      p("You can do all three yourself. They are just slow, and they are the ones that need someone to make a call rather than follow an instruction."),
    ],
    ask: "That is the honest line between what you can do from a list and what needs a person. The offer is the second half.",
  },
  {
    key: "rewrite",
    delay: "2 days",
    subject: "What a rewritten page actually looks like",
    cta: "See the full fix",
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Since I have been saying the rewrite is the hard part, here is the before and after so it is not abstract."),
      p("Before, and this is close to verbatim from a real site:"),
      // The exclamation mark is the one in the sequence and it is deliberate.
      // This is quoted copy being held up as the thing not to write, and
      // sanding it off would blunt the example.
      code("Welcome to our website\n\nWith over 25 years of experience, we pride ourselves on quality\nworkmanship and outstanding customer service. Our team of highly\ntrained professionals is dedicated to exceeding your expectations\non every project, large or small. Contact us today for a free\nestimate!")
      ,
      p("Nothing there is false. Nothing there is usable either. Not one fact a model could match to a question."),
      p("After:"),
      code("Commercial rooftop HVAC replacement in Riverside County\n\nWe replace commercial rooftop units under 25 tons across\nRiverside and San Bernardino counties. Most replacements run\n$8,000 to $22,000 installed and take five business days from\napproval. We are commercial only and we do not travel to LA.\n\n14 technicians, NATE certified, family owned since 1998.")
      ,
      p("Same business, same truth, same length. The difference is that the second one can be matched to a question and the first one cannot."),
      p("Now do that for every page. That is the bit that takes a fortnight and the bit almost nobody finishes, because writing about yourself specifically is genuinely hard and there is always something more urgent."),
    ],
    ask: "This is the work. Doing it for you across the whole site, properly, is what the upgrade is.",
  },
  {
    key: "whatyouget",
    delay: "2 days",
    subject: `What ${UPGRADE_PRICE} actually buys`,
    cta: `Start the full fix, ${UPGRADE_PRICE}`,
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Straight answer, since I have been pointing at a button for three weeks without spelling it out."),
      p("<strong>Every technical fix on your scan, implemented.</strong> The schema, the sameAs, the crawler access, the llms.txt, the metadata, the trust pages. Everything in emails one to thirteen, done properly, on your actual site."),
      p("<strong>Your pages rewritten.</strong> Positioning decided first, then the homepage and your top service pages rewritten the way yesterday's example was. In your voice, checked with you, not generated and pasted."),
      p("<strong>The consensus work.</strong> Your listings claimed, corrected and made consistent across the directories that matter in your trade. Same name, same details, everywhere."),
      p("<strong>A monthly re-run.</strong> The same prompts, the same competitors, every month, so you can see it move. Named or not named. That is the whole scoreboard."),
      p(`${UPGRADE_PRICE}, once, not a retainer. Two to three weeks. You keep everything, including the documentation of what was changed and why, so if you never speak to me again the next person can pick it up.`),
      p("What it is not: a guarantee that ChatGPT will recommend you. Nobody controls a model's output and anybody who says otherwise is selling you something. What I control is every input it uses, and I will show you the movement month by month."),
    ],
    ask: `${UPGRADE_PRICE} against one commercial job is the calculation most people run. If one new customer a year covers it, it is not really a decision.`,
  },

  /* ── Days 31 and 38: closing. Hard ask. ────────────────────────────────── */
  {
    key: "cost",
    delay: "5 days",
    subject: "The number nobody can show you",
    cta: `Start the full fix, ${UPGRADE_PRICE}`,
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("Here is what makes this channel different from every other marketing problem you have had."),
      p("When your ads underperform, you see it. When your rankings slip, you see it. There is a number, it goes down, you react."),
      p("There is no number here. Nobody asks an assistant, gets told about your competitor, and leaves a trace on anything you own. No impression, no bounce, no line in Analytics that says lost to an AI recommendation. The lead simply never becomes a lead and your reporting looks exactly the same as last month."),
      p("It is the first channel in the history of marketing that is completely invisible to the business losing it."),
      p("Which is why the question is not what is this costing me. You cannot know that. The question is how many months of it you are willing to buy before you find out."),
      p("The businesses being recommended today are the ones being written into the consensus these models keep learning from. That compounds, and it is slow to displace once somebody else owns it. That is the whole argument for moving now rather than when it is obvious."),
    ],
    ask: `Two to three weeks of work and ${UPGRADE_PRICE}, or another quarter of not knowing. Those are genuinely the options.`,
  },
  {
    key: "last",
    delay: "7 days",
    subject: "Last one from me",
    cta: `Start the full fix, ${UPGRADE_PRICE}`,
    body: [
      p("Hi {{{FIRST_NAME}}},"),
      p("This is the last email in this sequence. Nothing more from me after today unless you ask."),
      p("You have had twenty two of these and every technical fix I know is in them. That was deliberate. If you take the list and do it yourself and never spend a penny with me, that is a completely fine outcome and you will be better off than you were five weeks ago."),
      p("If the timing is wrong, that is fine too. Start with the three that cost an afternoon: the schema block, the crawler permissions, and one page rewritten as a real customer question. Those three alone move most sites."),
      p("If it is not timing but something else, reply and tell me. Wrong fit, wrong size, too expensive, you tried it and it did not work. I would rather know, and I will take the answer without arguing."),
      p("And if you have been meaning to deal with this for five weeks and it keeps sliding down the list behind things that are shouting louder, this is the nudge. It is a fortnight of my time and you keep all of it."),
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
