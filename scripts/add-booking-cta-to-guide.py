#!/usr/bin/env python3
"""
RETIRED. Stamped a booking CTA onto the lead-magnet PDF for the /guide funnel,
which is gone: /guide 404s, the form component was deleted, and the pre-sale
call this pointed at no longer exists. Kept for reference only. It reads
CALENDLY_URL out of lib/site.ts, which is why it will now fail if run.
"""

"""Reconcile the exported guide PDF with the website.

The guide is designed and exported elsewhere. This script applies afterwards
everything the export cannot know about, so the PDF in public/downloads always
agrees with the site. Rerun it whenever the guide is re-exported:

    python3 scripts/add-booking-cta-to-guide.py <exported.pdf>

It writes public/downloads/Foothold-The-5-Levels-of-AI-and-The-Prompts.pdf.

Three things happen: a "Book a call" button is stamped on the last page, the
phone number is replaced with the current one from src/lib/site.ts, and the copy
edits in COPY_REPLACEMENTS below are applied to the body text.

The button lands in the empty right-hand side of the yellow CTA block on the last
page, mirroring the dark-on-yellow button the website uses.

The booking URL is deliberately NOT printed as visible text. The Calendly account
is still under the username "max-snaptechrepair", so spelling the URL out would
put SnapTech branding in the body of a Foothold lead magnet. Readers of a printed
copy get there via footholdsystems.com, which the page already shows. If the
Calendly link is ever renamed to something Foothold-branded, printing it becomes
worthwhile — see BOOKING.md.

It also replaces the phone number on the last page. Whatever number the export
carries is deleted from the content stream — a real removal, not a box drawn over
the top, so the old number cannot be selected, copied or searched — and the current
one from src/lib/site.ts is drawn in its place. That means the published PDF always
shows the right number even when the design source is out of date.

Note the number is published here and in the delivery email, both of which reach
people who opted in, but deliberately not on the public website.

Requires: pypdf, reportlab, pdfplumber
"""

from __future__ import annotations

import io
import logging
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import pdfplumber
from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Link
from pypdf.generic import ArrayObject, DecodedStreamObject, NameObject, NumberObject
from reportlab.lib.colors import Color
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

# pdfminer, under pdfplumber, warns about missing FontBBox on every subsetted font
# in this PDF. Harmless, and it drowns out this script's own output.
logging.getLogger("pdfminer").setLevel(logging.ERROR)

REPO = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = REPO / "public" / "downloads" / "Foothold-The-5-Levels-of-AI-and-The-Prompts.pdf"
OUTPUT = REPO / "public" / "downloads" / "Foothold-The-5-Levels-of-AI-and-The-Prompts.pdf"

SITE_TS = REPO / "src" / "lib" / "site.ts"


def site_constant(name: str) -> str:
    """Read an exported string constant out of src/lib/site.ts.

    Parsed rather than duplicated so the PDF cannot drift from the site — the
    booking link and phone number are defined in exactly one place.
    """
    match = re.search(
        rf'export const {name}\s*(?::\s*string)?\s*=\s*\n?\s*"([^"]+)"',
        SITE_TS.read_text(),
    )
    if not match:
        raise RuntimeError(f"could not read {name} from {SITE_TS}")
    return match.group(1)


# Tagged as its own entry point so bookings that came out of the PDF are visible.
BOOKING_URL = (
    f"{site_constant('CALENDLY_URL')}"
    "?utm_source=footholdsystems&utm_medium=pdf&utm_campaign=5-levels-guide"
)
CONTACT_PHONE = site_constant("CONTACT_PHONE")

# Brand colours, matching the site and the guide's own palette.
DARK = Color(0.106, 0.106, 0.106)
CREAM = Color(0.949, 0.937, 0.902)

# Button geometry in PDF points, origin bottom-left, on a 612x792 page. This sits
# in the blank right-hand half of the yellow CTA block, whose inner border runs
# from y=39 to y=175 and whose body copy bottoms out at y=115. Vertically centred
# on the three contact lines opposite it (y=53 to y=99) so it reads as deliberate.
BTN_X0, BTN_X1 = 335.0, 550.0
BTN_Y0, BTN_Y1 = 57.0, 95.0
BTN_RADIUS = 5.0
BTN_LABEL = "BOOK A CALL"
BTN_FONT, BTN_SIZE = "Helvetica-Bold", 12.0

# The phone line is stripped from the export and redrawn here, so the number in
# the published PDF always comes from site.ts however stale the export is.
# Courier-Bold because the guide's own mono font is a subset that has no glyphs
# for the new digits, and it is pitch-matched (0.6 em advance) to the two contact
# lines below so the column stays aligned.
PHONE_X = 128.8
PHONE_BASELINE = 88.5
PHONE_FONT = "Courier-Bold"
PHONE_SIZE = 11.4
INK = Color(0.0824, 0.0941, 0.102)

# Text runs matching this are deleted from the last page before redrawing.
PHONE_RE = re.compile(r"\(?\d{3}\)?[\s.–-]*\d{3}[\s.–-]*\d{4}")

# ─────────────────────────────────────────────────────────────────────────────
# COPY EDITS
#
# Applied to the body text of every page, as (old, new) pairs. Each `old` must
# appear exactly once across the document, and the pair is re-typeset in the
# guide's own font — see retypeset_page below.
#
# These exist so a copy decision made on the website does not have to wait for
# the design source to be reopened and re-exported. Keep the list short: it is a
# reconciliation step, not a place to write the guide. When the design source is
# next edited, fold these in there and delete them from here.
#
# A replacement has to fit the line it lands on. The text is re-typeset, not
# re-flowed — the lines after it keep their own break points, so a `new` much
# longer than its `old` will run into the right margin rather than wrap.
#
# Empty because the current export needs no edits: the headcount line this list
# used to rewrite ("For a business with 5 to 50 people...") is not in the prompts
# edition at all. A replacement left here that the export does not contain is a
# hard error, not a no-op, so retire one as soon as its line goes.
COPY_REPLACEMENTS: list[tuple[str, str]] = []

# Operators a text object may contain for this script to consider re-typesetting
# it. Anything else and the object is left alone rather than guessed at.
GLYPH_TOKEN_RE = re.compile(
    rb"/(?P<font>F\d+)\s+(?P<size>[\d.]+)\s+Tf"
    rb"|(?P<tx>-?[\d.]+)\s+(?P<ty>-?[\d.]+)\s+Td"
    rb"|<(?P<code>[0-9A-Fa-f]+)>\s*Tj"
    rb"|(?P<tm>(?:[-\d.]+\s+){6}Tm)"
    rb"|(?P<delim>\bBT\b|\bET\b)"
)


Matrix = tuple[float, float, float, float, float, float]
IDENTITY: Matrix = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

# BT/ET first so a text object is consumed whole and its innards are never
# mistaken for operators.
TOKEN_RE = re.compile(
    rb"(?P<bt>BT\b.*?\bET\b)"
    rb"|(?P<cm>(?:[-\d.]+\s+){6}cm\b)"
    rb"|(?P<q>\bq\b)"
    rb"|(?P<Q>\bQ\b)",
    re.S,
)
TM_RE = re.compile(rb"((?:[-\d.]+\s+){6})Tm\b")


def mat_mul(m: Matrix, n: Matrix) -> Matrix:
    """Concatenate m onto n, as PDF's `cm` does (result = m x n)."""
    a1, b1, c1, d1, e1, f1 = m
    a2, b2, c2, d2, e2, f2 = n
    return (
        a1 * a2 + b1 * c2,
        a1 * b2 + b1 * d2,
        c1 * a2 + d1 * c2,
        c1 * b2 + d1 * d2,
        e1 * a2 + f1 * c2 + e2,
        e1 * b2 + f1 * d2 + f2,
    )


def text_objects(stream: bytes):
    """Yield (start, end, page_x, page_y) for each text object in the stream.

    Walks the operators tracking the q/Q stack and the current transform, because
    the page contains several nested `cm` transforms and a text object's position
    only makes sense against the one in effect where it appears.
    """
    ctm: Matrix = IDENTITY
    stack: list[Matrix] = []

    for token in TOKEN_RE.finditer(stream):
        if token.group("q"):
            stack.append(ctm)
        elif token.group("Q"):
            if stack:
                ctm = stack.pop()
        elif token.group("cm"):
            values = tuple(float(v) for v in token.group("cm").split()[:6])
            ctm = mat_mul(values, ctm)  # type: ignore[arg-type]
        else:
            tm = TM_RE.search(token.group("bt"))
            if not tm:
                continue
            matrix = tuple(float(v) for v in tm.group(1).split()[:6])
            rendering = mat_mul(matrix, ctm)  # type: ignore[arg-type]
            yield token.start(), token.end(), rendering[4], rendering[5]


def strip_phone(reader: PdfReader, page_index: int, source: Path) -> int:
    """Delete phone-number text runs from a page's content stream.

    Returns how many runs were removed. Works by locating the number's bounding
    box with pdfplumber, then dropping whole `BT`/`ET` text objects whose origin
    falls inside it. Those objects set only a font and a text matrix — no colour
    or graphics state that later drawing depends on — so removing them changes
    nothing but the glyphs.
    """
    with pdfplumber.open(str(source)) as doc:
        page = doc.pages[page_index]
        height = float(page.height)
        words = page.extract_words()

    # A number like "(626) 838-2862" comes back as two separate words, so test
    # windows of adjacent words on the same line rather than words in isolation.
    lines: dict[int, list[dict]] = {}
    for w in words:
        lines.setdefault(round(w["top"] / 3), []).append(w)

    boxes = []
    for line in lines.values():
        line.sort(key=lambda w: w["x0"])
        for start in range(len(line)):
            for size in (1, 2, 3):
                window = line[start : start + size]
                if len(window) < size:
                    break
                if not PHONE_RE.fullmatch(" ".join(w["text"] for w in window).strip()):
                    continue
                boxes.append(
                    (  # to PDF space, origin bottom-left
                        min(w["x0"] for w in window),
                        height - max(w["bottom"] for w in window),
                        max(w["x1"] for w in window),
                        height - min(w["top"] for w in window),
                    )
                )
                break

    if not boxes:
        return 0

    data = reader.pages[page_index].get_contents().get_data()

    pad = 4.0
    removed = 0
    out = bytearray()
    cursor = 0
    for start, end, px, py in text_objects(data):
        if start < cursor:
            continue
        if any(
            x0 - pad <= px <= x1 + pad and y0 - pad <= py <= y1 + pad
            for x0, y0, x1, y1 in boxes
        ):
            out += data[cursor:start]
            cursor = end
            removed += 1

    if removed:
        out += data[cursor:]
        replacement = DecodedStreamObject()
        replacement.set_data(bytes(out))
        reader.pages[page_index][NameObject("/Contents")] = replacement

    return removed


def unicode_map(font) -> dict[int, str]:
    """Glyph code to character, read from a font's /ToUnicode CMap."""
    cmap = font.get("/ToUnicode")
    if not cmap:
        return {}
    text = cmap.get_object().get_data().decode("latin-1")
    mapping: dict[int, str] = {}

    for block in re.findall(r"beginbfchar(.*?)endbfchar", text, re.S):
        for src, dst in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            # Destinations are UTF-16BE and may be multi-character (ligatures).
            # Only single characters are usable for matching and re-typesetting.
            raw = dst if len(dst) % 2 == 0 else "0" + dst
            char = bytes.fromhex(raw).decode("utf-16-be", "ignore")
            if len(char) == 1:
                mapping[int(src, 16)] = char

    for block in re.findall(r"beginbfrange(.*?)endbfrange", text, re.S):
        for lo, hi, dst in re.findall(
            r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block
        ):
            lo, hi, dst = int(lo, 16), int(hi, 16), int(dst, 16)
            for code in range(lo, hi + 1):
                mapping[code] = chr(dst + code - lo)

    return mapping


def observed_advances(data: bytes) -> dict[tuple[str, float, int], float]:
    """Harvest the advance the export itself used for each glyph on a page.

    The export writes every glyph with an explicit `Td`, and those advances are
    whole numbers that do not follow from the /Widths array by any rounding rule
    — the design tool used its own metrics, and /Widths is a rounded record of
    them. Deriving advances instead of reusing them produces a line that is
    visibly tighter than the text around it.

    So rather than guess the rule, this reads the answer off the page: for each
    (font, size, glyph) it records what the export actually advanced by. Keyed by
    size because the same glyph is set at several sizes in the guide.

    Where the same glyph shows more than one advance — a kerned pair, say — the
    most common one wins.
    """
    counts: dict[tuple[str, float, int], Counter] = defaultdict(Counter)
    for start, end, _px, _py in text_objects(data):
        parsed = parse_glyph_run(data[start:end])
        if parsed is None:
            continue
        _prologue, glyphs = parsed
        advances = [
            float(m.group(1))
            for m in re.finditer(rb"(-?[\d.]+)\s+0\s+Td", data[start:end])
        ]
        # The advance printed before glyph i+1 is glyph i's, so the last glyph on
        # a line contributes nothing.
        for i, advance in enumerate(advances):
            if i >= len(glyphs):
                break
            font_key, size, code = glyphs[i]
            counts[(font_key, round(size, 2), code)][advance] += 1

    return {key: c.most_common(1)[0][0] for key, c in counts.items()}


def glyph_width(font, code: int, size: float) -> float | None:
    """Advance width of one glyph, in text space at the given font size."""
    widths = font.get("/Widths")
    if widths is None:
        return None
    index = code - int(font.get("/FirstChar", 0))
    if not 0 <= index < len(widths):
        return None
    matrix = font.get("/FontMatrix") or [0.001, 0, 0, 0.001, 0, 0]
    return float(widths[index]) * float(matrix[0]) * size


def parse_glyph_run(block: bytes):
    """Split a text object into its glyph operations.

    Returns (prologue, glyphs) where prologue is everything up to and including
    the text matrix, and glyphs is a list of (font_key, size, code). Returns None
    if the object uses any operator this script does not model — better to leave
    a text object alone than to rewrite one that was doing something else.
    """
    consumed = 0
    prologue_end = None
    glyphs: list[tuple[str, float, int]] = []
    font: str | None = None
    size: float | None = None

    for token in GLYPH_TOKEN_RE.finditer(block):
        # Every byte between tokens must be whitespace, or there is an operator
        # here that this parser cannot see.
        if block[consumed : token.start()].strip():
            return None
        consumed = token.end()

        if token.group("font"):
            font = token.group("font").decode()
            size = float(token.group("size"))
        elif token.group("tm"):
            prologue_end = token.end()
        elif token.group("code"):
            if font is None or size is None:
                return None
            glyphs.append((font, size, int(token.group("code"), 16)))

    if block[consumed:].strip() or prologue_end is None or not glyphs:
        return None
    return block[:prologue_end], glyphs


def retypeset_page(reader: PdfReader, page_index: int, replacements) -> list[str]:
    """Apply copy replacements to one page's content stream.

    The export positions every glyph individually, so a line can be rebuilt by
    emitting new glyph codes with advances derived from the font's own /Widths.
    That keeps the guide's real typeface — the fonts are Type3 subsets, which
    cannot be handed to a drawing library, so redrawing in a substitute face was
    never an option.

    Only the matched line is rebuilt. The lines after it keep their own break
    points, which is why the replacements are chosen to be about as long as what
    they replace.
    """
    page = reader.pages[page_index]
    fonts = page["/Resources"]["/Font"]

    decode: dict[str, dict[int, str]] = {
        key.lstrip("/"): unicode_map(fonts[key].get_object()) for key in fonts
    }

    data = page.get_contents().get_data()
    advances = observed_advances(data)

    def encoder(preferred: list[str], size: float) -> dict[str, tuple[str, int]]:
        """Character to (font key, glyph code) for writing a replacement.

        Fonts already used on the line being rebuilt come first, so the new text
        is set in the same face as the text around it rather than in whichever
        font happens to be listed first in the page resources.

        A character only qualifies if the export has already set it in that font
        at that size, because that observation is also where its advance comes
        from. In practice this is not much of a restriction: a replacement is a
        sentence of English in the guide's own body face, and the guide is nine
        pages of the same.
        """
        table: dict[str, tuple[str, int]] = {}
        ordered = preferred + [k for k in decode if k not in preferred]
        for key in ordered:
            for code, char in decode[key].items():
                if char in table:
                    continue
                if (key, round(size, 2), code) not in advances:
                    continue
                table[char] = (key, code)
        return table
    applied: list[str] = []
    out = bytearray()
    cursor = 0

    for start, end, _px, _py in text_objects(data):
        if start < cursor:
            continue
        parsed = parse_glyph_run(data[start:end])
        if parsed is None:
            continue
        prologue, glyphs = parsed

        line = "".join(decode[f].get(c, "�") for f, _s, c in glyphs)
        match = next((r for r in replacements if r[0] in line), None)
        if match is None:
            continue
        old, new = match

        size = glyphs[0][1]
        replacement = line.replace(old, new)

        seen: list[str] = []
        for font_key, _s, _c in glyphs:
            if font_key not in seen:
                seen.append(font_key)
        encode = encoder(seen, size)

        missing = sorted({c for c in replacement if c not in encode})
        if missing:
            raise RuntimeError(
                f"page {page_index + 1}: {missing} is not set anywhere on this "
                f"page in a usable font at {size}pt, so it has no glyph and no "
                f"measured advance. Cannot re-typeset {replacement!r}"
            )

        body = bytearray()
        pending: float | None = None
        current_font: str | None = None
        for char in replacement:
            font_key, code = encode[char]
            if font_key != current_font:
                body += f"\n/{font_key} {size} Tf".encode()
                current_font = font_key
            if pending is not None:
                body += f"\n{pending:g} 0 Td".encode()
            body += f"\n<{code:02X}> Tj".encode()
            pending = advances[(font_key, round(size, 2), code)]

        out += data[cursor:start] + prologue + bytes(body) + b"\nET"
        cursor = end
        applied.append(f"{old!r} -> {new!r}")
        replacements = [r for r in replacements if r is not match]

    if applied:
        out += data[cursor:]
        stream = DecodedStreamObject()
        stream.set_data(bytes(out))
        page[NameObject("/Contents")] = stream

    return applied


def build_overlay(width: float, height: float) -> PdfReader:
    """Draw the button onto a transparent single-page overlay."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))

    # Button body.
    c.setFillColor(DARK)
    c.roundRect(
        BTN_X0, BTN_Y0, BTN_X1 - BTN_X0, BTN_Y1 - BTN_Y0, BTN_RADIUS, stroke=0, fill=1
    )

    # Label plus a drawn arrow. The arrow is vector rather than a "→" glyph
    # because the standard PDF fonts have no such glyph and would render a box.
    arrow_len, arrow_gap = 11.0, 7.0
    label_w = stringWidth(BTN_LABEL, BTN_FONT, BTN_SIZE)
    group_w = label_w + arrow_gap + arrow_len
    start_x = (BTN_X0 + BTN_X1) / 2 - group_w / 2
    baseline = (BTN_Y0 + BTN_Y1) / 2 - BTN_SIZE * 0.34

    c.setFillColor(CREAM)
    c.setFont(BTN_FONT, BTN_SIZE)
    c.drawString(start_x, baseline, BTN_LABEL)

    ax0 = start_x + label_w + arrow_gap
    ay = baseline + BTN_SIZE * 0.30
    c.setStrokeColor(CREAM)
    c.setLineWidth(1.3)
    c.setLineCap(1)
    c.line(ax0, ay, ax0 + arrow_len, ay)
    c.line(ax0 + arrow_len - 3.6, ay + 3.4, ax0 + arrow_len, ay)
    c.line(ax0 + arrow_len - 3.6, ay - 3.4, ax0 + arrow_len, ay)

    # Phone line, redrawn where the export's own number was stripped from.
    c.setFillColor(INK)
    c.setFont(PHONE_FONT, PHONE_SIZE)
    c.drawString(PHONE_X, PHONE_BASELINE, CONTACT_PHONE)

    c.save()
    buf.seek(0)
    return PdfReader(buf)


def borderless(link: Link) -> Link:
    """Strip the default visible border so the annotation is invisible."""
    link[NameObject("/Border")] = ArrayObject(
        [NumberObject(0), NumberObject(0), NumberObject(0)]
    )
    return link


def main() -> int:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCE
    if not source.exists():
        print(f"error: source PDF not found: {source}", file=sys.stderr)
        return 1

    reader = PdfReader(str(source))
    if not reader.pages:
        print("error: source PDF has no pages", file=sys.stderr)
        return 1

    last_index = len(reader.pages) - 1

    # The default source is also the output, so guard against stamping a second
    # button onto an already-stamped PDF.
    for annot in reader.pages[last_index].get("/Annots") or []:
        action = annot.get_object().get("/A") or {}
        if "calendly.com" in str(action.get("/URI", "")):
            print(
                f"error: {source.name} already carries a booking link.\n"
                "       Pass the clean exported guide as an argument instead:\n"
                "         python3 scripts/add-booking-cta-to-guide.py <exported.pdf>",
                file=sys.stderr,
            )
            return 1

    last = reader.pages[last_index]
    width = float(last.mediabox.width)
    height = float(last.mediabox.height)

    # Delete the phone number before the pages are copied into the writer.
    stripped = strip_phone(reader, last_index, source)

    # Apply the copy edits, likewise before the pages are copied.
    pending = list(COPY_REPLACEMENTS)
    edits: list[str] = []
    for index in range(len(reader.pages)):
        if not pending:
            break
        done = retypeset_page(reader, index, pending)
        edits += [f"page {index + 1}: {d}" for d in done]
        pending = [r for r in pending if not any(repr(r[0]) in d for d in done)]

    if pending:
        print(
            "error: copy replacement text not found in the PDF:\n"
            + "\n".join(f"  {old!r}" for old, _ in pending)
            + "\n       The export's wording has changed. Update COPY_REPLACEMENTS.",
            file=sys.stderr,
        )
        return 1

    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)

    # Stamp the overlay onto the final page.
    overlay = build_overlay(width, height).pages[0]
    writer.pages[last_index].merge_page(overlay)

    # Make the button clickable.
    writer.add_annotation(
        page_number=last_index,
        annotation=borderless(
            Link(rect=(BTN_X0, BTN_Y0, BTN_X1, BTN_Y1), url=BOOKING_URL)
        ),
    )

    # Rewriting a content stream stores it decoded, which on the two edited pages
    # costs more than the edits themselves. This is the file the ads are paying to
    # deliver, so put the compression back.
    for page in writer.pages:
        page.compress_content_streams()

    writer.add_metadata(
        {
            "/Title": "The 5 Levels of AI and The Prompts That Get You There",
            "/Author": "Foothold Systems",
            "/Subject": "The five levels of AI in small business, and the exact prompts that move you up each one.",
        }
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUT.with_suffix(".tmp.pdf")
    with open(tmp, "wb") as fh:
        writer.write(fh)

    # The only phone number readable in the result must be the current one. This
    # catches a stale number surviving in an export whose layout defeated the
    # position matching above.
    with pdfplumber.open(str(tmp)) as doc:
        text = "\n".join((pg.extract_text() or "") for pg in doc.pages)

    # Likewise, every replaced phrase must be gone and its replacement readable.
    # Re-typesetting writes glyph codes directly, so this is what proves the new
    # line renders as intended rather than as a row of wrong glyphs.
    for old, new in COPY_REPLACEMENTS:
        wrong = old in text
        if wrong or new not in text:
            tmp.unlink()
            print(
                f"error: copy replacement did not take: {old!r} -> {new!r}\n"
                f"       old text still present: {wrong}\n"
                f"       new text readable: {new in text}",
                file=sys.stderr,
            )
            return 1

    expected = re.sub(r"\D", "", CONTACT_PHONE)
    stale = [
        found.group(0)
        for found in PHONE_RE.finditer(text)
        if re.sub(r"\D", "", found.group(0)) != expected
    ]
    if stale:
        tmp.unlink()
        print(
            f"error: unexpected phone number(s) still readable: {stale}; "
            "refusing to write the output",
            file=sys.stderr,
        )
        return 1

    tmp.replace(OUTPUT)

    print(f"wrote {OUTPUT.relative_to(REPO)} ({OUTPUT.stat().st_size:,} bytes)")
    print(f"  booking CTA stamped on page {last_index + 1} of {len(reader.pages)}")
    print(f"  phone number text runs removed: {stripped}, redrawn as {CONTACT_PHONE}")
    for edit in edits:
        print(f"  {edit}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
