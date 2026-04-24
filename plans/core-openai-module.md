# Plan: core-openai Module

Module for handling OpenAI endpoints for multi-modal AI capabilities.

## Derived Values

| Key | Value |
|-----|-------|
| MODULE_SLUG | `core-openai` |
| MODULE_PATH | `modules/core-openai/` |
| PRISMA_SCHEMA | `core_openai` |
| MODULE_PORT | `7009` |
| Entity | `AiJob` |

## Phase 1 — Scaffold Module Structure (DONE)

- [x] Interview & derive values
- [x] Create shared package (schemas, NATS subjects, DTOs)
- [x] Create worker package (Fastify server, OpenAI SDK routes, Prisma schema)
- [x] Create UI package (components, hooks, commands)
- [x] pnpm install & verify packages

## Phase 2 — Add Extra Endpoints (8 new tools)

- [x] Benchmark Tool — Compare models side-by-side (latency, cost, quality)
- [x] Prompt Playground — Test & iterate prompts with temperature/model knobs
- [x] Token Counter / Cost Estimator — Estimate tokens & cost before sending
- [x] Speech-to-Text (Whisper) — Transcribe audio files
- [x] Text-to-Speech — Generate spoken audio from text
- [x] Embeddings Generator — Generate vector embeddings for text
- [x] Moderation Check — Run content through OpenAI moderation API
- [x] Model Catalog — Browse available models with capabilities/pricing

## Phase 3 — Surface Integration (5 surfaces)

- [x] Module pages — Register in moduleRegistry.ts with activity items
- [x] Command palette — Register all commands with CommandRegistry
- [x] /chat MCP tools — Register OpenAI capabilities as AI chat tools in mcp-tools.ts
- [x] Quick Chat — Tools auto-available via MCP integration
- [x] Extension — Tools available via MCP passthrough

## All Endpoints

| Route | Purpose |
|-------|---------|
| `POST /text-to-image` | Generate image from text prompt (DALL-E) |
| `POST /image-to-text` | Analyze/describe image (GPT-4o Vision) |
| `POST /image-to-image` | Edit/transform image (DALL-E edit) |
| `POST /video-analysis` | Analyze video content (GPT-4o) |
| `POST /chat` | Standard chat completion |
| `POST /benchmark` | Run model comparison benchmark |
| `POST /playground` | Execute prompt with tunable parameters |
| `POST /count-tokens` | Estimate token count & cost |
| `POST /speech-to-text` | Transcribe audio (Whisper) |
| `POST /text-to-speech` | Generate audio from text (TTS) |
| `POST /embeddings` | Generate vector embeddings |
| `POST /moderation` | Check content moderation |
| `GET /models` | List available models + capabilities |
| `GET /` | List all jobs |
| `GET /:id` | Get job by ID |
