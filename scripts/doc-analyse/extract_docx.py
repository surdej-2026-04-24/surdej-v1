#!/usr/bin/env python3
"""Extract text sections and images from a .docx file.

Usage: python3 extract_docx.py <path-to-docx> <output-dir>

Outputs:
  <output-dir>/images/       — extracted images (png/jpg)
  <output-dir>/sections.json — structured JSON mapping sections to text + images
"""

import json
import os
import sys
from xml.etree import ElementTree
from zipfile import ZipFile

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def extract_images(z: ZipFile, out_dir: str) -> dict[str, str]:
    """Extract all media files and return {filename: output_path}."""
    img_dir = os.path.join(out_dir, "images")
    os.makedirs(img_dir, exist_ok=True)
    extracted = {}
    for name in z.namelist():
        if name.startswith("word/media/"):
            fname = os.path.basename(name)
            out_path = os.path.join(img_dir, fname)
            with open(out_path, "wb") as f:
                f.write(z.read(name))
            extracted[fname] = out_path
    return extracted


def parse_relationships(z: ZipFile) -> dict[str, str]:
    """Map rId -> media/imageN.ext from document.xml.rels."""
    rels = {}
    with z.open("word/_rels/document.xml.rels") as f:
        root = ElementTree.parse(f).getroot()
        for rel in root.findall(
            "{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"
        ):
            rid = rel.get("Id")
            target = rel.get("Target")
            if target and "media/" in target:
                rels[rid] = os.path.basename(target)
    return rels


def parse_document(z: ZipFile, rels: dict[str, str]) -> list[dict]:
    """Walk paragraphs, return list of {text, images, style, is_bold} per paragraph."""
    paragraphs = []
    with z.open("word/document.xml") as f:
        root = ElementTree.parse(f).getroot()
        for para in root.iter(f"{{{W_NS}}}p"):
            texts = []
            images = []
            style = ""
            is_bold = False
            # Extract paragraph style
            for ppr in para.iter(f"{{{W_NS}}}pPr"):
                for pstyle in ppr.iter(f"{{{W_NS}}}pStyle"):
                    style = pstyle.get(f"{{{W_NS}}}val", "")
            # Check for bold runs
            for rpr in para.iter(f"{{{W_NS}}}rPr"):
                if rpr.find(f"{{{W_NS}}}b") is not None:
                    is_bold = True
            for run in para.iter(f"{{{W_NS}}}t"):
                if run.text:
                    texts.append(run.text)
            for drawing in para.iter(f"{{{W_NS}}}drawing"):
                for blip in drawing.iter(f"{{{A_NS}}}blip"):
                    embed = blip.get(f"{{{R_NS}}}embed")
                    if embed and embed in rels:
                        images.append(rels[embed])
            line = "".join(texts).strip()
            if line or images:
                paragraphs.append({
                    "text": line,
                    "images": images,
                    "style": style,
                    "is_bold": is_bold,
                })
    return paragraphs


def group_into_sections(paragraphs: list[dict]) -> list[dict]:
    """Group paragraphs into sections using multiple heuristics.

    Strategies (tried in order):
    1. Numbered headings: "1. Title", "2. Title", etc.
    2. Bullet/list items: each 'Listeafsnit' (or ListParagraph) style = one section
    3. Bold headings: bold non-list paragraphs start a new section
    """
    import re

    # Strategy 1: Try numbered headings first
    has_numbered = any(
        re.match(r"^\d+\.\s+", p["text"]) for p in paragraphs if p["text"]
    )

    if has_numbered:
        return _group_by_numbered_headings(paragraphs)

    # Strategy 2/3: Bullet lists and bold headings
    return _group_by_bullets_and_headings(paragraphs)


def _group_by_numbered_headings(paragraphs: list[dict]) -> list[dict]:
    """Original strategy: group by 'N. Title' pattern."""
    import re

    sections = []
    current = None

    for p in paragraphs:
        text = p["text"]
        heading_match = re.match(r"^(\d+)\.\s+(.+)$", text)
        if heading_match:
            if current:
                sections.append(current)
            current = {
                "number": int(heading_match.group(1)),
                "title": heading_match.group(2).strip(),
                "text_lines": [],
                "images": list(p["images"]),
            }
        elif current:
            if text:
                current["text_lines"].append(text)
            current["images"].extend(p["images"])

    if current:
        sections.append(current)

    return sections


def _group_by_bullets_and_headings(paragraphs: list[dict]) -> list[dict]:
    """Group by bullet points and bold headings.

    Each bullet-list item becomes its own section.
    Bold non-list paragraphs start a new section that collects
    subsequent non-bold, non-list paragraphs as body text.
    """
    LIST_STYLES = {"Listeafsnit", "ListParagraph", "ListBullet", "ListNumber"}

    sections = []
    counter = 0
    current = None

    # Skip the document title (first bold non-list paragraph)
    skip_title = True

    for p in paragraphs:
        text = p["text"]
        style = p.get("style", "")
        is_bold = p.get("is_bold", False)
        is_list = style in LIST_STYLES

        if is_list and text:
            # Each bullet point is its own section
            if current:
                sections.append(current)
                current = None
            counter += 1
            # Truncate long bullets for the title (first ~80 chars)
            title = text[:80] + ("..." if len(text) > 80 else "")
            sections.append({
                "number": counter,
                "title": title,
                "text_lines": [text] if len(text) > 80 else [],
                "images": list(p["images"]),
            })
        elif is_bold and text and not is_list:
            if skip_title:
                skip_title = False
                continue
            # Bold heading starts a new grouped section
            if current:
                sections.append(current)
            counter += 1
            current = {
                "number": counter,
                "title": text[:80] + ("..." if len(text) > 80 else ""),
                "text_lines": [text] if len(text) > 80 else [],
                "images": list(p["images"]),
            }
        elif current:
            # Non-bold, non-list paragraph: append to current section
            if text:
                current["text_lines"].append(text)
            current["images"].extend(p["images"])
        else:
            # Stray paragraph with images but no current section
            if p["images"] and sections:
                sections[-1]["images"].extend(p["images"])

    if current:
        sections.append(current)

    return sections


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <docx-path> <output-dir>", file=sys.stderr)
        sys.exit(1)

    docx_path = sys.argv[1]
    out_dir = sys.argv[2]

    if not os.path.isfile(docx_path):
        print(f"Error: File not found: {docx_path}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(out_dir, exist_ok=True)

    with ZipFile(docx_path) as z:
        extracted_images = extract_images(z, out_dir)
        rels = parse_relationships(z)
        paragraphs = parse_document(z, rels)

    sections = group_into_sections(paragraphs)

    # Also capture the document title (first non-empty paragraph before sections)
    doc_title = ""
    for p in paragraphs:
        if p["text"] and not p["text"][0].isdigit():
            doc_title = p["text"]
            break

    output = {
        "source": os.path.basename(docx_path),
        "title": doc_title,
        "image_dir": os.path.join(out_dir, "images"),
        "sections": sections,
    }

    out_file = os.path.join(out_dir, "sections.json")
    with open(out_file, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
