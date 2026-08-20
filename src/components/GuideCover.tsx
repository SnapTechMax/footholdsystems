/**
 * The guide's front cover, redrawn as vector.
 *
 * This mirrors page 1 of the delivered PDF: same eyebrow, same headline with the
 * yellow "AI", the yellow subhead, the five prompt names with locks on the three
 * you cannot paste, and the yellow footer strip. The thing being offered on the
 * page should look like the thing that lands in the inbox.
 *
 * Drawn rather than exported as an image on purpose: it stays sharp at any size,
 * costs no extra request on a page paid traffic lands on, and picks up the site's
 * own font variables, so a font change here can't leave the cover behind. Update
 * it whenever the PDF's cover changes.
 *
 * The geometry below is measured off the printed cover and scaled to this
 * viewBox, which is why the numbers are not round. A 612x792pt page renders into
 * 340x440 at a flat 0.5556, so a measurement taken at 200dpi converts by 0.2.
 *
 * Every run of text is its own <text> element. SVG collapses whitespace around
 * nested <tspan>s, so mixing weights inside one line loses the spaces on either
 * side of the bold run. The emphasis is put on whole lines instead, which is why
 * the body copy breaks where it does rather than where the PDF breaks it.
 */

const LEVELS = [
  {
    n: "01",
    label: "Chatting",
    prompt: "The one-line ask",
    // Bar widths come off the cover as drawn. They are a designed rhythm, not a
    // scale, so they do not climb with the level number. Level 2 is the longest
    // and the only gold one because it is the prompt the guide is really selling.
    width: 50,
    gold: false,
    locked: false,
  },
  {
    n: "02",
    label: "Working together",
    prompt: "The 5-block prompt",
    width: 87.6,
    gold: true,
    locked: false,
  },
  {
    n: "03",
    label: "Building",
    prompt: "The build brief",
    width: 66.8,
    gold: false,
    locked: true,
  },
  {
    n: "04",
    label: "Chaining",
    prompt: "The chain map",
    width: 75,
    gold: false,
    locked: true,
  },
  {
    n: "05",
    label: "Running a team",
    prompt: "The team spec",
    width: 60.6,
    gold: false,
    locked: true,
  },
];

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";
const DISPLAY = "var(--font-archivo), system-ui, sans-serif";
const SERIF = "var(--font-source-serif), Georgia, serif";

const MARGIN = 34;
const RIGHT = 306;
const BAR_X = 47.4;
const BAR_H = 4.4;
const ROW_TOP = 169.6;
const ROW_STEP = 10.6;

/** The padlock beside a level you cannot paste your way into. */
function Lock({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="#85837a" strokeWidth="0.6" fill="none">
      <path d={`M${x + 0.9} ${y} v-1.1 a1.1 1.1 0 0 1 2.2 0 v1.1`} />
      <rect x={x} y={y} width="4" height="3.1" rx="0.5" fill="#85837a" stroke="none" />
    </g>
  );
}

export function GuideCover({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 340 440"
      className={className}
      role="img"
      aria-label="Cover of The 5 Levels of AI and the prompts that get you there, a nine-page guide from Foothold Systems"
    >
      <rect width="340" height="440" fill="#1b1b1b" />

      <text
        x={MARGIN}
        y="38.8"
        fill="#f6be00"
        fontFamily={MONO}
        fontSize="5"
        fontWeight="500"
        letterSpacing="1.5"
      >
        FOOTHOLD SYSTEMS &#183; AI INTEGRATION
      </text>

      <g
        fill="#f2efe6"
        fontFamily={DISPLAY}
        fontSize="31"
        fontWeight="900"
        letterSpacing="-0.5"
      >
        <text x={MARGIN} y="73.2">THE 5 LEVELS</text>
        <text x={MARGIN} y="99.8">
          OF <tspan fill="#f6be00">AI</tspan>
        </text>
      </g>

      <text
        x={MARGIN}
        y="116.8"
        fill="#f6be00"
        fontFamily={DISPLAY}
        fontSize="8.6"
        fontWeight="800"
        letterSpacing="0.15"
      >
        AND THE PROMPTS THAT GET YOU THERE.
      </text>

      <g fontFamily={SERIF} fontSize="7.5">
        <text x={MARGIN} y="132.5" fill="#cfccc2">
          Everybody says you should use AI. Nobody hands
        </text>
        <text x={MARGIN} y="142.9" fill="#cfccc2">
          you the prompts that actually work. So here they are.
        </text>
        <text x={MARGIN} y="153.3" fill="#f2efe6" fontWeight="700">
          Two you can paste today. Three we build with you.
        </text>
      </g>

      {LEVELS.map((level, i) => {
        const y = ROW_TOP + i * ROW_STEP;
        const labelX = BAR_X + level.width + 6;
        // The prompt name trails the level name at a smaller size, so its start
        // has to be measured off the level name rather than laid out by the
        // browser: SVG text has no flow.
        const promptX = labelX + level.label.length * 3.5 + 4;
        return (
          <g key={level.n}>
            <text
              x={MARGIN}
              y={y + 3.6}
              fill={level.gold ? "#f6be00" : "#7a786f"}
              fontFamily={MONO}
              fontSize="5"
            >
              {level.n}
            </text>
            <rect
              x={BAR_X}
              y={y}
              width={level.width}
              height={BAR_H}
              fill={level.gold ? "#f6be00" : "#3d3d39"}
              rx="0.8"
            />
            <text
              x={labelX}
              y={y + 3.9}
              fill={level.gold ? "#f2efe6" : "#cfccc2"}
              fontFamily={MONO}
              fontSize="5.1"
              fontWeight={level.gold ? "700" : "500"}
              letterSpacing="0.3"
            >
              {level.label.toUpperCase()}
            </text>
            <text
              x={promptX}
              y={y + 3.8}
              fill="#85837a"
              fontFamily={MONO}
              fontSize="4"
              letterSpacing="0.25"
            >
              &#183; {level.prompt.toUpperCase()}
            </text>
            {level.locked && (
              <Lock x={promptX + level.prompt.length * 2.7 + 8} y={y + 1.1} />
            )}
          </g>
        );
      })}

      <rect x="0" y="421" width="340" height="19" fill="#f6be00" />
      <text
        x={MARGIN}
        y="433"
        fill="#1b1b1b"
        fontFamily={MONO}
        fontSize="5.6"
        fontWeight="700"
        letterSpacing="0.4"
      >
        LEVELS 1&#8211;2 ARE IN HERE. LEVELS 3&#8211;5 WE BUILD WITH YOU.
      </text>
      <text
        x={RIGHT}
        y="433"
        textAnchor="end"
        fill="#1b1b1b"
        fontFamily={MONO}
        fontSize="5.2"
        letterSpacing="0.2"
      >
        footholdsystems.com
      </text>
    </svg>
  );
}
