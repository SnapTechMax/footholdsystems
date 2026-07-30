#!/usr/bin/env python3
"""Stamp a "Book a call" button and a printable booking URL onto the guide PDF.

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

Requires: pypdf, reportlab  (pip install pypdf reportlab)
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Link
from pypdf.generic import ArrayObject, NameObject, NumberObject
from reportlab.lib.colors import Color
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

REPO = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = REPO / "public" / "downloads" / "Foothold-The-Five-Levels-of-AI-for-Small-Business.pdf"
OUTPUT = REPO / "public" / "downloads" / "Foothold-The-Five-Levels-of-AI-for-Small-Business.pdf"

# Must stay in step with CALENDLY_URL in src/lib/site.ts. Tagged as its own
# entry point so bookings that came out of the PDF are identifiable.
BOOKING_URL = (
    "https://calendly.com/max-snaptechrepair/20-minute-ai-strategy-call"
    "?utm_source=footholdsystems&utm_medium=pdf&utm_campaign=guide-pdf"
)

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


def build_overlay(width: float, height: float) -> PdfReader:
    """Draw the button and URL onto a transparent single-page overlay."""
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
    tmp.replace(OUTPUT)

    print(f"wrote {OUTPUT.relative_to(REPO)} ({OUTPUT.stat().st_size:,} bytes)")
    print(f"  booking CTA stamped on page {last_index + 1} of {len(reader.pages)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
