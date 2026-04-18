#!/usr/bin/env python3
"""Upload PDFs as GitHub release assets and update issue bodies with download links.

Usage: python3 attach_pdfs.py <issues.json> <pdfs.json>

Creates/updates a GitHub release tagged 'issue-attachments' and adds
download links to each issue body.
"""

import json
import os
import subprocess
import sys
import tempfile


def gh(*args) -> str:
    result = subprocess.run(
        ["gh"] + list(args), capture_output=True, text=True
    )
    if result.returncode != 0 and "already exists" not in result.stderr:
        print(f"gh warning: {result.stderr.strip()}", file=sys.stderr)
    return result.stdout.strip()


def ensure_release(repo: str, tag: str):
    """Create the release if it doesn't exist, or delete and recreate."""
    # Check if release exists
    result = subprocess.run(
        ["gh", "release", "view", tag, "--repo", repo],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        # Delete existing to re-upload fresh assets
        gh("release", "delete", tag, "--repo", repo, "--yes", "--cleanup-tag")

    return tag


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <issues.json> <pdfs.json>", file=sys.stderr)
        sys.exit(1)

    issues_path = sys.argv[1]
    pdfs_path = sys.argv[2]

    with open(issues_path) as f:
        issues_data = json.load(f)
    with open(pdfs_path) as f:
        pdfs_data = json.load(f)

    repo = issues_data["repo"]
    parent = issues_data["parent"]
    sub_issues = issues_data["sub_issues"]
    pdfs = pdfs_data["pdfs"]

    # Ensure release exists
    tag = "issue-attachments"
    ensure_release(repo, tag)

    # Collect all PDF paths for upload
    pdf_files = list(pdfs.values())

    # Create release with all PDFs
    cmd = [
        "gh", "release", "create", tag,
        "--repo", repo,
        "--title", "Issue Attachments",
        "--notes", "Auto-generated PDF attachments for issues",
        "--prerelease",
    ] + pdf_files

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Release creation failed: {result.stderr}", file=sys.stderr)
        sys.exit(1)

    release_url = result.stdout.strip()
    print(f"Release created: {release_url}")

    # Get asset download URLs
    assets_json = gh(
        "release", "view", tag, "--repo", repo,
        "--json", "assets",
        "--jq", ".assets[] | {name: .name, url: .url}",
    )

    # Parse asset URLs
    asset_urls = {}
    for line in assets_json.strip().split("\n"):
        if line.strip():
            asset = json.loads(line)
            asset_urls[asset["name"]] = asset["url"]

    # Update each sub-issue body with PDF link
    for si in sub_issues:
        issue_num = si["number"]
        pdf_name = f"issue-{issue_num}.pdf"
        pdf_url = asset_urls.get(pdf_name, "")

        if not pdf_url:
            print(f"  Warning: No asset URL for {pdf_name}", file=sys.stderr)
            continue

        # Get current body
        current_body = gh(
            "api", f"/repos/{repo}/issues/{issue_num}", "--jq", ".body"
        )

        # Append PDF link (remove any old one first)
        lines = current_body.split("\n")
        lines = [l for l in lines if "Download PDF" not in l and "issue-attachments" not in l]
        body = "\n".join(lines).rstrip()
        body += f"\n\n---\n\n📎 **[Download PDF med screenshots ({pdf_name})]({pdf_url})**\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write(body)
            f.flush()
            gh("issue", "edit", str(issue_num), "--repo", repo, "-F", f.name)
            os.unlink(f.name)

        print(f"  Updated #{issue_num} with PDF link")

    # Update parent issue
    parent_num = parent["number"]
    parent_pdf_name = f"issue-{parent_num}.pdf"
    parent_pdf_url = asset_urls.get(parent_pdf_name, "")

    if parent_pdf_url:
        current_body = gh(
            "api", f"/repos/{repo}/issues/{parent_num}", "--jq", ".body"
        )
        lines = current_body.split("\n")
        lines = [l for l in lines if "Download PDF" not in l and "issue-attachments" not in l]
        body = "\n".join(lines).rstrip()
        body += f"\n\n---\n\n📎 **[Download komplet PDF ({parent_pdf_name})]({parent_pdf_url})**\n"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            f.write(body)
            f.flush()
            gh("issue", "edit", str(parent_num), "--repo", repo, "-F", f.name)
            os.unlink(f.name)

        print(f"  Updated parent #{parent_num} with PDF link")

    print("\nDone! All issues updated with PDF download links.")


if __name__ == "__main__":
    main()
