"""
AI Ticket Analyzer — Python Worker

Called by the Node.js worker via subprocess. Reads ticket context from stdin,
calls Azure OpenAI GPT-4o for structured analysis, and outputs JSON to stdout.

Environment variables:
  - AZURE_OPENAI_API_KEY
  - AZURE_OPENAI_ENDPOINT
  - AZURE_OPENAI_MODEL (default: gpt-4o)
"""

import json
import sys
import os

try:
    from openai import AzureOpenAI
except ImportError:
    # If openai package not installed, read stdin and exit with code 1
    # so the Node.js fallback kicks in
    sys.stdin.read()
    print("openai package not installed", file=sys.stderr)
    sys.exit(1)


SYSTEM_PROMPT = """Du er en AI analyse-agent for et CRM-ticketing system.
Analysér den givne feedback-ticket og returnér et JSON-objekt med disse felter:

{
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "urgency": "low" | "medium" | "high" | "critical",
  "suggestedCategory": "bug" | "feature_request" | "question" | "complaint" | "general" | "security" | "performance",
  "suggestedPriority": "critical" | "high" | "medium" | "low",
  "suggestedRoute": "<team eller person der bør håndtere dette, f.eks. 'Engineering', 'Support', 'Product'>",
  "nextBestAnswer": "<foreslået svar til kunden på dansk, professionelt og empatisk>",
  "summary": "<kort opsummering af ticket-indholdet>",
  "keywords": ["<relevante nøgleord>"],
  "confidence": <0.0-1.0 — din sikkerhed i analysen>
}

Overvejelser:
- Vurdér sentiment ud fra hele konteksten (titel, beskrivelse, kommentarer)
- Tag hensyn til feedback-historik og status-transitions
- Foreslå routing baseret på kategori og indhold
- Generér et empatisk og professionelt næste-bedste-svar
- Returnér KUN JSON, ingen anden tekst
"""


def analyze(ticket_context: dict) -> dict:
    """Call Azure OpenAI to analyze the ticket."""
    api_key = os.environ.get("AZURE_OPENAI_API_KEY", "")
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    model = os.environ.get("AZURE_OPENAI_MODEL", "gpt-4o")

    if not api_key or not endpoint:
        print("Missing AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT", file=sys.stderr)
        sys.exit(1)

    client = AzureOpenAI(
        api_key=api_key,
        api_version="2024-08-01-preview",
        azure_endpoint=endpoint,
    )

    user_msg = f"""Analysér denne ticket:

Ticket nummer: {ticket_context.get('ticketNumber', 'N/A')}
Titel: {ticket_context.get('title', 'N/A')}
Beskrivelse: {ticket_context.get('description', 'Ingen beskrivelse')}
Status: {ticket_context.get('status', 'new')}
Prioritet: {ticket_context.get('priority', 'medium')}
Kategori: {ticket_context.get('category', 'general')}
Tags: {', '.join(ticket_context.get('tags', []))}

Kommentarer:
{_format_comments(ticket_context.get('comments', []))}

Transitions:
{_format_transitions(ticket_context.get('transitions', []))}
"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
        max_tokens=1000,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    if not content:
        print("Empty response from OpenAI", file=sys.stderr)
        sys.exit(1)

    return json.loads(content)


def _format_comments(comments: list) -> str:
    if not comments:
        return "  (ingen kommentarer)"
    lines = []
    for c in comments:
        internal = " [INTERN]" if c.get("isInternal") else ""
        lines.append(f"  - {c.get('createdAt', '?')}{internal}: {c.get('content', '')}")
    return "\n".join(lines)


def _format_transitions(transitions: list) -> str:
    if not transitions:
        return "  (ingen transitions)"
    lines = []
    for t in transitions:
        reason = f" ({t.get('reason', '')})" if t.get("reason") else ""
        lines.append(f"  - {t.get('from', '?')} → {t.get('to', '?')}{reason} ({t.get('createdAt', '?')})")
    return "\n".join(lines)


if __name__ == "__main__":
    # Read ticket context from stdin
    raw = sys.stdin.read()
    if not raw.strip():
        # Try environment variable fallback
        raw = os.environ.get("TICKET_CONTEXT", "")

    if not raw.strip():
        print("No input provided", file=sys.stderr)
        sys.exit(1)

    try:
        context = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    result = analyze(context)
    print(json.dumps(result, ensure_ascii=False))
