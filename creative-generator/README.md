# FootHold creative generator

A standalone tool that writes one block of Facebook ad copy and draws three
image ads under it, at every size Meta serves.

It is **not part of the website**. It runs on your machine, reads the same
`context/*.md` files the sales page was written from, and writes PNGs to a
folder. Nothing here is deployed and nothing here has a route.

```bash
node creative-generator/server.mjs
```

Then open http://localhost:4321 and press **Generate a set**.

---

## What one click gives you

**One creative text set:**

- Primary text, with the See more fold marked where Meta actually cuts it
- Headline and description, counted against Meta's display limits
- A call-to-action button label and the reassurance line under it

**Three images, all carrying that same text:**

| # | Concept | What it is |
|---|---------|------------|
| 1 | Statement | One line at poster size. Single focal point, nothing else on the canvas. |
| 2 | Comparison | The old world against this one, in rows. Reads in two seconds. |
| 3 | Answer panel | Looks like a result rather than an ad. The mystery does the clicking. |

**Rendered at five canvases, covering 28 placements:**

| Canvas | Pixels | Covers |
|---|---|---|
| 1:1 | 1080x1080 | Feed, Marketplace, Search, Explore, Right Column, Messenger Inbox, Threads, Audience Network, carousel cards |
| 4:5 | 1080x1350 | Facebook and Instagram Feed, Profile Feed, Explore. Highest feed CTR of the five. |
| 9:16 | 1080x1920 | Stories, Reels, Explore Home, Messenger Stories, interstitials |
| 1.91:1 | 1200x628 | Right Column, Messenger Inbox, Collection covers, link previews |
| 16:9 | 1920x1080 | In-stream and desktop-weighted placements |

Meta does not want one file per placement name. It wants a handful of ratios and
crops into everything else, so five canvases is the whole surface rather than a
subset of it.

---

## How the copy is built

Twelve angles, each a complete argument taken from the live sales page. Every
line is hand-written; nothing assembles adjectives at runtime. The slots follow
the structures in [`reference/becker-swipe.md`](reference/becker-swipe.md):

- **qualifier** names who this is for and repels everyone else
- **hook** is the claim, sized to survive the 125-character truncation
- **body** is the setup, one idea per paragraph
- **hammer** is the one-line statement after it
- **headline / description** are a question or a challenge, never a suggestion

Three arrangements of those slots (qualifier open, skip the fluff, loss first)
across twelve angles gives roughly 11,600 distinct sets.

Everything derives from a single seed, printed on the page and in `copy.txt`, so
any set can be rebuilt exactly:

```bash
curl "http://localhost:4321/api/generate?seed=11207"
```

Pin the **Angle** dropdown to get several variations of one argument instead of
several arguments.

---

## The voice check

Every generated field is linted before it reaches the screen, against rules read
out of `context/voice.md` and `context/offer.md` at boot. Editing the banned
vocabulary list in `voice.md` changes what this tool refuses to ship, with no
code change here.

It fails a set for em dashes, exclamation marks, British spellings, the banned
AI vocabulary, the "not just X, it's Y" shape, any percentage or unsourced
ratio, any affiliation claim, and any tier-3 detail leaking into cold traffic.

Two rules are context-aware rather than keyword bans, because the strongest
angle in the bank needs them:

- **"guarantee"** passes when the field also negates it. *"Nobody can guarantee
  an AI will recommend you"* is the sales page's own position and the best hook
  FootHold has. *"We guarantee results"* is caught.
- **"retainer" / "monthly"** pass when negated, because `offer.md` records "not
  a retainer" as a selling point against agencies.

Numbers are allowlisted. Only 20/100 grade F, the 91/100 and 42/100 category
demonstration, the real prices and the real timelines can appear. Anything else
that looks like a statistic is refused, spelled out in digits or in words.

---

## The scroll-stop rule

Image text clears a second bar, because it does a different job. Body copy gets
read by somebody who already stopped; the big type is what makes them stop, and
a line that closes a paragraph well is the wrong tool for it.

The largest text on the statement and comparison concepts must:

1. **Read in under a second.** Eight words, forty-eight characters.
2. **Have somebody in it.** A "you" or "we", a real number, an overheard line in
   quotes, or a question. Otherwise it is a slogan about the category rather
   than an accusation aimed at the reader.
3. **Turn.** Setup then reversal, or a direct question. One flat statement is a
   label, and labels get scrolled past.
4. **Name the actor.** It has to say ChatGPT or AI. Somebody scrolling was not
   thinking about AI ten seconds ago, so "Ask it right now" reads as a riddle
   and they scroll while working out what "it" means. Google alone does not
   count: an ad naming only Google reads as an SEO ad.
5. **Name the other party.** If it means the rival, say **your competitor**.
   "ChatGPT named them" throws away the one word in the sentence the reader has
   feelings about.
6. **Not restate the copy underneath it.** Checked on shared content words, not
   just shared phrasing, so "Your homepage fits everyone, so it fits nobody" is
   caught against "It matches everyone, so it matches nobody".

Rule 6 steers rather than just complains: the generator prefers a hook that does
not collide with the hammer it happened to pick, and only falls back to a
colliding one if every hook in the angle collides, which the linter then says
on screen.

The answer panel's big type is exempt by construction: it is a real question a
buyer typed. Its caption has a rule of its own.

**The verdict line.** The caption under the panel is the ruling on what the
panel just showed, so it states what is now true rather than what happened in
one search. "It did not matter here" is an anecdote the reader can dismiss as a
fluke; "That doesn't matter anymore" is the claim the whole page rests on. Two
tells get checked: no scope-limiters ("here", "this time", "in this case") and
no past-tense reporting ("did", "was", "were", "had", "happened"). The hammers
in the copy bank are exempt, because "You did not lose. You were never entered."
is voice.md's own line and is the turn at the end of an argument, not a verdict
delivered cold.

---

## The referent rules, in the copy

The image rules stopped hooks from making the reader supply the subject. The
copy carries them too, scoped by where each field is read.

In a Facebook feed the primary text sits **above** the image, so its first line
is read before the reader has seen anything. It gets the strictest bar.

| Field | Rule |
|---|---|
| Fold line | Must name AI or ChatGPT. Nothing precedes it. |
| Primary text | Name it before you lean on it: no "it" for the actor before AI has been named. |
| Headline, description | No bare pronoun. Right column and inbox show these with no primary text above them. |
| Anywhere read cold | No "they"/"them" without a noun to point at. If it means the rival, say **your competitor**. |

Once AI is named, "it" is ordinary good writing, so the prose rule allows a
pronoun as soon as its antecedent exists rather than banning it. Across
paragraphs the third-party check is deliberately off: "Both positions were
defensible right up until they were not" is correct writing, and a rule that
cannot parse the previous sentence would flag it.

---

## Export

**Write all 15 PNGs and the copy files** produces:

```
out/2026-08-26-too-vague-seed11207/
  01-statement/      1x1.png  4x5.png  9x16.png  1-91x1.png  16x9.png
  02-comparison/     ...
  03-answer-panel/   ...
  copy.txt           the copy, formatted to paste into Ads Manager
  copy.csv           the same fields with character counts
  placements.md      which file goes to which placement
```

`out/` is gitignored. Regenerate from the seed in `copy.txt`.

---

## Notes

**Safe zones.** The 9:16 files keep everything inside the band Reels leaves
uncovered: 250px down from the top, 672px up from the bottom. Reels is greedier
than Stories, so one file is safe in both. The area below the type is not
unfinished, it is where the caption and CTA button land. Tick **Show Reels safe
zone** to see the boundary drawn on the preview.

**The answer panel is not a screenshot of anybody's product.** No logo, no
product name, no borrowed interface. `company.md` records no affiliation with
OpenAI, Google, Microsoft, Perplexity or Anthropic, and an ad that imitates one
of their windows implies otherwise. It is FootHold's own panel, and it carries
the cold-search caveat the report carries.

**The answer panel never names a business.** It says `(YOUR COMPETITOR)`,
picked out in yellow, and the reader supplies the name. A real name is somebody
else's brand in your ad; an invented one is fabricated proof; and neither is as
threatening as the business the reader has already lost work to. The linter
refuses any capitalised business name in the panel. Place names are fine.

**No API key needed.** The copy is assembled from a hand-written bank rather
than generated by a model, which is what makes the no-invented-statistics rule
enforceable rather than aspirational.
