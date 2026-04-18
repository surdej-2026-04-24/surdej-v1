#!/usr/bin/env python3
"""Generate PDFs for each issue from sections.json + extracted images.

Usage: python3 generate_pdfs.py <issues.json>

Requires: fpdf2 (pip3 install fpdf2)

Outputs:
  <output-dir>/pdfs/issue-<N>.pdf        — one per sub-issue
  <output-dir>/pdfs/issue-<parent>.pdf   — combined PDF for parent
  <output-dir>/pdfs.json                 — mapping of issue numbers to PDF paths
"""

import json
import os
import sys
import urllib.request

FONT_DIR = os.path.expanduser("~/.cache/surdej-fonts")
FONT_URL = "https://github.com/google/fonts/raw/main/ofl/opensans/OpenSans%5Bwdth%2Cwght%5D.ttf"
FONT_PATH = os.path.join(FONT_DIR, "OpenSans.ttf")


def ensure_font():
    """Download OpenSans if not cached."""
    if os.path.exists(FONT_PATH):
        return
    os.makedirs(FONT_DIR, exist_ok=True)
    print("Downloading OpenSans font...")
    urllib.request.urlretrieve(FONT_URL, FONT_PATH)
    print(f"  Cached at {FONT_PATH}")


def create_pdf(pdf_path: str, title: str, text_lines: list, image_paths: list):
    """Create a single PDF with title, text, and images."""
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.add_font("OpenSans", "", FONT_PATH)
    pdf.add_font("OpenSans", "B", FONT_PATH)

    # Title
    pdf.set_font("OpenSans", "B", 16)
    pdf.multi_cell(0, 12, title)
    pdf.ln(4)

    # Text
    pdf.set_font("OpenSans", "", 11)
    for line in text_lines:
        pdf.multi_cell(0, 7, line)
        pdf.ln(2)

    # Images
    if image_paths:
        pdf.ln(4)
        pdf.set_font("OpenSans", "B", 12)
        pdf.cell(0, 10, "Screenshots:", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
        available_width = pdf.w - pdf.l_margin - pdf.r_margin
        for img_path in image_paths:
            if os.path.exists(img_path):
                if pdf.get_y() > pdf.h - 80:
                    pdf.add_page()
                pdf.image(img_path, x=pdf.l_margin, w=available_width)
                pdf.ln(5)

    pdf.output(pdf_path)


def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <issues.json>", file=sys.stderr)
        sys.exit(1)

    issues_path = sys.argv[1]
    with open(issues_path) as f:
        data = json.load(f)

    out_dir = os.path.dirname(issues_path)
    pdf_dir = os.path.join(out_dir, "pdfs")
    os.makedirs(pdf_dir, exist_ok=True)

    image_dir = data.get("image_dir", "")
    sections = data["sections"]
    sub_issues = data["sub_issues"]
    parent = data["parent"]

    ensure_font()

    # Build section lookup by number
    section_map = {s["number"]: s for s in sections}

    pdfs = {}

    # Generate per-sub-issue PDFs
    for si in sub_issues:
        sec_num = si["section"]
        sec = section_map.get(sec_num, {})
        issue_num = si["number"]

        title = f"Issue #{issue_num} — {sec.get('title', si['section_title'])}"
        text_lines = sec.get("text_lines", [])
        images = [os.path.join(image_dir, img) for img in sec.get("images", [])]

        pdf_path = os.path.join(pdf_dir, f"issue-{issue_num}.pdf")
        create_pdf(pdf_path, title, text_lines, images)
        pdfs[issue_num] = pdf_path
        print(f"Created {pdf_path}")

    # Generate combined parent PDF
    parent_num = parent["number"]
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_font("OpenSans", "", FONT_PATH)
    pdf.add_font("OpenSans", "B", FONT_PATH)
    pdf.add_page()

    pdf.set_font("OpenSans", "B", 18)
    pdf.multi_cell(0, 12, data.get("title", "Document Analysis"))
    pdf.ln(6)

    for sec in sections:
        pdf.set_font("OpenSans", "B", 13)
        pdf.multi_cell(0, 9, f"{sec['number']}. {sec['title']}")
        pdf.ln(2)

        pdf.set_font("OpenSans", "", 11)
        for line in sec.get("text_lines", []):
            pdf.multi_cell(0, 7, line)
            pdf.ln(1)

        images = [os.path.join(image_dir, img) for img in sec.get("images", [])]
        if images:
            pdf.ln(2)
            available_width = pdf.w - pdf.l_margin - pdf.r_margin
            for img_path in images:
                if os.path.exists(img_path):
                    if pdf.get_y() > pdf.h - 80:
                        pdf.add_page()
                    pdf.image(img_path, x=pdf.l_margin, w=available_width)
                    pdf.ln(5)

        pdf.ln(6)
        if pdf.get_y() > pdf.h - 40:
            pdf.add_page()

    parent_pdf_path = os.path.join(pdf_dir, f"issue-{parent_num}.pdf")
    pdf.output(parent_pdf_path)
    pdfs[parent_num] = parent_pdf_path
    print(f"Created {parent_pdf_path} (combined)")

    # Write output
    output = {"parent": parent_num, "pdfs": {str(k): v for k, v in pdfs.items()}}
    out_file = os.path.join(out_dir, "pdfs.json")
    with open(out_file, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
