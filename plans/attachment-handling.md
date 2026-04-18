# Plan: Chat Attachment Handling Architecture

This document outlines the recommended architecture for robust, scalable file attachment handling in the Surdej chat interface. It leverages the existing `Blob` storage and the Python-based polyglot workers (`document-extractor`, `pdf-refinery`).

## Current State & Bottlenecks
Currently, when a user attaches files in `ChatPage.tsx`, the frontend uploads them to the Blob service. When the user sends a message, `core/ai/chat.ts` synchronously downloads these blobs and uses Node-based parsers (`pdf-parse`, etc.) to extract the text and append it to the prompt.

**Issues with current state:**
1. **Synchronous overhead**: Large files block the chat response and cause timeouts.
2. **Context limits**: Appending entire large documents (e.g., 50-page PDFs) blows up the LLM context window.
3. **Duplication of effort**: `pdf-refinery` and `document` workers exist for exactly this but aren't utilized in the real-time chat flow.

## 🚀 Recommended Architecture

### 1. Asynchronous Upload & Trigger
Instead of waiting for the chat submission, document extraction should begin the moment a file is selected.
- **Frontend (`ChatPage.tsx`)**: User attaches a file. Component POSTs to `POST /blobs`.
- **Backend (`blobs/service.ts`)**: Upon saving the `Blob` to the DB and MinIO/Azure, it emits an event (e.g., via NATS or BullMQ): `blob.uploaded`.
- **Worker Router**: Routes to `pdf-refinery` (if `.pdf`) or `document-worker` (if `.docx`/`.xlsx`/`.pptx`).

### 2. Polyglot Extraction (Python Workers)
The workers pick up the `blob.uploaded` event:
- Download the raw file from MinIO/Azure.
- Pass it to the Python microservices (`FastAPI` extraction endpoints).
- Save the structured text back into the Database directly on the `Blob` model under a structured `analysis` JSON field (e.g., `extractedText`).
- Create an entry in `BlobActionLog` (Status: `extract-start` -> `extract-done`).

### 3. Chunking and Embeddings (RAG Preparation)
If the document is large (> 5000 tokens):
- The worker should automatically split it into chunks.
- Generate embeddings (e.g., via `text-embedding-3-large`).
- Store these chunks in the `DocumentChunk` Prisma model.

### 4. UI Feedback Loop
- The `ChatPage.tsx` UI should poll the blob status (or use SSE/WebSockets if available) referencing `BlobActionLog`.
- The attachment chip in the UI shows a "Processing..." spinner.
- Once the worker finishes, the UI changes to a green checkmark indicating it's ready to use.
- The user cannot "Send" the chat if a mandatory attachment is still processing (or they get a warning).

### 5. Smart Context Assembly (`core/ai/chat.ts`)
When the user clicks "Send" with `files: [blob_ids]`:
- The backend checks the `Blob` size and extracted chunks.
- **Small Documents (< 8k tokens)**: Directly retrieve `blob.analysis.extractedText` and inject it into the `systemPrompt`.
- **Large Documents (> 8k tokens)**: Perform a quick semantic search (RAG) using the user's `message` against the `DocumentChunk` table for the specific `blobId`. Inject only the top 5-10 matched chunks into the prompt.

## Implementation Steps

1. **Modify `Blob` upload API**: Add event emission logic (`blob.uploaded`) to trigger the worker pipeline.
2. **Update Workers**: Ensure the existing `document-worker` and `pdf-refinery` listen to this generic event and process it asynchronously.
3. **Add Status Endpoint**: Create `GET /blobs/:id/status` that checks the latest `BlobActionLog`.
4. **Update Frontend UI**: Add the polling/spinner logic to the `attachedFiles` state array in `ChatPage.tsx`.
5. **Update Chat API (`chat.ts`)**: Replace the synchronous parsing code with a DB lookup for `extractedText` or `DocumentChunks`.

## Summary
This plan ensures that attachments feel instant, never time out the chat, utilizes our premium Python parsers for high-quality text, and intelligently respects LLM context limits via RAG chunking.
