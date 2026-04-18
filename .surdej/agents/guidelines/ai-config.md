# AI Instruction Strategy

> How Surdej v1 shares context with AI coding tools.

## Architecture

```
.surdej/agents/guidelines/instructions.md          ← CANONICAL SOURCE OF TRUTH
       │
       ├── .github/instructions/copilot-instructions.md   (GitHub Copilot)
       ├── CLAUDE.md                                       (Claude Code)
       ├── .antigravity/instructions.md                    (Antigravity)
       └── (future tools read .surdej/agents/guidelines/instructions.md)
```

## Principle

**One source, many adapters.**

- The full project context lives in `.surdej/agents/guidelines/instructions.md`.
- Each AI tool has an adapter file in the location it expects.
- Adapters contain a condensed quick-reference and point to the canonical source.
- When updating instructions, **always update `.surdej/agents/guidelines/instructions.md` first**,
  then propagate key changes to the adapters.

## Tool Discovery

| Tool | Reads from | Format |
|------|-----------|--------|
| **GitHub Copilot** | `.github/instructions/copilot-instructions.md` | Markdown |
| **Claude Code** | `CLAUDE.md` (repo root) | Markdown |
| **Antigravity** | `.antigravity/instructions.md` | Markdown |
| **Windsurf** | `.windsurfrules` (repo root) | Markdown |
| **Aider** | `.aider.conf.yml` → conventions file | YAML + Markdown |
| **Generic** | `.surdej/agents/guidelines/instructions.md` | Markdown |

## Adding a New Tool

1. Find where the tool looks for instructions (docs, conventions).
2. Create an adapter file at that location.
3. Start with: "Canonical source: `.surdej/agents/guidelines/instructions.md`. Read it first."
4. Add a condensed quick-reference relevant to that tool's context window.
5. Add the tool to the table above.

## What Goes Where

| Content | `.surdej/agents/guidelines/instructions.md` | Adapters |
|---------|--------------------------|----------|
| Project vision & sourdough pattern | ✅ Full | ✅ Summary |
| Tech stack | ✅ Full | ✅ Full |
| `core/` vs `domains/` boundary | ✅ Full | ✅ Full |
| Skinning system | ✅ Full with examples | ✅ Summary |
| Feature flags | ✅ Full with examples | ✅ Summary |
| Auth system | ✅ Full | ✅ Brief |
| Coding standards | ✅ Full | ✅ Full |
| Domain extension guide | ✅ Full with examples | ✅ Brief |
| Worker architecture | ✅ Full | ❌ Omit |
| Deployment details | ✅ Full | ❌ Omit |
| Dev commands | ✅ Full | ✅ Common subset |

## Maintenance

When you change the project structure or add new conventions:

1. Update `.surdej/agents/guidelines/instructions.md`.
2. Check if any adapter needs updating (especially coding standards and key patterns).
3. Commit all instruction files together.

---

*Last updated: 2026-02-14*
