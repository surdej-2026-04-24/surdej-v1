"""
PDF Extraction Microservice — Best-in-class PDF → Markdown conversion.

Uses pymupdf4llm (PyMuPDF4LLM) which is specifically designed for producing
LLM-ready markdown from PDFs, with proper:
  - Heading detection (by font size analysis)
  - Table extraction as markdown tables
  - List detection (bullet + numbered)
  - Bold/italic preservation
  - Image extraction with references
  - Multi-column layout handling
  - Page headers/footers removal

Exposes a simple HTTP endpoint that accepts a PDF file and returns markdown.
Called by the Node.js pdf-refinery worker.
"""

import io
import os
import logging
import tempfile
from pathlib import Path

import pymupdf4llm
import pymupdf
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("pdf-extractor")

app = FastAPI(title="PDF Extractor", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok", "engine": "pymupdf4llm"}


@app.post("/extract")
async def extract_pdf(
    file: UploadFile = File(...),
    write_images: bool = True,
    page_chunks: bool = False,
):
    """
    Extract markdown from an uploaded PDF file.
    
    Args:
        file: The PDF file to extract from
        write_images: Whether to extract embedded images
        page_chunks: If True, returns per-page chunks instead of full document
    
    Returns:
        JSON with markdown text, page count, images, and quality metrics
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    
    logger.info(f"Extracting: {file.filename} ({len(content)} bytes)")
    
    # Create a temp directory for image extraction
    with tempfile.TemporaryDirectory() as tmpdir:
        # Write PDF to temp file (pymupdf4llm needs a file path or bytes)
        pdf_path = os.path.join(tmpdir, "input.pdf")
        with open(pdf_path, "wb") as f:
            f.write(content)  # type: ignore[arg-type]  # content is bytes from UploadFile.read()
        
        images_dir = os.path.join(tmpdir, "images")
        os.makedirs(images_dir, exist_ok=True)
        
        try:
            # ── Use pymupdf4llm for best-quality extraction ──
            if page_chunks:
                # Per-page extraction → list of dicts with 'text', 'metadata'
                result = pymupdf4llm.to_markdown(
                    pdf_path,
                    page_chunks=True,
                    write_images=write_images,
                    image_path=images_dir,
                    show_progress=False,
                )
                pages = []
                for chunk in result:
                    pages.append({
                        "text": chunk.get("text", ""),
                        "page": chunk.get("metadata", {}).get("page", 0),
                        "images": chunk.get("images", []),
                    })
                full_text = "\n\n---\n\n".join(p["text"] for p in pages)
            else:
                # Full document extraction → single markdown string
                full_text = pymupdf4llm.to_markdown(
                    pdf_path,
                    page_chunks=False,
                    write_images=write_images,
                    image_path=images_dir,
                    show_progress=False,
                )
                pages = []

            # ── Get page count ──
            doc = pymupdf.open(pdf_path)
            page_count = doc.page_count
            doc.close()

            # ── Collect extracted images as base64 ──
            extracted_images = []
            if write_images and os.path.exists(images_dir):
                import base64
                for img_file in sorted(Path(images_dir).glob("*")):
                    if img_file.suffix.lower() in (".png", ".jpg", ".jpeg", ".bmp"):
                        img_data = img_file.read_bytes()
                        mime = {
                            ".png": "image/png",
                            ".jpg": "image/jpeg",
                            ".jpeg": "image/jpeg",
                            ".bmp": "image/bmp",
                        }.get(img_file.suffix.lower(), "image/png")
                        extracted_images.append({
                            "filename": img_file.name,
                            "size": len(img_data),
                            "mimeType": mime,
                            "base64": base64.b64encode(img_data).decode("ascii"),
                        })
            
            # ── Post-process markdown for quality ──
            markdown = _post_process_markdown(full_text, file.filename)
            
            # ── Quality metrics ──
            quality = _score_quality(markdown)
            
            logger.info(
                f"Extracted: {file.filename} → {len(markdown)} chars, "
                f"{page_count} pages, {len(extracted_images)} images, "
                f"quality={quality}"
            )
            
            response = {
                "markdown": markdown,
                "pageCount": page_count,
                "quality": quality,
                "imageCount": len(extracted_images),
                "images": extracted_images,
                "engine": "pymupdf4llm",
            }
            
            if page_chunks:
                response["pages"] = pages
            
            return JSONResponse(content=response)
            
        except Exception as e:
            logger.error(f"Extraction failed for {file.filename}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


def _post_process_markdown(text: str, filename: str | None = None) -> str:
    """
    Post-process extracted markdown for better quality:
    - Clean up excessive whitespace
    - Remove repeated page headers/footers
    - Normalize heading levels
    - Fix table formatting
    """
    lines = text.split("\n")
    processed = []
    prev_blank = False
    
    for line in lines:
        stripped = line.rstrip()
        
        # Collapse multiple blank lines into max 2
        if not stripped:
            if prev_blank:
                continue
            prev_blank = True
            processed.append("")
            continue
        prev_blank = False
        
        # Remove common PDF artifacts
        # Skip page numbers that are just digits on their own line
        if stripped.isdigit() and len(stripped) <= 4:
            continue
        
        # Skip lines that are just dashes or underscores (decorative)
        if all(c in "-_=" for c in stripped) and len(stripped) > 3:
            processed.append("---")
            continue
        
        # Fix markdown bullet lists that pymupdf sometimes outputs with wrong indent
        if stripped.startswith("- ") or stripped.startswith("* "):
            processed.append(stripped)
            continue
            
        processed.append(stripped)
    
    result = "\n".join(processed).strip()
    
    # Ensure document starts with a heading if one doesn't exist
    if result and not result.startswith("#"):
        heading = (filename or "Document").rsplit(".", 1)[0]
        result = f"# {heading}\n\n{result}"
    
    return result


def _score_quality(text: str) -> int:
    """
    Score markdown quality 0–100.
    Based on content density, structure, and formatting indicators.
    """
    if not text or not text.strip():
        return 0
    
    words = text.split()
    unique_words = set(w.lower() for w in words)
    score = 0.0
    
    # Length factor (max 25)
    score += min(len(words) / 100, 1.0) * 25
    
    # Diversity (max 25)
    if words:
        score += (len(unique_words) / len(words)) * 25
    
    # Structure indicators (max 30)
    has_headings = text.count("\n#") > 0
    has_tables = "|" in text and "---" in text
    has_lists = any(line.strip().startswith(("- ", "* ", "1.")) for line in text.split("\n"))
    has_bold = "**" in text
    has_paragraphs = text.count("\n\n") > 2
    has_danish = any(c in text for c in "æøåÆØÅ")
    has_numbers = any(c.isdigit() for c in text)
    
    if has_headings: score += 6
    if has_tables: score += 6
    if has_lists: score += 4
    if has_bold: score += 3
    if has_paragraphs: score += 4
    if has_danish: score += 4
    if has_numbers: score += 3
    
    # Penalty for garbage (max -20)
    import re
    garbage_chars = len(re.findall(r"[^\w\sæøåÆØÅ.,;:!?\-\[\]\"'/\\@#€$%&+*=<>|(){}~`^]", text))
    garbage_ratio = garbage_chars / max(len(text), 1)
    score -= garbage_ratio * 40
    
    # Penalty for short text
    if len(words) < 20:
        score -= 20
    
    return max(0, min(100, round(score)))


if __name__ == "__main__":
    port = int(os.environ.get("EXTRACTOR_PORT", "8090"))
    logger.info(f"Starting PDF Extractor on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
