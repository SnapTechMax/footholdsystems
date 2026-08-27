/**
 * The argument bank.
 *
 * Twelve angles, each one a complete case that could carry an ad on its own.
 * Every line here is written in FootHold's voice and every claim traces back to
 * something on the sales page or in `context/offer.md`. Nothing is generated
 * from a template at runtime, because a template that assembles adjectives is
 * how you end up with "seamless AI-powered visibility solutions."
 *
 * Slot design follows Becker's structures (see reference/becker-swipe.md):
 *
 *   qualifier  the audience-splitting first line. Repels, then extracts.
 *   hook       the claim. Must land inside the 125-character See more fold.
 *   body       the setup. Short paragraphs, one idea each.
 *   hammer     the one-line bold statement after the setup.
 *   headline   40 characters, a question or a challenge, never a suggestion.
 *   descriptor 30 characters, right column and inbox only.
 *   imageHook  3 to 7 words at poster size. This is what gets read.
 *   stamp      the overline. Category label, not a sentence.
 *   proof      infographic rows. Left is the old world, right is this one.
 *   scenario   the answer-engine panel: what gets typed, what comes back.
 */

export const CTA_LABELS = [
  "Scan my site free",
  "Show me what AI says",
  "Run the free scan",
  "See who gets named",
  "Check my visibility",
];

/** The reassurance line under the button. Becker: the click buys an explanation. */
export const CTA_LINES = [
  "Takes about 60 seconds to request. No call, no card.",
  "Click and I will show you exactly what the answer engines say about you today.",
  "Free scan. No call required. You get the report whether you hire us or not.",
  "60 seconds to request. We show you who gets named instead of you.",
];

export const ANGLES = [
  {
    id: "one-answer",
    name: "One answer",
    qualifier: [
      "If your customers ask ChatGPT before they buy, read this.",
      "AI is naming one business in your category. This is for owners whose next customer is worth hundreds.",
    ],
    hook: [
      "Google handed people ten results. An assistant hands them one name.",
      "Ask ChatGPT and there is no page two. No fourth spot that still gets clicks.",
      "Someone just asked an AI who to hire in your category. It gave one name.",
    ],
    body: [
      [
        "For twenty years, being hard to find was a problem you could lose slowly. Number four still got clicks. You had time to notice.",
        "That page is going away. Someone opens a chat box, describes their problem in one sentence, and takes whatever comes back.",
      ],
      [
        "Your customers have quietly stopped Googling. They type the problem, they read the paragraph, they call the name in it.",
        "Ten links spread the work around. One recommendation does not.",
      ],
    ],
    hammer: [
      "There is one answer.",
      "If that name is your competitor, you did not come second. You were not in the conversation at all.",
      "Named or not named.",
    ],
    headline: ["One answer. One business.", "AI gives one name. Is it you?", "There is no page two"],
    descriptor: ["Free AI visibility scan", "See who gets named", "One answer. Not ten."],
    imageHook: [
      "CHATGPT GAVE ONE NAME.\nIT WASN'T YOURS.",
      "ASK CHATGPT.\nWHOSE NAME COMES BACK?",
      "GOOGLE GAVE YOU TEN.\nAI GIVES ONE NAME.",
    ],
    stamp: "When AI picks one business",
    proof: [
      ["Google returns ten links", "AI returns one recommendation"],
      ["Clicks get spread around", "One business gets the customer"],
      ["Fourth place still earns", "Second place earns nothing"],
    ],
    scenario: {
      prompt: "who's the best commercial roofer in Phoenix?",
      answer: "For commercial work in Phoenix, most people go with (YOUR COMPETITOR). They handle flat and low-slope systems and usually quote within 48 hours.",
      caption: "Your competitor. Not you.",
    },
  },

  {
    id: "invisible-loss",
    name: "The invisible loss",
    qualifier: [
      "If your leads have slid for a year with no explanation, AI is the one nobody has checked.",
      "AI search is either a real channel or a gimmick. This is for businesses that can tell the difference.",
    ],
    hook: [
      "When AI sends your lead elsewhere, you never find out. No impression. No bounce. No line in Analytics.",
      "There is no ranking report for the customers you are losing to AI.",
      "AI search is the first marketing channel that is undetectable to the business losing it.",
    ],
    body: [
      [
        "You cannot open a dashboard and see how many people asked an assistant about your category this month and got told about somebody else.",
        "No alert fires. Nothing turns red. The number just quietly stops going up.",
      ],
      [
        "When you slipped on Google you could see it. A position, a graph, a report from whoever you pay.",
        "This one leaves no trace at all. The conversation happened, a name got said, and it was not yours.",
      ],
    ],
    hammer: [
      "Silence does not read as neutral. It reads as unproven.",
      "You did not lose. You were never entered.",
      "No impression. No bounce. No idea.",
    ],
    headline: ["The loss you cannot see", "No bounce. No trace. No lead.", "Why did leads stop?"],
    descriptor: ["Find the invisible leak", "Free scan, 60 seconds", "See what AI says"],
    imageHook: [
      "AI SENT YOUR LEAD ELSEWHERE.\nNOTHING TOLD YOU.",
      "AI TOOK YOUR LEAD.\nANALYTICS WON'T SHOW IT.",
      "CHATGPT PICKED YOUR COMPETITOR.\nNO ALERT FIRED.",
    ],
    stamp: "The customers AI sent elsewhere",
    proof: [
      ["You can check your Google position", "You never see the loss"],
      ["A ranking drop shows in a report", "This shows up nowhere"],
      ["Analytics records the visit", "There was no visit to record"],
    ],
    scenario: {
      prompt: "i need an emergency plumber in dallas tonight",
      answer: "Try (YOUR COMPETITOR). They run a 24-hour callout across Dallas and list emergency rates up front.",
      caption: "This happens. Nothing records it.",
    },
  },

  {
    id: "seo-carryover",
    name: "SEO does not carry over",
    qualifier: [
      "If you have paid for SEO for years, here is the part about AI nobody has told you.",
      "Not for brand new sites. For businesses that already rank on Google and still get skipped by ChatGPT.",
    ],
    hook: [
      "Google ranks pages. ChatGPT recommends businesses. Those are not the same question.",
      "Ranking first on Google does not make ChatGPT believe you are the one to call.",
      "AI is a different game from Google. Your SEO is not worthless, it was just built for the other one.",
    ],
    body: [
      [
        "Google's entire job is to decide which URL best matches a string of words. It is a document-matching problem.",
        "A model is doing something else. It is forming an opinion about a business from everything it has ever read about that business. That is a reputation problem.",
      ],
      [
        "If you have built real rankings you are ahead of most of your competitors and there are assets here we can use.",
        "But nothing about being the best-matching page makes you the recommended business, and the second one is where the customer goes.",
      ],
    ],
    hammer: [
      "One is a document-matching problem. The other is a reputation problem.",
      "Ranking first is not the same as being the one that gets named.",
      "Your rankings did not transfer. Nobody told you because nobody measured it.",
    ],
    headline: ["Your SEO will not save you", "Ranks pages. Recommends firms.", "SEO won't carry over"],
    descriptor: ["Different game entirely", "See the gap for free", "Ranked, but not named"],
    imageHook: [
      "YOU RANK FIRST.\nCHATGPT NAMED YOUR COMPETITOR.",
      "YOUR SEO WORKED.\nCHATGPT STILL SKIPPED YOU.",
      "YOU'RE FIRST ON GOOGLE.\nINVISIBLE IN CHATGPT.",
    ],
    stamp: "Why your SEO won't save you",
    proof: [
      ["Google ranks pages", "AI recommends businesses"],
      ["Matches keywords", "Weighs consensus about you"],
      ["Rewards the best page", "Rewards the best-documented business"],
    ],
    scenario: {
      prompt: "best HVAC company for a commercial building in riverside",
      answer: "(YOUR COMPETITOR) is the one that comes up most for commercial rooftop work in that area.",
      caption: "You rank first on Google for this. That doesn't matter anymore.",
    },
  },

  {
    id: "unreadable",
    name: "It cannot read you",
    qualifier: [
      "If your website was built by somebody who is no longer involved, AI probably cannot read it.",
      "This is for businesses whose site looks fine to you and reads as blank to AI.",
    ],
    hook: [
      "Most business websites are functionally invisible to an AI crawler.",
      "The AI crawler arrived, found nothing it could quote, and left.",
      "Your site looks fine. To the AI reading it, there is almost nothing there.",
    ],
    body: [
      [
        "Content painted in by JavaScript. No structured data. Services described in slogans instead of sentences.",
        "The facts that decide whether you fit a question sit inside an image, a PDF, or nowhere at all.",
      ],
      [
        "What you do, where, for whom, how fast, how much. A model needs those as plain readable facts before it can put you in an answer.",
        "On most sites, every one of them is either a graphic or a slogan.",
      ],
    ],
    hammer: [
      "You did not lose. You were never entered.",
      "It found nothing it could quote.",
      "Invisible is not a ranking. It is an absence.",
    ],
    headline: ["Can AI even read your site?", "AI found nothing to quote", "Invisible to the crawler"],
    descriptor: ["Check readability free", "Signal 01 of 4", "60-second free scan"],
    imageHook: [
      "AI READ YOUR SITE.\nFOUND NOTHING TO QUOTE.",
      "AI CRAWLED YOUR HOMEPAGE.\nTHEN IT LEFT.",
      "LOOKS FINE TO YOU.\nBLANK TO CHATGPT.",
      "AI TRIED TO READ YOU.\nIT GAVE UP.",
    ],
    stamp: "Signal 01 · Can AI read you",
    proof: [
      ["A person sees your homepage", "A crawler sees an empty frame"],
      ["Your services are on the page", "Your services are inside an image"],
      ["Looks designed", "Reads as nothing"],
    ],
    scenario: {
      prompt: "who does same-day commercial glass repair near me",
      answer: "I could not confirm enough detail about most local providers. (YOUR COMPETITOR) lists same-day service and coverage areas directly.",
      caption: "AI cannot name a business it cannot read.",
    },
  },

  {
    id: "no-corroboration",
    name: "Nothing corroborates you",
    qualifier: [
      "This is for businesses with real reviews and real work that AI has never found.",
      "If the internet is quiet about your business, AI has nothing to go on.",
    ],
    hook: [
      "ChatGPT does not trust your website about your website.",
      "AI weighs what independent sources say about you. If those sources say nothing, it has nothing.",
      "You can claim anything on your own site. That is precisely why AI counts it for so little.",
    ],
    body: [
      [
        "Directories, review platforms, industry listings, local press, forums, citations in places you have never visited. That is what a model reads to decide whether you are real.",
        "If none of them mention you, the model is not neutral about you. It has nothing to be neutral with.",
      ],
      [
        "Your site says you are the best in the county. Every one of your competitors says the same thing on theirs.",
        "The tiebreaker is everyone else, and most businesses have never checked what everyone else is saying.",
      ],
    ],
    hammer: [
      "Silence does not read as neutral. It reads as unproven.",
      "The web's silence about you becomes the model's answer.",
      "It does not take your word for it. Nobody else is offering one.",
    ],
    headline: ["Does the web back you up?", "AI won't take your word", "Who corroborates you?"],
    descriptor: ["Signal 02 of 4", "Free visibility scan", "Check your consensus"],
    imageHook: [
      "\"IS THIS COMPANY LEGIT?\"\nCHATGPT COULDN'T SAY.",
      "AI CHECKED YOUR CLAIMS.\nNOBODY ELSE BACKS YOU.",
      "CHATGPT LOOKED YOU UP.\nFOUND SILENCE.",
    ],
    stamp: "Signal 02 · Does the web agree",
    proof: [
      ["Your site says you're the best", "So does every competitor's"],
      ["You have real reviews", "Nothing ties the reviews to you"],
      ["Silence looks neutral", "Silence reads as unproven"],
    ],
    scenario: {
      prompt: "is (YOUR BUSINESS) any good, are they legit",
      answer: "I could not find much independent information about (YOUR BUSINESS). I would suggest checking directly with the company.",
      caption: "AI won't vouch for a business nobody else vouches for.",
    },
  },

  {
    id: "too-vague",
    name: "Too vague to recommend",
    qualifier: [
      "If your homepage says quality work and customer-first approach, AI can do nothing with it.",
      "This is for specialists whose website has never told AI what they actually do.",
    ],
    hook: [
      "Quality work, customer-first approach. AI can do nothing with that.",
      "That line matches every business in your category, so AI matches it to nobody.",
      "You are specific in person and generic in writing. AI only ever reads the writing.",
    ],
    body: [
      [
        "A model cannot slot a slogan into an answer. It needs something it can match to a question.",
        "We replace commercial rooftop HVAC units under 25 tons across Riverside County, usually within five business days. That is a machine-readable trigger. The second someone describes that situation, you are the obvious answer.",
      ],
      [
        "Every business in your trade claims quality and service. That is not positioning, it is wallpaper.",
        "The businesses getting named are the ones that wrote down exactly what they do, for whom, where, and how fast.",
      ],
    ],
    hammer: [
      "Vague businesses are not disliked. They are unrecommendable.",
      "It matches everyone, so it matches nobody.",
      "You cannot be recommended for something you never said out loud.",
    ],
    headline: ["Too vague to recommend", "Slogans don't match questions", "Are you specific enough?"],
    descriptor: ["Signal 03 of 4", "Free scan, no call", "Specific beats polished"],
    imageHook: [
      "\"QUALITY WORK.\"\nAI CAN'T USE THAT.",
      "YOUR HOMEPAGE FITS EVERYONE.\nSO AI NAMES NOBODY.",
      "COULD CHATGPT TELL YOU\nFROM YOUR COMPETITOR?",
      "YOU'RE A SPECIALIST.\nAI READ A SLOGAN.",
    ],
    stamp: "Signal 03 · Specific enough to name",
    proof: [
      ["\"Quality work, done right\"", "\"Rooftop HVAC under 25 tons\""],
      ["Describes every competitor", "Describes one business"],
      ["Reads well to a person", "Matches a real question"],
    ],
    scenario: {
      prompt: "who can replace a rooftop hvac unit under 25 tons in riverside county",
      answer: "(YOUR COMPETITOR) specializes in low-tonnage rooftop replacements in that county, typically within five business days.",
      caption: "Your competitor wrote it down. You do the same work.",
    },
  },

  {
    id: "best-documented",
    name: "Best documented, not best",
    qualifier: [
      "If you are the best operator in your market and AI has never once said so, read this.",
      "This is for people who assumed AI would eventually work out who is good.",
    ],
    hook: [
      "AI is not rewarding the best operator. It is rewarding the best-documented one.",
      "AI already decided who to recommend in your category. It used whatever it could find.",
      "AI never judged your work. It judged the paperwork about your work.",
    ],
    body: [
      [
        "It already tried to work out who is best. It formed an opinion from a thin website, an unclaimed listing and a lot of silence.",
        "Whoever documented themselves properly won that, and it had very little to do with who does the better job.",
      ],
      [
        "Twenty years of doing excellent work leaves a trail in your customers' heads and almost nothing a machine can read.",
        "Your competitor with half the experience and a properly structured site is the one in the answer.",
      ],
    ],
    hammer: [
      "AI is not rewarding the best operator. It is rewarding the best-documented one.",
      "Being good is not the same as being legible.",
      "Only one of those is under your control.",
    ],
    headline: ["Best documented wins", "AI can't tell you're better", "Good, but not legible"],
    descriptor: ["Free AI visibility scan", "See what AI decided", "AI already chose"],
    imageHook: [
      "YOU'RE BETTER.\nCHATGPT PICKED YOUR COMPETITOR.",
      "YOUR COMPETITOR IS WORSE.\nAI PICKS THEM.",
      "AI NEVER SAW YOUR WORK.\nONLY YOUR PAPERWORK.",
    ],
    stamp: "AI already formed an opinion",
    proof: [
      ["Twenty years of good work", "Nothing a machine can read"],
      ["Your customers know", "The model does not"],
      ["Best operator", "Best documented"],
    ],
    scenario: {
      prompt: "most experienced landscaping company in san dimas",
      answer: "(YOUR COMPETITOR) appears most established in that area based on what is publicly documented about them.",
      caption: "AI reads the paperwork, not the work.",
    },
  },

  {
    id: "no-guarantee",
    name: "Nobody can guarantee this",
    qualifier: [
      "If someone has offered you a guaranteed top spot in ChatGPT, do not pay them until you read this.",
      "This is for people who have been sold AI hype before and can smell it now.",
    ],
    hook: [
      "Nobody can guarantee an AI will recommend you. Anyone who says they can is lying to you.",
      "No agency controls what ChatGPT says. Including this one.",
      "I am not going to promise you a spot in ChatGPT. Here is what can actually be measured.",
    ],
    body: [
      [
        "What is controllable is every input the model uses to make that decision. All four signals.",
        "And movement can be shown, with the same prompts run month after month against the same competitors. That is a measurement, not a promise.",
      ],
      [
        "If a vendor promises you a fixed position in an assistant's answer, walk away and keep your money.",
        "The scan shows you what the engines say about you today and which signal is costing you the answer. What you do with that is your call.",
      ],
    ],
    hammer: [
      "Nobody can, and anyone who tells you otherwise is either lying to you or does not understand what they are selling.",
      "Inputs are controllable. Outputs are not. Be suspicious of anyone who says different.",
      "That is a measurement, not a promise.",
    ],
    headline: ["No, I can't promise you AI", "Anyone promising this is lying", "Read this before you pay"],
    descriptor: ["No promises. A scan.", "Free, no call, no card", "Measured, not promised"],
    imageHook: [
      "SOMEBODY PROMISED YOU CHATGPT.\nTHEY LIED.",
      "SOMEONE PROMISED YOU CHATGPT?\nTHEY LIED.",
      "I CAN'T PROMISE YOU CHATGPT.\nNOBODY CAN.",
    ],
    stamp: "The uncomfortable version",
    proof: [
      ["\"Guaranteed #1 in ChatGPT\"", "Not a thing anyone can sell"],
      ["Controls the output", "Nobody does"],
      ["Controls the inputs", "That part is real work"],
    ],
    scenario: {
      prompt: "can an agency guarantee my business shows up in chatgpt",
      answer: "No. Model outputs are not controllable by third parties. Be cautious with anyone offering a guaranteed placement.",
      caption: "Ask AI whether anyone can guarantee this. Nobody can.",
    },
  },

  {
    id: "own-medicine",
    name: "We scanned ourselves first",
    qualifier: [
      "Before pointing an AI scan at anyone else, it seemed honest to run it on ourselves.",
      "This is for people who want to watch an AI tool fail before they trust it.",
    ],
    hook: [
      "I ran our AI visibility scan on my own site first. Twenty out of a hundred. Grade F.",
      "The first site our AI scan ever failed was mine.",
      "Twenty out of a hundred for AI visibility, grade F, on the site of the company selling the fix.",
    ],
    body: [
      [
        "It seemed like the honest thing to do before pointing it at anyone else.",
        "The report was right. Every finding was real, and most of it took an afternoon to fix.",
      ],
      [
        "The scan does not flatter anybody, including the person who built it.",
        "You get the same report, on your own site, for free. Whether you hire us afterwards is a separate question.",
      ],
    ],
    hammer: [
      "Twenty out of a hundred. Grade F.",
      "It does not flatter anybody, including me.",
      "Run it on yours and see what falls out.",
    ],
    headline: ["We scored 20/100. Grade F.", "The tool failed us first", "Our own score: grade F"],
    descriptor: ["Run the AI scan on yours", "Free, no call, no card", "The AI scan doesn't flatter"],
    imageHook: [
      "OUR AI SCORE? 20/100.\nGRADE F.",
      "WE SELL AI VISIBILITY.\nWE SCORED 20/100.",
      "AI GAVE US GRADE F.\nWE SELL THIS.",
    ],
    stamp: "Scanned ourselves first",
    proof: [
      ["Our own site, footholdsystems.com", "20/100 · grade F"],
      ["A party rental co, scored local", "91/100 · grade B"],
      ["The same site, scored as SaaS", "42/100 · grade D"],
    ],
    scenario: {
      prompt: "who should i hire for answer engine optimization",
      answer: "There are few established specialists in this yet. Most SEO agencies have added it recently as a service line.",
      caption: "We fixed our own site before selling this.",
    },
  },

  {
    id: "too-early",
    name: "Isn't it too early",
    qualifier: [
      "If your instinct is that AI search is three years away, that instinct has been wrong twice before.",
      "This is for people who would rather move on AI while the category is empty.",
    ],
    hook: [
      "We do not really need a website sounded reasonable in 1999. We do not really need AI sounds the same now.",
      "Early is not a small edge with AI. It compounds, and it is slow to displace.",
      "The businesses AI recommends today are the ones being written into what it keeps learning from.",
    ],
    body: [
      [
        "Same instinct that made not paying Google for clicks sound sensible in 2005. Both positions were defensible right up until they were not.",
        "The difference this time is that the lead compounds. Consensus is sticky, and once somebody else owns the answer in your category it is expensive to take back.",
      ],
      [
        "Local categories are the emptiest they will ever be. Almost nobody in your trade has done any of this.",
        "That will not be true for long, and the people who move first are the ones the models learn from.",
      ],
    ],
    hammer: [
      "Level is a good place to be. It is not the same as being the one that gets named.",
      "Early compounds. Late is expensive.",
      "Your category is empty right now. That is the whole opportunity.",
    ],
    headline: ["Too early? So was 1999.", "Your category is still empty", "Early compounds here"],
    descriptor: ["Get in before AI settles", "Free scan, 60 seconds", "See your category"],
    imageHook: [
      "\"AI IS A FAD.\"\nSO WAS THE INTERNET.",
      "IS ANYONE IN YOUR TRADE\nDOING AI YET?",
      "AI HASN'T PICKED YOUR TRADE.\nNOT YET.",
      "YOU CAN WAIT.\nAI WON'T.",
    ],
    stamp: "On being early",
    proof: [
      ["\"We don't need a website\" · 1999", "Survivable for three years"],
      ["\"We won't pay for clicks\" · 2005", "Survivable for three years"],
      ["\"AI search is hype\" · today", "You already know this one"],
    ],
    scenario: {
      prompt: "who should i hire to fix my restaurant's walk-in cooler in san dimas",
      answer: "Based on what I can find, (YOUR COMPETITOR) handles commercial walk-in repair in San Dimas.",
      caption: "One name. Today. Not in three years.",
    },
  },

  {
    id: "second-domain",
    name: "The second domain",
    qualifier: [
      "This is for businesses with a site they like that AI still cannot read.",
      "If somebody has told you the AI fix is a redesign, this is a different argument.",
    ],
    hook: [
      "Your website has a job already: sell to people and carry your brand. Both of those fight being readable to AI.",
      "We build you a second site, on its own domain, whose only audience is AI.",
      "Fixing an existing site is a compromise between people and AI. A second domain answers to one audience.",
    ],
    body: [
      [
        "It does not have to look like anything. It has to be findable and unambiguous, structured the way models want, saying what they need in order to recommend you.",
        "Your main site keeps doing what it does. You keep both domains and a written record of everything that changed.",
      ],
      [
        "Every design decision that makes a site persuasive to a person makes it slightly harder for a machine to read. That is the compromise nobody talks about.",
        "So we stop compromising. One site for people, one for the machines deciding who gets named.",
      ],
    ],
    hammer: [
      "One site for people. One for the machines that decide who gets named.",
      "It does not have to look like anything. It has to be unambiguous.",
      "Nobody else is building this.",
    ],
    headline: ["A second site, for machines", "Two audiences. Two sites.", "Stop compromising the site"],
    descriptor: ["You keep both domains", "One-off, not a retainer", "Built for machines only"],
    imageHook: [
      "WE BUILD YOU A SECOND SITE.\nFOR AI.",
      "YOUR SITE IS FOR PEOPLE.\nOURS FOR AI.",
      "CAN YOUR HOMEPAGE SELL\nTO PEOPLE AND AI?",
      "YOUR HOMEPAGE HAS A JOB.\nAI ISN'T IT.",
    ],
    stamp: "What we actually build",
    proof: [
      ["Your site sells to people", "The second one sells to models"],
      ["Brand, design, persuasion", "Structure, facts, no compromise"],
      ["You keep it", "Both domains, plus the record"],
    ],
    scenario: {
      prompt: "what makes a website easy for an AI to recommend",
      answer: "Plain readable facts, structured data, specific service descriptions, and corroboration from independent sources.",
      caption: "Your homepage cannot do this. A second site can.",
    },
  },

  {
    id: "competitor-named",
    name: "AI named your competitor",
    qualifier: [
      "If you have wondered where your competitor's new customers come from, AI is one answer.",
      "This is for owners who would rather know what AI says about them than not know.",
    ],
    hook: [
      "Somebody asked an assistant who to hire in your category this week. It named a business. Probably not yours.",
      "Ask ChatGPT yourself, in a fresh window, with no login. See whose name comes back.",
      "Your competitor is not outspending you. They are just easier for AI to read.",
    ],
    body: [
      [
        "Try it in a browser you are not signed into. No history, no location, no personalization. That is the search a stranger runs.",
        "Whatever name comes back is the business getting the call you did not know existed.",
      ],
      [
        "This is not about who does better work. It is about which of you a machine can describe confidently enough to recommend.",
        "The scan runs the questions your buyers actually type and records who gets named, how often, and where you get dropped.",
      ],
    ],
    hammer: [
      "If that name is your competitor, you did not come second. You were not in the conversation at all.",
      "Named or not named.",
      "Your competitor is not outspending you. They are just easier for AI to read.",
    ],
    headline: ["Whose name comes back?", "AI named your competitor", "Ask AI. See who it names."],
    descriptor: ["We run the real prompts", "Free, no call, no card", "See who gets named"],
    imageHook: [
      "ASK CHATGPT RIGHT NOW.\nWHOSE NAME COMES BACK?",
      "AI GAVE YOUR COMPETITOR THE LEAD.\nNOT YOU.",
      "CHATGPT NAMED YOUR COMPETITOR.\nNOT YOU.",
      "YOUR COMPETITOR GOT THE CUSTOMER.\nAI SENT THEM.",
    ],
    stamp: "Ask AI yourself",
    proof: [
      ["You asked in your own browser", "You saw yourself first"],
      ["A stranger asks cold", "They see your competitor"],
      ["Both results are real", "Only one is the one AI sees"],
    ],
    scenario: {
      prompt: "best commercial cleaning company in the inland empire",
      answer: "(YOUR COMPETITOR) comes up most consistently for commercial contracts in that region.",
      caption: "Your competitor gets this call. You get nothing.",
    },
  },
];

export const ANGLE_IDS = ANGLES.map((a) => a.id);
