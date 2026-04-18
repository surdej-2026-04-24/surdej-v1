---
name: surdej-doc-analyse
description: Analyse a Word document (.docx), create a parent GitHub issue with summary, break each observation into native GitHub sub-issues, and generate PDFs with text + images for each
---

## Objective

Given a Word document containing observations or findings (e.g. review, QA report, audit), run a pipeline that:

1. Extracts all text sections and images from the document
2. Creates a parent GitHub issue summarising all findings
3. Creates individual sub-issues using GitHub's native sub-issue feature
4. Generates a PDF per sub-issue (text + relevant screenshot images)
5. Attaches PDFs via GitHub release assets with download links in each issue
6. Labels all issues with a user-specified label

## Prerequisites

- `gh` CLI authenticated with `repo` scope
- `python3` available on PATH
- `fpdf2` package (`pip3 install --user --break-system-packages fpdf2`)

## Pipeline Scripts

All scripts live in `scripts/doc-analyse/`:

| Script | Purpose |
|--------|---------|
| `extract_docx.py` | Parse .docx → `sections.json` + extracted images |
| `create_issues.py` | Create parent + sub-issues from `sections.json` |
| `generate_pdfs.py` | Generate PDFs from `issues.json` + images |
| `attach_pdfs.py` | Upload PDFs as release assets, link in issues |

## Steps

### Step 1: Gather inputs

Ask the user (or infer from context):
- **Document path**: The `.docx` file to analyse
- **Label**: Label to apply to all created issues (e.g. "PDF Analyse")

Set working directory:
```bash
WORK_DIR=$(mktemp -d)
echo "Working directory: $WORK_DIR"
```

### Step 2: Extract document content

// turbo
```bash
python3 scripts/doc-analyse/extract_docx.py "<docx-path>" "$WORK_DIR"
```

This produces:
- `$WORK_DIR/images/` — all extracted images
- `$WORK_DIR/sections.json` — structured text+image mapping

Review the output with the user: confirm sections are correctly identified before proceeding.

### Step 3: Create GitHub issues

```bash
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
python3 scripts/doc-analyse/create_issues.py "$WORK_DIR/sections.json" "$REPO" "<label>"
```

This produces:
- Parent issue with summary
- One sub-issue per section (linked via native sub-issues API)
- `$WORK_DIR/issues.json` — issue number mapping

### Step 4: Generate PDFs

// turbo
```bash
python3 scripts/doc-analyse/generate_pdfs.py "$WORK_DIR/issues.json"
```

This produces:
- `$WORK_DIR/pdfs/issue-<N>.pdf` per sub-issue
- `$WORK_DIR/pdfs/issue-<parent>.pdf` combined
- `$WORK_DIR/pdfs.json` — PDF path mapping

### Step 5: Upload and attach PDFs

```bash
python3 scripts/doc-analyse/attach_pdfs.py "$WORK_DIR/issues.json" "$WORK_DIR/pdfs.json"
```

This:
- Creates/updates a `issue-attachments` GitHub release
- Uploads all PDFs as release assets
- Updates each issue body with a download link

### Step 6: Summary

Print a summary table of all created issues and their PDF links.
Remind the user that PDFs are downloadable from the release assets.
