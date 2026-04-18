# 04 — AI Capabilities

## Overview

The platform uses a multi-model AI strategy with intelligent routing based on task complexity.
AI capabilities span chat, document analysis, embeddings, RAG, and content generation.
All AI capabilities are generic platform services — domain-specific AI use cases are
implemented in domain workers using these core primitives.

## AI Providers

| Provider | Purpose | Status |
|----------|---------|--------|
| Azure OpenAI | Chat, analysis, embeddings (primary) | ✅ Active |
| Azure AI Foundry (Claude) | Complex document analysis | 🟡 Configured |
| Google Vertex AI (Gemini) | Future expansion | ⬜ Planned |

## Model Deployments (Azure OpenAI — Sweden Central)

| Model | TPM | Primary Use |
|-------|-----|-------------|
| `gpt-4o` | 450K | Document analysis |
| `gpt-4o-mini` | 3,036K | Chat (primary) |
| `o3` | 150K | Complex reasoning |
| `text-embedding-3-small` | 1,000K | RAG semantic search (default) |
| `text-embedding-3-large` | 120K | High-quality embeddings |

## Intelligent Model Routing

| Complexity | Model | Use Case |
|------------|-------|----------|
| Low | `gpt-4o-mini` | Simple chat, quick answers |
| Medium | `gpt-4o` | Document analysis, structured extraction |
| High | `claude-opus-4.5` (AI Foundry) | Complex multi-document analysis |
| Reasoning | `o3` | Logical reasoning, decision-making |

Fallback chains implemented: if primary model fails, automatically route to alternative.

## AI Chat (Core Platform)

- **Server-side**: Vercel AI SDK + Azure OpenAI with streaming responses in the **API**.
- **Frontend**: `useChat()` hook streams from `/api/ai/chat`. No direct AI provider imports
  in the browser — all model calls go through the API (the sole integration point).
- Chat history persisted in **PostgreSQL** (core schema: `AiConversation`, `AiMessage`).
- Routes: `/chat/[id]` with sidebar navigation.
- Components: `ChatInput`, `ChatMessage`, `ChatThread`, `ChatSidebar`, `StreamingText`.
- Auto-generated conversation titles.
- MCP tool integration — chat can invoke MCP tools from connected servers.
- Context-aware chat via RAG (see below).

## RAG Pipeline (Core Platform)

Generic retrieval-augmented generation pipeline available to all domain modules:

### Pipeline Steps

1. **Ingest** — Document uploaded via API or worker.
2. **Chunk** — Markdown-aware splitting (512–1024 tokens, 10% overlap).
3. **Embed** — `text-embedding-3-small` vectors generated.
4. **Store** — Vectors stored in pgvector (in the owning worker's schema segment).
5. **Search** — Hybrid search: semantic (vector similarity) + keyword matching.
6. **Augment** — Retrieved chunks injected into AI prompt context.
7. **Generate** — AI model produces grounded response.

### RAG API

```typescript
// Core RAG service — domain-agnostic
interface RagService {
  ingest(document: Document, schemaSegment: string): Promise<ChunkResult[]>;
  search(query: string, options: SearchOptions): Promise<SearchResult[]>;
  augmentPrompt(query: string, results: SearchResult[]): string;
}

interface SearchOptions {
  schemaSegments?: string[];    // which schema segments to search (default: all)
  topK?: number;                // number of results (default: 10)
  minScore?: number;            // minimum similarity threshold
  filter?: Record<string, any>; // metadata filters
}
```

### Bilingual Support (Planned)

Dual Danish + English embeddings for cross-language semantic search.

## MCP Integration

The AI chat integrates with MCP servers (see spec 14) to extend capabilities:

- Connected MCP tools are available as function calls during chat.
- Tool invocations are logged in `AiUsageLog` for audit and cost tracking.
- Domain workers can expose their own MCP tools.

## Cost Estimates

Monthly budget for ~500 users:

| Category | Estimate |
|----------|----------|
| Chat | ~$58/month |
| Document Analysis | ~$250–750/month |
| Embeddings | ~$2/month |
| Reasoning | ~$30–50/month |
| **Total** | **~$340–860/month** (~2,360–5,970 DKK) |

Budget ceiling: Sub $5,000/month Azure (Sweden Central).

## Implementation Phases

| Phase | Duration | Focus |
|-------|----------|-------|
| 1 | W1–2 | Azure infra setup, AI config service, pricing/routing utilities |
| 2 | W2–3 | Enhanced analysis, complexity scoring, Claude fallback, batch analysis |
| 3 | W3–4 | Multi-model chat, o3 reasoning mode, RAG with hybrid search |
| 4 | W4–5 | AI Foundry setup, Claude + Gemini clients, provider abstraction |
| 5 | W5–6 | Usage analytics (`AiUsageLog`), cost alerts, performance optimization |
| 6 | W6 | Documentation and training |

Success metrics: 95% analysis accuracy, <5s analysis latency, <$500/month AI cost.

---

*Core AI platform specification. Domain-specific AI use cases (rental property extraction,
email classification, etc.) are documented in their respective domain specs.*
