/**
 * Canvas renderer for the three ad concepts.
 *
 * One drawing path serves the preview and the export, so what you approve on
 * screen is byte-identical to the PNG that gets uploaded. Every size is drawn
 * from scratch at its native resolution rather than scaled from a master,
 * because a 1.91:1 banner is not a cropped square and typography that was set
 * for 1080x1080 falls apart at 1200x628.
 */

export const PALETTE = {
  ink: "#08080a",
  bg: "#0e0e11",
  panel: "#15151a",
  panel2: "#1c1c22",
  line: "#2a2a33",
  text: "#f5f3ee",
  muted: "#a5a29a",
  dim: "#8a877f",
  accent: "#f6be00",
  accentHot: "#ffd23d",
  danger: "#ff4d3d",
};

const DISPLAY = "Archivo, ui-sans-serif, system-ui, sans-serif";
const SANS = "Inter, ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/* ------------------------------------------------------------- PRIMITIVES -- */

function font(ctx, { size, weight = 400, family = SANS, tracking = 0 }) {
  ctx.font = `${weight} ${Math.round(size)}px ${family}`;
  // letterSpacing is a canvas2d property, not part of the font shorthand, and
  // has to be reset every time or it leaks into the next draw call.
  ctx.letterSpacing = `${(tracking * size).toFixed(2)}px`;
}

/** Greedy wrap. Respects hard breaks already present in the string. */
function wrap(ctx, text, maxWidth) {
  const out = [];
  for (const paragraph of String(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) line = next;
      else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Largest size at which the text still fits the box.
 *
 * Scans downward from the ceiling and takes the first size that fits, rather
 * than binary searching. The predicate is not monotonic in size: greedy
 * wrapping means a slightly larger type can break a line *earlier* and produce
 * a tidier result than a smaller one, so there are bands of sizes that fail
 * sitting above bands that pass. A binary search reads one failing probe as
 * "everything above here fails" and silently settles two thirds of the way
 * down. That cost a Stories headline about sixty points before anyone noticed.
 *
 * The scan starts at the cap and usually lands within a few dozen steps, and
 * this runs fifteen times on a button press.
 */
function fit(ctx, text, spec, maxWidth, maxHeight, { max, min = 12, lineHeight = 1.2, maxLines = 99, noOrphans = false }) {
  let fallback = null;

  for (let size = Math.floor(max); size >= min; size--) {
    font(ctx, { ...spec, size });
    const lines = wrap(ctx, text, maxWidth);
    const height = lines.length * size * lineHeight;
    // wrap() keeps an over-wide word rather than dropping it, so the widest
    // line has to be measured directly. Height alone lets a single long word
    // run off the edge of the canvas.
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length > maxLines || height > maxHeight || widest > maxWidth) continue;

    // A last line holding one short word reads as a mistake at poster size.
    // Worth dropping a few points to avoid, but not worth failing over.
    const last = lines[lines.length - 1] ?? "";
    const orphan = noOrphans && lines.length > 1 && last.split(" ").length === 1 && last.length <= 4;
    if (orphan) {
      if (!fallback) fallback = { size, lines };
      continue;
    }

    font(ctx, { ...spec, size });
    return { size, lines };
  }

  if (fallback) {
    font(ctx, { ...spec, size: fallback.size });
    return fallback;
  }

  font(ctx, { ...spec, size: min });
  return { size: min, lines: wrap(ctx, text, maxWidth) };
}

/** Draw wrapped lines from a top edge. Returns the y after the block. */
function drawLines(ctx, lines, x, y, size, lineHeight, color) {
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  let cursor = y + size;
  for (const line of lines) {
    ctx.fillText(line, x, cursor);
    cursor += size * lineHeight;
  }
  return cursor - size * lineHeight + size * 0.28;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The content box, inset from the safe zone rather than from the canvas edge. */
function box(canvas) {
  const top = canvas.safeZone ? canvas.safeZone.top : 0;
  const bottom = canvas.safeZone ? canvas.height - canvas.safeZone.bottom : canvas.height;
  const pad = Math.round(Math.min(canvas.width, bottom - top) * 0.085);
  return { x: pad, y: top + pad, w: canvas.width - pad * 2, h: bottom - top - pad * 2, pad };
}

const unit = (b) => Math.sqrt(b.w * b.h) / 900;

/* ---------------------------------------------------------------- CHROME -- */

/**
 * Vertical gradient across the whole canvas, not a flat fill.
 *
 * On 9:16 the type has to stay inside a safe band that ends two thirds of the
 * way down, which leaves a large area under it. Flat black reads as an
 * unfinished file; a gradient reads as the space Reels was always going to
 * cover with its own chrome.
 */
function ground(ctx, canvas, color) {
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, color === PALETTE.ink ? "#0b0b0e" : "#121216");
  g.addColorStop(0.55, color);
  g.addColorStop(1, PALETTE.ink);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/** The single soft light source from the sales page hero. One focal point. */
function glow(ctx, canvas, cx, cy, radius) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, "rgba(246,190,0,0.16)");
  g.addColorStop(0.65, "rgba(246,190,0,0.03)");
  g.addColorStop(1, "rgba(246,190,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function stamp(ctx, text, b, u) {
  const size = Math.max(11, 13 * u);
  font(ctx, { size, weight: 700, family: MONO, tracking: 0.2 });
  ctx.fillStyle = PALETTE.accent;
  ctx.textBaseline = "alphabetic";
  const line = String(text).toUpperCase();
  const clipped = ctx.measureText(line).width > b.w ? wrap(ctx, line, b.w)[0] : line;
  ctx.fillText(clipped, b.x, b.y + size);
  return b.y + size * 2.1;
}

/** Wordmark bottom left, domain bottom right. Sits on the box floor. */
function footer(ctx, b, u, { chip } = {}) {
  const size = Math.max(13, 17 * u);
  const baseline = b.y + b.h;
  font(ctx, { size, weight: 900, family: DISPLAY, tracking: -0.01 });
  ctx.fillStyle = PALETTE.text;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("FOOTHOLD", b.x, baseline);
  const w = ctx.measureText("FOOTHOLD").width;
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText(" AEO", b.x + w, baseline);

  if (chip) {
    const cs = Math.max(11, 13 * u);
    font(ctx, { size: cs, weight: 700, family: MONO, tracking: 0.06 });
    const label = chip.toUpperCase();
    const tw = ctx.measureText(label).width;
    const px = cs * 1.1;
    const py = cs * 0.72;
    const cw = tw + px * 2;
    const ch = cs + py * 2;
    ctx.fillStyle = PALETTE.accent;
    roundRect(ctx, b.x + b.w - cw, baseline - ch + cs * 0.28, cw, ch, ch / 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(label, b.x + b.w - cw + px, baseline);
  } else {
    const ds = Math.max(11, 13 * u);
    font(ctx, { size: ds, weight: 500, family: MONO, tracking: 0.06 });
    ctx.fillStyle = PALETTE.dim;
    const d = "footholdsystems.com";
    ctx.fillText(d, b.x + b.w - ctx.measureText(d).width, baseline);
  }
  return baseline - Math.max(13, 17 * u) * 2.4;
}

/* -------------------------------------------------------------- CONCEPTS -- */

/**
 * 1. Statement. One idea at poster size and nothing competing with it.
 * Becker's rule about a single focal point, applied to type instead of a photo.
 */
function drawStatement(ctx, canvas, concept) {
  const b = box(canvas);
  const u = unit(b);
  ground(ctx, canvas, PALETTE.ink);
  glow(ctx, canvas, canvas.width * 0.5, b.y + b.h * 0.12, Math.max(canvas.width, canvas.height) * 0.62);

  const top = stamp(ctx, concept.stamp, b, u);
  const floor = footer(ctx, b, u);

  // Reserve the subline first, then give everything left to the headline. The
  // headline is what gets read at thumb speed, so it takes the surplus.
  const subSpec = { weight: 600, family: SANS, tracking: -0.005 };
  const subFit = fit(ctx, concept.subline, subSpec, b.w, (floor - top) * 0.34, {
    max: 34 * u,
    lineHeight: 1.34,
    maxLines: 4,
  });
  const subHeight = subFit.lines.length * subFit.size * 1.34;

  /**
   * Set the hook as large as the canvas allows.
   *
   * The authored line breaks mark the beats of the line, but honouring them
   * literally caps the type at whatever the longest beat will fit, and an
   * eight-word hook set to two lines comes out small with a hole under it.
   * So the wrap is tried at several line counts and the one that yields the
   * biggest type wins. Poster size is the whole point of this concept; the
   * orphan guard is what makes the extra breaks safe to take.
   */
  const headSpec = { weight: 900, family: DISPLAY, tracking: -0.03 };
  const headline = concept.headline.toUpperCase();
  const authored = headline.split("\n").length;

  // Two ceilings. The first leaves room for the subline plus a descender
  // allowance, which the fitter cannot know about before it picks a size. The
  // second stops the hook eating the whole frame: a headline with nothing
  // breathing under it reads as a mistake rather than as emphasis.
  const headRoom = Math.min(floor - top - subHeight - 60 * u, (floor - top) * 0.68);

  // The authored breaks stay in. wrap() treats them as hard breaks and wraps
  // within each beat, so a generous line budget lets the type grow without
  // ever letting a sentence boundary land mid-line.
  const headFit = fit(ctx, headline, headSpec, b.w, headRoom, {
    max: 190 * u,
    lineHeight: 0.94,
    maxLines: authored + 4,
    noOrphans: true,
  });

  const headHeight = headFit.lines.length * headFit.size * 0.94;
  const blockTop = top + Math.max(0, (floor - top - headHeight - subHeight - 34 * u) * 0.5);

  const after = drawLines(ctx, headFit.lines, b.x, blockTop, headFit.size, 0.94, PALETTE.text);

  // Hard floor on the subline. drawLines returns a baseline that already
  // includes a descender kick proportional to the type size, so at poster
  // sizes the subline could otherwise be pushed down into the wordmark.
  const subTop = Math.min(after + 40 * u, floor - subHeight);

  // Accent rule between hook and subline. Keeps the two blocks from reading as
  // one paragraph at small sizes.
  ctx.fillStyle = PALETTE.accent;
  ctx.fillRect(b.x, subTop - 18 * u, Math.min(b.w * 0.22, 150 * u), Math.max(3, 4 * u));

  font(ctx, { ...subSpec, size: subFit.size });
  drawLines(ctx, subFit.lines, b.x, subTop, subFit.size, 1.34, PALETTE.muted);
}

/**
 * 2. Comparison. The old world against this one, in rows.
 * Reads in about two seconds, which is the entire budget a feed ad gets.
 */
function drawComparison(ctx, canvas, concept) {
  const b = box(canvas);
  const u = unit(b);
  ground(ctx, canvas, PALETTE.bg);
  glow(ctx, canvas, canvas.width * 0.5, b.y + b.h * 0.18, Math.max(canvas.width, canvas.height) * 0.55);

  const top = stamp(ctx, concept.stamp, b, u);
  const floor = footer(ctx, b, u, { chip: "Free scan" });

  const headSpec = { weight: 900, family: DISPLAY, tracking: -0.028 };
  const headFit = fit(ctx, concept.headline.toUpperCase(), headSpec, b.w, (floor - top) * 0.3, {
    max: 78 * u,
    lineHeight: 0.96,
    maxLines: 3,
  });
  let y = drawLines(ctx, headFit.lines, b.x, top, headFit.size, 0.96, PALETTE.text);
  y += 30 * u;

  const hammerSpec = { weight: 800, family: DISPLAY, tracking: -0.01 };
  const hammerFit = fit(ctx, concept.subline, hammerSpec, b.w, (floor - y) * 0.26, {
    max: 40 * u,
    lineHeight: 1.16,
    maxLines: 3,
  });
  const hammerHeight = hammerFit.lines.length * hammerFit.size * 1.16;

  const rows = concept.rows;
  const rowsTop = y;
  const rowsBottom = floor - hammerHeight - 40 * u;
  const rowH = (rowsBottom - rowsTop) / rows.length;

  const gutter = 26 * u;
  const colW = (b.w - gutter) / 2;
  const markSize = Math.max(13, 17 * u);
  const cellSpec = { weight: 600, family: SANS, tracking: -0.005 };

  rows.forEach(([left, right], i) => {
    const ry = rowsTop + rowH * i;

    if (i > 0) {
      ctx.fillStyle = PALETTE.line;
      ctx.fillRect(b.x, ry, b.w, 1);
    }

    const cellH = rowH * 0.74;

    const draw = (text, x, mark, markColor, textColor) => {
      const inset = markSize * 1.7;
      const f = fit(ctx, text, cellSpec, colW - inset, cellH, {
        max: 27 * u,
        lineHeight: 1.26,
        maxLines: 4,
      });
      const blockH = f.lines.length * f.size * 1.26;
      const top = ry + (rowH - blockH) / 2;

      font(ctx, { size: markSize, weight: 700, family: MONO, tracking: 0 });
      ctx.fillStyle = markColor;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(mark, x, top + f.size);

      font(ctx, { ...cellSpec, size: f.size });
      drawLines(ctx, f.lines, x + inset, top, f.size, 1.26, textColor);
    };

    draw(left, b.x, "✕", PALETTE.danger, PALETTE.dim);
    draw(right, b.x + colW + gutter, "✓", PALETTE.accent, PALETTE.text);
  });

  ctx.fillStyle = PALETTE.line;
  ctx.fillRect(b.x + colW + gutter / 2, rowsTop, 1, rowsBottom - rowsTop);

  font(ctx, { ...hammerSpec, size: hammerFit.size });
  drawLines(ctx, hammerFit.lines, b.x, rowsBottom + 26 * u, hammerFit.size, 1.16, PALETTE.accent);
}

/**
 * 3. Answer panel. Looks like a result rather than an advert.
 *
 * Deliberately not a copy of any assistant's interface: no logo, no product
 * name, no borrowed chrome. `company.md` records no affiliation with OpenAI,
 * Google, Microsoft, Perplexity or Anthropic, and an ad that mimics one of
 * their windows implies otherwise. It is FootHold's own panel, labelled for
 * what it is, and it carries the cold-search caveat the report carries.
 *
 * The business in the answer is never named either. It is "(YOUR COMPETITOR)",
 * drawn in the accent colour, and the reader supplies the name. A real name is
 * somebody else's brand in your ad; an invented one is fabricated proof; and
 * neither is as threatening as the name the reader already has in mind.
 */
function drawAnswerPanel(ctx, canvas, concept) {
  const b = box(canvas);
  const u = unit(b);
  ground(ctx, canvas, PALETTE.bg);
  glow(ctx, canvas, canvas.width * 0.5, b.y + b.h * 0.25, Math.max(canvas.width, canvas.height) * 0.5);

  const top = stamp(ctx, concept.stamp, b, u);
  const floor = footer(ctx, b, u, { chip: "Free scan" });

  const capSpec = { weight: 800, family: DISPLAY, tracking: -0.012 };
  const capFit = fit(ctx, concept.caption, capSpec, b.w, (floor - top) * 0.26, {
    max: 44 * u,
    lineHeight: 1.14,
    maxLines: 3,
  });
  const capHeight = capFit.lines.length * capFit.size * 1.14;

  const available = floor - top;
  const radius = 22 * u;
  const inset = 34 * u;
  const innerW = b.w - inset * 2;
  const labelSize = Math.max(10, 12 * u);
  const promptSpec = { weight: 600, family: SANS, tracking: -0.005 };
  const answerSpec = { weight: 400, family: SANS, tracking: 0 };

  /**
   * Measure the panel at a given type scale.
   *
   * The card wraps its content rather than filling the canvas, so a two-line
   * answer gets a two-line card. Scale is walked down until the whole thing
   * fits the space left over after the caption, which is what keeps a long
   * answer on a 1.91:1 banner from running past the bottom edge.
   */
  const layout = (scale) => {
    const promptFit = fit(ctx, concept.prompt, promptSpec, innerW - 26 * u, available, {
      max: 34 * u * scale,
      lineHeight: 1.28,
      maxLines: 3,
    });
    const answerFit = fit(ctx, concept.answer, answerSpec, innerW, available, {
      max: 30 * u * scale,
      lineHeight: 1.44,
      maxLines: 9,
    });
    const promptH = promptFit.lines.length * promptFit.size * 1.28;
    const answerH = answerFit.lines.length * answerFit.size * 1.44;
    const cardH = inset * 2 + labelSize * 2.4 + promptH + 26 * u + 1 + 28 * u + answerH;
    return { promptFit, answerFit, promptH, cardH };
  };

  const roomForCard = available - capHeight - 34 * u;
  let L = layout(1);
  for (let scale = 0.94; L.cardH > roomForCard && scale > 0.4; scale -= 0.06) L = layout(scale);

  const stackH = L.cardH + 26 * u + capHeight;
  const cardTop = top + Math.max(0, (available - stackH) * 0.4);
  const cardBottom = cardTop + L.cardH;

  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, b.x, cardTop, b.w, L.cardH, radius);
  ctx.fill();
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = Math.max(1, 1.5 * u);
  roundRect(ctx, b.x, cardTop, b.w, L.cardH, radius);
  ctx.stroke();

  let y = cardTop + inset;

  // Label. Names the surface without borrowing anyone's brand.
  font(ctx, { size: labelSize, weight: 700, family: MONO, tracking: 0.18 });
  ctx.fillStyle = PALETTE.dim;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("AI ASSISTANT", b.x + inset, y + labelSize);
  y += labelSize * 2.4;

  // The question, as typed. Lowercase on purpose: that is how people type.
  ctx.fillStyle = PALETTE.accent;
  ctx.fillRect(b.x + inset, y + L.promptFit.size * 0.18, Math.max(2, 3 * u), L.promptH);
  font(ctx, { ...promptSpec, size: L.promptFit.size });
  drawHighlighted(ctx, L.promptFit.lines, b.x + inset + 20 * u, y, L.promptFit.size, 1.28, PALETTE.text);
  y += L.promptH;

  y += 26 * u;
  ctx.fillStyle = PALETTE.line;
  ctx.fillRect(b.x + inset, y, innerW, 1);
  y += 28 * u;

  // The answer, with the placeholder picked out in the accent colour. It is
  // never a business name, real or invented: see the note in drawAnswerPanel.
  font(ctx, { ...answerSpec, size: L.answerFit.size });
  drawHighlighted(ctx, L.answerFit.lines, b.x + inset, y, L.answerFit.size, 1.44, PALETTE.muted);

  font(ctx, { ...capSpec, size: capFit.size });
  drawLines(ctx, capFit.lines, b.x, cardBottom + 26 * u, capFit.size, 1.14, PALETTE.accent);
}

/**
 * Draw wrapped lines, painting the placeholder token in the accent colour.
 *
 * Coloured word by word rather than by searching each line for the whole
 * token, because "(YOUR COMPETITOR)" is two words and the wrapper is free to
 * break between them. A whole-token search finds nothing on either line and
 * silently drops the highlight on exactly the phrase the ad is built around.
 */
const PLACEHOLDER_WORD = /^\(?(?:YOUR|COMPETITOR\)?|BUSINESS\)?)[.,?]?$/;

function drawHighlighted(ctx, lines, x, y, size, lineHeight, baseColor) {
  ctx.textBaseline = "alphabetic";
  let cursor = y + size;
  for (const line of lines) {
    const words = line.split(" ");
    let dx = x;
    words.forEach((word, i) => {
      const run = i < words.length - 1 ? `${word} ` : word;
      ctx.fillStyle = PLACEHOLDER_WORD.test(word) ? PALETTE.accent : baseColor;
      ctx.fillText(run, dx, cursor);
      dx += ctx.measureText(run).width;
    });
    cursor += size * lineHeight;
  }
}

/* ----------------------------------------------------------------- ENTRY -- */

const DRAW = {
  statement: drawStatement,
  infographic: drawComparison,
  "answer-panel": drawAnswerPanel,
};

/** Render one concept at one canvas size into a fresh, correctly sized canvas. */
export function renderAd(concept, canvasSpec, { safeZoneOverlay = false } = {}) {
  const el = document.createElement("canvas");
  el.width = canvasSpec.width;
  el.height = canvasSpec.height;
  const ctx = el.getContext("2d");
  ctx.textRendering = "optimizeLegibility";

  (DRAW[concept.id] ?? drawStatement)(ctx, canvasSpec, concept);

  if (safeZoneOverlay && canvasSpec.safeZone) {
    ctx.fillStyle = "rgba(255,77,61,0.16)";
    ctx.fillRect(0, 0, canvasSpec.width, canvasSpec.safeZone.top);
    ctx.fillRect(0, canvasSpec.height - canvasSpec.safeZone.bottom, canvasSpec.width, canvasSpec.safeZone.bottom);
    ctx.strokeStyle = PALETTE.danger;
    ctx.setLineDash([12, 10]);
    ctx.lineWidth = 3;
    ctx.strokeRect(0, canvasSpec.safeZone.top, canvasSpec.width, canvasSpec.height - canvasSpec.safeZone.bottom - canvasSpec.safeZone.top);
    ctx.setLineDash([]);
  }
  return el;
}

/** Weights the canvas needs before the first draw, or it silently falls back. */
export async function ensureFonts() {
  const needed = [
    "900 100px Archivo", "800 40px Archivo",
    "600 40px Inter", "400 40px Inter",
    "700 20px 'JetBrains Mono'", "500 20px 'JetBrains Mono'",
  ];
  await Promise.all(needed.map((f) => document.fonts.load(f).catch(() => {})));
  await document.fonts.ready;
}
