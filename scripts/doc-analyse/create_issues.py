#!/usr/bin/env python3
"""Create GitHub issues from extracted sections.json.

Usage: python3 create_issues.py <sections.json> <repo> [label]

Creates a parent issue + sub-issues using the GitHub CLI and sub-issues API.

Outputs:
  <output-dir>/issues.json — mapping of section number to issue number/URL
"""

import json
import os
import subprocess
import sys
import tempfile


def gh(*args, input_text=None) -> str:
    """Run a gh CLI command and return stdout."""
    result = subprocess.run(
        ["gh"] + list(args),
        capture_output=True,
        text=True,
        input=input_text,
    )
    if result.returncode != 0:
        print(f"gh error: {result.stderr}", file=sys.stderr)
    return result.stdout.strip()


def create_issue(repo: str, title: str, body: str) -> dict:
    """Create a GitHub issue, return {number, url, id}."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write(body)
        f.flush()
        url = gh("issue", "create", "--repo", repo, "-t", title, "-F", f.name)
        os.unlink(f.name)

    # Extract issue number from URL
    number = int(url.rstrip("/").split("/")[-1])

    # Get the integer ID needed for sub-issues API
    issue_id = gh("api", f"/repos/{repo}/issues/{number}", "--jq", ".id")

    return {"number": number, "url": url, "id": int(issue_id)}


def add_sub_issue(repo: str, parent_number: int, child_id: int):
    """Link a child issue as a sub-issue of the parent."""
    gh(
        "api",
        "--method",
        "POST",
        f"/repos/{repo}/issues/{parent_number}/sub_issues",
        "-F",
        f"sub_issue_id={child_id}",
        "--silent",
    )


def create_label(repo: str, label: str):
    """Create a label if it doesn't exist."""
    result = subprocess.run(
        ["gh", "label", "create", label, "--repo", repo, "--color", "1d76db"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 and "already exists" not in result.stderr:
        print(f"Label warning: {result.stderr}", file=sys.stderr)


def apply_label(repo: str, issue_number: int, label: str):
    """Apply a label to an issue."""
    gh("issue", "edit", str(issue_number), "--repo", repo, "--add-label", label)


def main():
    if len(sys.argv) < 3:
        print(
            f"Usage: {sys.argv[0]} <sections.json> <repo> [label]", file=sys.stderr
        )
        sys.exit(1)

    sections_path = sys.argv[1]
    repo = sys.argv[2]
    label = sys.argv[3] if len(sys.argv) > 3 else None

    with open(sections_path) as f:
        data = json.load(f)

    sections = data["sections"]
    doc_title = data.get("title", "Document Analysis")

    # Create label if specified
    if label:
        print(f"Creating label: {label}")
        create_label(repo, label)

    # Build parent issue body
    parent_body = f"## {doc_title}\n\n"
    parent_body += f"**Kilde:** {data.get('source', 'Unknown')}\n\n"
    parent_body += f"### Observationer ({len(sections)} stk.)\n\n"
    for s in sections:
        parent_body += f"- **{s['number']}. {s['title']}**\n"
    parent_body += "\n### Sub-issues\n\n_Opdateres efter oprettelse..._\n"

    print(f"Creating parent issue: {doc_title}")
    parent = create_issue(repo, doc_title, parent_body)
    print(f"  -> #{parent['number']} {parent['url']}")

    if label:
        apply_label(repo, parent["number"], label)

    # Create sub-issues
    sub_issues = []
    for s in sections:
        title = f"{s['title']}"
        body = f"## {s['number']}. {s['title']}\n\n"
        body += f"Parent: #{parent['number']}\n\n"
        body += "### Observation\n\n"
        for line in s["text_lines"]:
            body += f"{line}\n\n"

        print(f"Creating sub-issue: {title}")
        issue = create_issue(repo, title, body)
        issue["section"] = s["number"]
        issue["section_title"] = s["title"]
        sub_issues.append(issue)
        print(f"  -> #{issue['number']} {issue['url']}")

        # Link as sub-issue
        add_sub_issue(repo, parent["number"], issue["id"])
        print(f"  -> Linked as sub-issue of #{parent['number']}")

        if label:
            apply_label(repo, issue["number"], label)

    # Update parent issue with sub-issue references
    sub_list = "\n".join(
        [f"- [ ] #{si['number']} {si['section_title']}" for si in sub_issues]
    )
    updated_parent_body = f"## {doc_title}\n\n"
    updated_parent_body += f"**Kilde:** {data.get('source', 'Unknown')}\n\n"
    updated_parent_body += f"### Sub-issues\n\n{sub_list}\n"

    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write(updated_parent_body)
        f.flush()
        gh("issue", "edit", str(parent["number"]), "--repo", repo, "-F", f.name)
        os.unlink(f.name)

    print(f"\nUpdated parent #{parent['number']} with sub-issue list")

    # Write output
    out_dir = os.path.dirname(sections_path)
    output = {
        "repo": repo,
        "label": label,
        "parent": parent,
        "sub_issues": sub_issues,
        "sections": sections,
        "image_dir": data.get("image_dir", ""),
    }
    out_file = os.path.join(out_dir, "issues.json")
    with open(out_file, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
