# ChatGPT Alternative Specification: "Surdej Chat"

## 1. Overview
The goal of this specification is to enhance the existing Surdej chat interface to serve as a fully functional replacement for ChatGPT/Claude for generic work tasks. It will support multimodal interactions, file uploads (Office & PDFs), internet research capabilities via agentic reasoning, and execute data processing via a hybrid Python/TypeScript worker.

## 2. Core Capabilities

### 2.1 Universal File Support
The chat should allow users to drag-and-drop or upload various file types directly into the conversation:
- **Office Documents:** `.docx`, `.xlsx`, `.pptx`
- **PDFs:** Standard and scanned PDFs (re-using Azure Document Intelligence/Mistral OCR)
- **Text & Code:** `.txt`, `.csv`, `.json`, `.md`, `.py`, `.ts`, etc.
- **Images:** `.jpg`, `.png`, `.webp` (for vision-model analysis)

### 2.2 Agentic Web Research (RAG + Search)
When a user asks a question requiring external knowledge, the chat backend should spawn an agentic thought process:
1. Identify if external knowledge is needed.
2. Formulate search queries (e.g., using Bing Search API, Google Custom Search, or Tavily).
3. Fetch top results, scrape URL contents, and summarize them.
4. Synthesize the final response with inline citations answering the user's prompt.

### 2.3 Local Sandbox Execution ("Advanced Data Analysis")
Similar to ChatGPT's Code Interpreter, the platform will utilize a dedicated backend worker to execute Python code in a sandboxed environment to process files, clean data, generate charts, and solve mathematical problems.

---

## 3. Architecture

### 3.1 Frontend (Chat Interface)
- **File Uploader:** Add a paperclip/upload icon to the chat input supporting multi-file selection.
- **Attachment Pills:** Display uploaded files as pills above the input box before sending.
- **Progress Indicators:** Show real-time progress for file processing or web research ("Thinking...", "Searching the web...", "Running python...").
- **Message Rendering:** Support markdown, syntax highlighting, chart rendering, and inline file download links for generated assets.

### 3.2 Main API Backend (`apps/api`)
- **Chat Router:** A unified `/api/chat/completions` endpoint that handles the overarching routing.
- **Blob Storage Integration:** Handle incoming file uploads, store them in MinIO (or Azure Blob), and attach a reference to the conversation state.
- **Tool Calling Orchestrator:** Use LLM tool-calling (function calling) capabilities to decide whether to:
  - Call `search_web(query)`
  - Call `read_file(blob_id)`
  - Call `run_python(code)`

### 3.3 Hybrid Data Processing Worker (`workers/data-sandbox`)
We will create a new worker, architecturally similar to `workers/pdf-refinery`, but specifically tailored for ad-hoc data processing and code execution triggered by chat.

**Hybrid Container (TypeScript + Python):**
- **TypeScript (Node.js):** Handles NATS JetStream connectivity, job coordination, and status reporting back to the API.
- **Python (3.11+):** Handles the actual heavy lifting for document processing and code execution.
- **Key Python Libraries to include:**
  - `pandas`, `openpyxl`, `python-docx`, `python-pptx` (for Office docs)
  - `pymupdf`, `pdfplumber` (for PDF manipulation)
  - `matplotlib`, `seaborn`, `plotly` (for chart generation)
  - `beautifulsoup4`, `requests` (for web scraping if delegated to worker)

---

## 4. LLM Recommendations

To achieve true ChatGPT-level reasoning and function calling, the choice of LLM is critical. A multi-model routing strategy is recommended depending on the task's complexity:

### 1. Primary Workhorse (Reasoning & Tool Calling)
**Recommendation: GPT-4o (Azure OpenAI) or Claude 3.5 Sonnet (Anthropic)**
- *Why:* Unmatched at complex tool-calling (agentic workflows) and following multi-step instructions without getting stuck in loops. They both natively support image inputs (Vision).
- *Use-case:* Understanding complex user requests, deciding to search the web, writing Python code, generating final synthesized answers.

### 2. Fast/Cheap Processing (Summarization & Simple Queries)
**Recommendation: GPT-4o-mini or Claude 3 Haiku**
- *Why:* Extremely fast and cost-effective.
- *Use-case:* Summarizing long scraped web pages, extracting key entities from a basic document, quick conversational replies.

### 3. Specialized Data Extraction (if needed)
**Recommendation: Mistral Large 2 or Gemini 1.5 Pro**
- *Why:* Gemini 1.5 Pro has a massive 2M token context window, perfect for dumping entire books or massive codebases into the prompt without needing chunked RAG. Mistral is great for structured European/local language tasks.

---

## 5. Implementation Plan (Phases)

### Phase 1: Core Chat & File Uploads
1. Build the UI for drag-and-drop file uploads in the chat component.
2. Create API endpoints to upload files temporarily to Blob Storage and link them to a chat session.
3. Integrate LangChain or Vercel AI SDK on the backend to append file contents (text/markdown) directly into the LLM context prior to answering.

### Phase 2: Hybrid Data Sandbox Worker (`workers/data-sandbox`)
1. Create `workers/data-sandbox/Dockerfile` installing Node.js + Python 3.11 + core data science and Office parsing libraries.
2. Implement NATS subscriber for topics like `job.sandbox.execute_python` and `job.sandbox.extract_office`.
3. Give the LLM a `run_python(code)` tool. When triggered, the API sends the code via NATS to the worker, waits for stdout/stderr or generated file IDs, and returns it to the LLM.

### Phase 3: Agentic Web Capabilities
1. Integrate a search API provider (Tavily is highly recommended for RAG as it summarizes results specifically for LLMs).
2. Give the LLM a `search_web(query)` tool.
3. Implement a streaming reasoning UI on the frontend so users see "Searched for X...", "Read 3 pages...", before the final answer arrives.

## 6. Security Considerations
- **Sandboxing:** Python execution inside the worker must run without network access (if possible, or restricted to allowed domains) to prevent malicious code execution. Avoid mounting sensitive host directories.
- **Tenant Isolation:** Files generated or processed must strictly abide by tenant isolation logic in Blob Storage.
- **Timeouts:** Hard timeouts (e.g., 60 seconds) on Python execution to prevent infinite loops.
