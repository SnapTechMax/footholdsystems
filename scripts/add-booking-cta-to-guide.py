#!/usr/bin/env python3
"""Stamp a "Book a call" button onto the guide PDF and strip the phone number.

The guide is designed and exported elsewhere; this script adds the booking
call-to-action afterwards so the PDF in public/downloads always carries it. Rerun
it whenever the guide is re-exported:

    python3 scripts/add-booking-cta-to-guide.py <exported.pdf>

It writes public/downloads/Foothold-The-Five-Levels-of-AI-for-Small-Business.pdf.

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
DEFAULT_SOURCE = REPO / "public" / "downloads" / "Foothold-The-Five-Levels-of-AI-for-Small-Business.pdf"
OUTPUT = REPO / "public" / "downloads" / "Foothold-The-Five-Levels-of-AI-for-Small-Business.pdf"

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
    "?utm_source=footholdsystems&utm_medium=pdf&utm_campaign=guide-pdf"
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

    writer.add_metadata(
        {
            "/Title": "The Five Levels of AI for Small Business",
            "/Author": "Foothold Systems",
            "/Subject": "A plain-English guide to the five levels of AI for small business owners.",
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
    print(f"  phone number text runs removed: {stripped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
