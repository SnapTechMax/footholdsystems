/**
 * The guide's front cover, redrawn as vector.
 *
 * This mirrors page 1 of the delivered PDF — same eyebrow, same headline with
 * the yellow "AI", same level bars and tags, same yellow footer strip — so the
 * thing being offered on the page looks like the thing that lands in the inbox.
 *
 * Drawn rather than exported as an image on purpose: it stays sharp at any size,
 * costs no extra request on a page paid traffic lands on, and picks up the site's
 * own font variables, so a font change here can't leave the cover behind. Update
 * it whenever the PDF's cover changes.
 *
 * Every run of text is its own <text> element. SVG collapses whitespace around
 * nested <tspan>s, so mixing weights inside one line loses the spaces on either
 * side of the bold run — the emphasis is put on whole lines instead.
 */

const LEVELS = [
  { n: "05", label: "Running a team", tag: null, width: 0.88, gold: false },
  { n: "04", label: "Chaining", tag: null, width: 0.7, gold: false },
  { n: "03", label: "Building", tag: "The money is here", width: 0.52, gold: true },
  { n: "02", label: "Working together", tag: null, width: 0.36, gold: false },
  { n: "01", label: "Chatting", tag: "You are here", width: 0.22, gold: true },
];

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";
const DISPLAY = "var(--font-archivo), system-ui, sans-serif";
const SERIF = "var(--font-source-serif), Georgia, serif";

// Bars sit in a fixed-width column so the longest label ("Running a team")
// still clears the right margin. Matches the proportions on the printed cover.
const BAR_X = 44;
const BAR_MAX = 104;

export function GuideCover({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 340 440"
      className={className}
      role="img"
      aria-label="Cover of The 5 Levels of AI, a nine-page guide from Foothold Systems"
    >
      <rect width="340" height="440" fill="#1b1b1b" />

      <text
        x="28"
        y="42"
        fill="#f6be00"
        fontFamily={MONO}
        fontSize="7.5"
        fontWeight="500"
        letterSpacing="1.5"
      >
        FOOTHOLD SYSTEMS &#183; AI INTEGRATION
      </text>

      <g
        fill="#f2efe6"
        fontFamily={DISPLAY}
        fontSize="46"
        fontWeight="900"
        letterSpacing="-1"
      >
        <text x="26" y="112">THE 5</text>
        <text x="26" y="154">LEVELS</text>
        <text x="26" y="196">
          OF <tspan fill="#f6be00">AI</tspan>
        </text>
      </g>

      <g fontFamily={SERIF} fontSize="9.5">
        <text x="28" y="232" fill="#cfccc2">
          Everybody says you should use AI.
        </text>
        <text x="28" y="247" fill="#cfccc2">
          Nobody says what that means.
        </text>
        <text x="28" y="262" fill="#f2efe6" fontWeight="700">
          This is the plain English version.
        </text>
        <text x="28" y="277" fill="#cfccc2">
          Five levels. Find yours in ten minutes.
        </text>
      </g>

      {LEVELS.map((level, i) => {
        const y = 310 + i * 17;
        const filled = BAR_MAX * level.width;
        return (
          <g key={level.n}>
            <text
              x="28"
              y={y + 5.5}
              fill={level.gold ? "#f6be00" : "#8a887f"}
              fontFamily={MONO}
              fontSize="7"
            >
              {level.n}
            </text>
            <rect x={BAR_X} y={y} width={BAR_MAX} height="6" fill="#2c2c29" rx="1" />
            <rect
              x={BAR_X}
              y={y}
              width={filled}
              height="6"
              fill={level.gold ? "#f6be00" : "#4a4a46"}
              rx="1"
            />
            <text
              x={BAR_X + filled + 7}
              y={y + 5.5}
              fontFamily={MONO}
              fontSize="6.5"
              fontWeight="500"
              letterSpacing="0.4"
            >
              <tspan fill={level.gold ? "#f2efe6" : "#8a887f"}>
                {level.label.toUpperCase()}
              </tspan>
              {level.tag && (
                <tspan fill="#f6be00">
                  {` · ${level.tag.toUpperCase()}`}
                </tspan>
              )}
            </text>
          </g>
        );
      })}

      <rect x="0" y="400" width="340" height="40" fill="#f6be00" />
      <text
        x="28"
        y="424"
        fill="#1b1b1b"
        fontFamily={MONO}
        fontSize="7"
        fontWeight="700"
        letterSpacing="0.5"
      >
        THE MAP IS FREE. YOUR STEP TAKES ONE CALL.
      </text>
    </svg>
  );
}
