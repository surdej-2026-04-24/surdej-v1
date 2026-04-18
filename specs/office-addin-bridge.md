# 📎 Office Add-in Bridge Specification

> **Status**: Draft  
> **Author**: Surdej Team  
> **Date**: 2026-03-07  
> **Related**: `apps/extension/src/shared/protocol.ts`, `apps/frontend/src/core/extension/bridge.ts`

## 1. Overview

This specification describes a **Microsoft Office Add-in** (Word, Excel, PowerPoint) that establishes a 2-way communication bridge between Office documents and the Surdej chat interface. The add-in runs as a **task pane** inside Office apps, served from the frontend at **`/office-addin`** — sharing auth, components, and state. It communicates with the Surdej browser extension, which in turn exposes **MCP (Model Context Protocol) tool interfaces** to the AI chat — enabling the AI to read from and write to Office documents in real-time.

### 1.1 Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Microsoft Office (Word / Excel / PowerPoint)                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Office Add-in Task Pane (/office-addin route)        │    │
│  │  ┌────────────────┐  ┌─────────────────────────────┐    │    │
│  │  │ Office.js API  │  │ WebSocket / postMessage     │    │    │
│  │  │ (document I/O) │  │ bridge to extension         │    │    │
│  │  └───────┬────────┘  └──────────┬──────────────────┘    │    │
│  │          │                       │                       │    │
│  └──────────┼───────────────────────┼───────────────────────┘    │
│             │   Office.js host      │ WebSocket (localhost)      │
└─────────────┼───────────────────────┼────────────────────────────┘
              │                       │
              ▼                       ▼
┌──────────────────────┐   ┌──────────────────────────────────────┐
│  Office Document     │   │  Surdej Browser Extension            │
│  (docx/xlsx/pptx)    │   │  ┌────────────────────────────────┐  │
│                      │   │  │ Background Service Worker       │  │
│                      │   │  │ (WebSocket server relay)        │  │
│                      │   │  └────────────┬───────────────────┘  │
│                      │   │               │ chrome.runtime       │
│                      │   │               ▼                      │
│                      │   │  ┌────────────────────────────────┐  │
│                      │   │  │ Side Panel / Extension Page     │  │
│                      │   │  │ (Surdej Chat + MCP Tools)       │  │
│                      │   │  │                                 │  │
│                      │   │  │ ┌───────────────────────────┐   │  │
│                      │   │  │ │ Office Debug Panel        │   │  │
│                      │   │  │ │ (connection, doc state,   │   │  │
│                      │   │  │ │  command log, MCP tools)  │   │  │
│                      │   │  │ └───────────────────────────┘   │  │
│                      │   │  └────────────────────────────────┘  │
│                      │   └──────────────────────────────────────┘
└──────────────────────┘

AI Chat  ──MCP tools──▶  Extension  ──WebSocket──▶  Add-in  ──Office.js──▶  Document
         ◀──results───            ◀──responses───           ◀──data──────
```

## 2. Communication Protocol

### 2.1 Transport Layer

The Office Add-in task pane is a web view that cannot use `chrome.runtime` or content script injection. Instead, communication uses a **local WebSocket relay**:

1. The **extension's background service worker** runs a lightweight WebSocket server on `localhost:19850` (configurable)
2. The **Office Add-in task pane** connects to this WebSocket on load
3. Messages are relayed bidirectionally between the WebSocket and the extension's internal messaging (`chrome.runtime`)

### 2.2 Message Format

Messages follow the existing `surdej-bridge` protocol pattern but with Office-specific extensions:

```typescript
// ─── Namespace ─────────────────────────────────────────────────
export const OFFICE_BRIDGE_NAMESPACE = 'surdej-office-bridge';

// ─── Direction ─────────────────────────────────────────────────
type Direction = 'addin-to-extension' | 'extension-to-addin';

// ─── Request (either direction) ────────────────────────────────
interface OfficeBridgeMessage {
    namespace: typeof OFFICE_BRIDGE_NAMESPACE;
    id: string;               // Correlation ID
    direction: Direction;
    type: OfficeBridgeMessageType;
    payload?: unknown;
}

// ─── Response ──────────────────────────────────────────────────
interface OfficeBridgeResponse {
    namespace: typeof OFFICE_BRIDGE_NAMESPACE;
    id: string;
    direction: Direction;
    ok: boolean;
    data?: unknown;
    error?: string;
    durationMs?: number;       // Execution time for debug panel
}
```

### 2.3 Message Types

```typescript
type OfficeBridgeMessageType =
    // ─── Handshake ─────────────────────────────────────────────
    | 'HELLO'                  // Initial handshake (add-in → ext)
    | 'HELLO_ACK'              // Handshake acknowledgement (ext → add-in)
    | 'HEARTBEAT'              // Keep-alive ping (bidirectional)

    // ─── Document Read (extension → add-in) ────────────────────
    | 'GET_DOCUMENT_INFO'      // File name, path, saved state, app type
    | 'GET_DOCUMENT_CONTENT'   // Full document text/data
    | 'GET_SELECTION'          // Currently selected text/cells/shapes
    | 'GET_PROPERTIES'         // Document metadata (author, title, etc.)
    | 'SEARCH_TEXT'            // Search for text in document

    // ─── Word-specific (extension → add-in) ────────────────────
    | 'WORD_GET_PARAGRAPHS'    // Get all paragraphs with styles
    | 'WORD_GET_TABLES'        // Get table data
    | 'WORD_GET_HEADERS'       // Get headers/footers
    | 'WORD_GET_COMMENTS'      // Get document comments
    | 'WORD_GET_BOOKMARKS'     // Get bookmarks

    // ─── Excel-specific (extension → add-in) ───────────────────
    | 'EXCEL_GET_SHEETS'       // List all worksheets
    | 'EXCEL_GET_RANGE'        // Get cell range data
    | 'EXCEL_GET_USED_RANGE'   // Get the used range of a sheet
    | 'EXCEL_GET_CHARTS'       // Get chart info
    | 'EXCEL_GET_NAMED_RANGES' // Get named ranges
    | 'EXCEL_GET_FORMULAS'     // Get formulas in a range

    // ─── PowerPoint-specific (extension → add-in) ──────────────
    | 'PPTX_GET_SLIDES'        // Get slide count + titles
    | 'PPTX_GET_SLIDE'         // Get specific slide content
    | 'PPTX_GET_NOTES'         // Get speaker notes

    // ─── Document Write (extension → add-in) ───────────────────
    | 'INSERT_TEXT'            // Insert text at cursor/selection
    | 'REPLACE_TEXT'           // Find and replace text
    | 'INSERT_TABLE'           // Insert a table (Word/PPT)
    | 'SET_RANGE'              // Set cell values (Excel)
    | 'INSERT_IMAGE'           // Insert an image (base64)
    | 'ADD_COMMENT'            // Add a document comment
    | 'SET_PROPERTY'           // Set document metadata

    // ─── Word-specific write ───────────────────────────────────
    | 'WORD_INSERT_PARAGRAPH'  // Insert styled paragraph
    | 'WORD_INSERT_HEADER'     // Insert/update header/footer
    | 'WORD_APPLY_STYLE'       // Apply named style to selection

    // ─── Excel-specific write ──────────────────────────────────
    | 'EXCEL_SET_FORMULA'      // Set a formula in a cell
    | 'EXCEL_ADD_SHEET'        // Add a new worksheet
    | 'EXCEL_ADD_CHART'        // Create a chart from data
    | 'EXCEL_AUTO_FIT'         // Auto-fit column widths
    | 'EXCEL_SET_FORMAT'       // Apply number/date format

    // ─── PowerPoint-specific write ─────────────────────────────
    | 'PPTX_ADD_SLIDE'         // Add a new slide
    | 'PPTX_SET_NOTES'         // Set speaker notes
    | 'PPTX_INSERT_SHAPE'      // Insert a shape

    // ─── Events (add-in → extension, push-based) ──────────────
    | 'DOCUMENT_CHANGED'       // Document content changed
    | 'SELECTION_CHANGED'      // Selection changed
    | 'DOCUMENT_SAVED'         // Document was saved
    | 'DOCUMENT_CLOSED';       // Document was closed
```

## 3. MCP Tool Definitions

The extension registers these tools with the AI chat backend. They map 1:1 to bridge messages:

### 3.1 Tool Registry

```typescript
interface McpTool {
    name: string;
    description: string;
    parameters: Record<string, McpParameter>;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
}

const OFFICE_MCP_TOOLS: McpTool[] = [
    // ─── Universal Tools ───────────────────────────────────────
    {
        name: 'office_get_document_info',
        description: 'Get information about the currently open Office document (file name, type, saved state)',
        parameters: {},
    },
    {
        name: 'office_get_content',
        description: 'Get the full text content of the current document',
        parameters: {
            maxLength: { type: 'number', description: 'Max characters to return', default: 10000 },
        },
    },
    {
        name: 'office_get_selection',
        description: 'Get the currently selected text, cells, or shapes in the Office document',
        parameters: {},
    },
    {
        name: 'office_insert_text',
        description: 'Insert text at the current cursor position in the Office document',
        parameters: {
            text: { type: 'string', description: 'Text to insert', required: true },
            location: { type: 'string', enum: ['cursor', 'start', 'end', 'replace'], default: 'cursor' },
        },
    },
    {
        name: 'office_replace_text',
        description: 'Find and replace text in the Office document',
        parameters: {
            find: { type: 'string', required: true },
            replace: { type: 'string', required: true },
            matchCase: { type: 'boolean', default: false },
            replaceAll: { type: 'boolean', default: true },
        },
    },
    {
        name: 'office_search',
        description: 'Search for text in the document and return matching locations',
        parameters: {
            query: { type: 'string', required: true },
        },
    },
    {
        name: 'office_add_comment',
        description: 'Add a comment to the current selection in the document',
        parameters: {
            text: { type: 'string', required: true },
        },
    },

    // ─── Word Tools ────────────────────────────────────────────
    {
        name: 'word_get_paragraphs',
        description: 'Get all paragraphs from the Word document with their styles and formatting',
        parameters: {
            includeFormatting: { type: 'boolean', default: false },
        },
    },
    {
        name: 'word_get_tables',
        description: 'Get table data from the Word document as structured arrays',
        parameters: {},
    },
    {
        name: 'word_insert_paragraph',
        description: 'Insert a new paragraph with optional style',
        parameters: {
            text: { type: 'string', required: true },
            style: { type: 'string', description: 'Word style name (e.g. Heading1, Normal)', default: 'Normal' },
            location: { type: 'string', enum: ['before', 'after', 'start', 'end'], default: 'after' },
        },
    },
    {
        name: 'word_insert_table',
        description: 'Insert a table into the Word document',
        parameters: {
            rows: { type: 'array', description: 'Array of arrays representing rows and cells', required: true },
            hasHeader: { type: 'boolean', default: true },
        },
    },
    {
        name: 'word_get_comments',
        description: 'Get all comments from the Word document',
        parameters: {},
    },

    // ─── Excel Tools ───────────────────────────────────────────
    {
        name: 'excel_get_sheets',
        description: 'List all worksheets in the Excel workbook',
        parameters: {},
    },
    {
        name: 'excel_get_range',
        description: 'Get cell values from a specific range (e.g. "A1:D10") in a worksheet',
        parameters: {
            range: { type: 'string', description: 'Cell range like A1:D10', required: true },
            sheet: { type: 'string', description: 'Sheet name, defaults to active sheet' },
            includeFormulas: { type: 'boolean', default: false },
        },
    },
    {
        name: 'excel_set_range',
        description: 'Set cell values in a specific range',
        parameters: {
            range: { type: 'string', required: true },
            values: { type: 'array', description: '2D array of cell values', required: true },
            sheet: { type: 'string' },
        },
    },
    {
        name: 'excel_set_formula',
        description: 'Set a formula in a specific cell',
        parameters: {
            cell: { type: 'string', description: 'Cell reference like A1', required: true },
            formula: { type: 'string', description: 'Excel formula like =SUM(A1:A10)', required: true },
            sheet: { type: 'string' },
        },
    },
    {
        name: 'excel_add_chart',
        description: 'Create a chart from a data range',
        parameters: {
            dataRange: { type: 'string', required: true },
            chartType: { type: 'string', enum: ['bar', 'line', 'pie', 'scatter', 'area'], required: true },
            title: { type: 'string' },
            sheet: { type: 'string' },
        },
    },

    // ─── PowerPoint Tools ──────────────────────────────────────
    {
        name: 'pptx_get_slides',
        description: 'Get all slides with titles and content summaries',
        parameters: {},
    },
    {
        name: 'pptx_get_slide',
        description: 'Get detailed content of a specific slide',
        parameters: {
            slideIndex: { type: 'number', description: '0-based slide index', required: true },
        },
    },
    {
        name: 'pptx_add_slide',
        description: 'Add a new slide with title and content',
        parameters: {
            title: { type: 'string', required: true },
            body: { type: 'string' },
            layout: { type: 'string', enum: ['title', 'titleContent', 'blank', 'twoColumn'], default: 'titleContent' },
        },
    },
    {
        name: 'pptx_set_notes',
        description: 'Set speaker notes for a specific slide',
        parameters: {
            slideIndex: { type: 'number', required: true },
            notes: { type: 'string', required: true },
        },
    },
];
```

### 3.2 MCP Registration Flow

```
1. Add-in connects via WebSocket → sends HELLO { appType, documentName, version }
2. Extension receives HELLO → updates internal state → sends HELLO_ACK
3. Extension registers/updates MCP tools with the AI chat backend
4. AI chat uses tools → Extension sends bridge messages → Add-in executes Office.js calls
5. Add-in returns results → Extension forwards to AI → AI presents to user
```

## 4. Office Add-in Task Pane (Frontend Route)

The add-in task pane is a **route in the existing frontend app** at `/office-addin` rather than a separate standalone app. This provides huge benefits:

- **Shared auth** — MSAL login is already handled, no separate SSO flow needed
- **Shared components** — reuse Button, Badge, DropdownMenu, etc.
- **Shared state** — same zustand stores, i18n, tenant context
- **Single build** — no separate Vite config or deployment pipeline
- **Same origin** — avoids CORS issues between add-in and API

The Office.js script is loaded conditionally when running on the `/office-addin` route via a `<script>` tag or dynamic import.

### 4.1 Manifest

The manifest points to the frontend `/office-addin` route:

```xml
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
           xsi:type="TaskPaneApp">
    <Id>surdej-office-bridge</Id>
    <Version>1.0.0</Version>
    <ProviderName>Surdej</ProviderName>
    <DefaultLocale>da-DK</DefaultLocale>
    <DisplayName DefaultValue="Surdej Bridge" />
    <Description DefaultValue="2-way AI bridge between Office documents and Surdej" />

    <Hosts>
        <Host Name="Document" />   <!-- Word -->
        <Host Name="Workbook" />   <!-- Excel -->
        <Host Name="Presentation" /> <!-- PowerPoint -->
    </Hosts>

    <DefaultSettings>
        <!-- Points to the frontend route, NOT a separate app -->
        <SourceLocation DefaultValue="https://surdej.pages.dev/office-addin" />
    </DefaultSettings>

    <Permissions>ReadWriteDocument</Permissions>

    <Requirements>
        <Sets>
            <Set Name="SharedRuntime" MinVersion="1.1" />
        </Sets>
    </Requirements>
</OfficeApp>
```

### 4.2 Task Pane UI

The add-in task pane shows a minimal status UI:

```
┌─────────────────────────────────┐
│  Surdej Bridge         [status] │
│─────────────────────────────────│
│  📄 Report_Q4.docx (Word)      │
│  🟢 Connected to extension     │
│                                 │
│  Last command: GET_SELECTION    │
│  ⏱ 12ms                        │
│                                 │
│  ┌─────────────────────────┐   │
│  │ Recent Commands (5)     │   │
│  │ ─────────────────────── │   │
│  │ GET_DOCUMENT_INFO  4ms  │   │
│  │ GET_SELECTION     12ms  │   │
│  │ INSERT_TEXT        8ms  │   │
│  │ GET_PARAGRAPHS   45ms  │   │
│  │ REPLACE_TEXT      22ms  │   │
│  └─────────────────────────┘   │
│                                 │
│  [Reconnect]  [Open Surdej ↗]  │
└─────────────────────────────────┘
```

### 4.3 Technology Stack

| Component | Technology |
|---|---|
| Runtime | Office.js (loaded conditionally on `/office-addin` route) |
| UI | Shared React components from `apps/frontend` |
| Transport | WebSocket client (`ws://localhost:19850`) |
| Build | Part of the existing Vite frontend build — no extra config |
| Auth | Shared MSAL from `AuthContext` — already logged in |
| State | Shared zustand stores, i18n, tenant context |

## 5. Office Debug Panel (Extension Side)

A new debug tab in the extension's `ExtensionDebugContext` panel, visible when an Office add-in is connected.

### 5.1 Panel Layout

```
┌──────────────────────────────────────────────┐
│  📎 Office Bridge Debug                 [✕]  │
│──────────────────────────────────────────────│
│                                              │
│  Connection                                  │
│  ────────────                                │
│  Status:    🟢 Connected                     │
│  App:       Microsoft Word                   │
│  Document:  Årsrapport_2026.docx             │
│  WebSocket: ws://localhost:19850             │
│  Uptime:    14m 32s                          │
│  Latency:   8ms (avg)                        │
│                                              │
│  Document State                              │
│  ──────────────                              │
│  Modified:  Yes (unsaved changes)            │
│  Paragraphs: 47                              │
│  Tables:     3                               │
│  Comments:   12                              │
│  Selection:  "Q4 revenue exceeded..."        │
│                                              │
│  ┌ MCP Tools ──────────────────────────────┐ │
│  │ ✅ office_get_document_info  registered │ │
│  │ ✅ office_get_content        registered │ │
│  │ ✅ office_get_selection      registered │ │
│  │ ✅ word_get_paragraphs       registered │ │
│  │ ✅ word_get_tables           registered │ │
│  │ ✅ word_insert_paragraph     registered │ │
│  │ ✅ office_insert_text        registered │ │
│  │ ✅ office_replace_text       registered │ │
│  │ ⬚ excel_get_range            (Word)    │ │
│  │ ⬚ pptx_get_slides            (Word)    │ │
│  └──────────────────────────────────────────┘ │
│                                              │
│  Command Log                                 │
│  ───────────                                 │
│  17:32:04  → GET_DOCUMENT_INFO      4ms ✅   │
│  17:32:06  → GET_SELECTION         12ms ✅   │
│  17:32:08  → INSERT_TEXT            8ms ✅   │
│  17:32:15  ← SELECTION_CHANGED     (event)   │
│  17:32:18  → WORD_GET_PARAGRAPHS  45ms ✅   │
│  17:32:22  → REPLACE_TEXT          22ms ✅   │
│  17:32:22  ← DOCUMENT_CHANGED     (event)   │
│                                              │
│  ┌ Manual Test ────────────────────────────┐ │
│  │ Type: [GET_SELECTION        ▾]         │ │
│  │ Payload: { }                            │ │
│  │ [▶ Send]                                │ │
│  │                                         │ │
│  │ Response:                               │ │
│  │ { "text": "Q4 revenue exceeded...",     │ │
│  │   "startIndex": 1247,                   │ │
│  │   "endIndex": 1289 }                    │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### 5.2 Debug Panel Features

| Feature | Description |
|---|---|
| **Connection Status** | WebSocket state, reconnect attempts, latency measurement |
| **Document State** | Live view of document metadata, selection, modification state |
| **MCP Tool Registry** | Which tools are registered and available (greyed-out for wrong app type) |
| **Command Log** | Timestamped log of all bridge messages (both directions) with duration |
| **Manual Test** | Dropdown to select a message type, JSON payload editor, send button, and response viewer |
| **Event Stream** | Push events from the add-in (selection changed, document saved, etc.) |

### 5.3 Integration Point

Add a new tab `"office"` to the existing `ExtensionDebugContext.tsx` `TabContent` component:

```typescript
// In ExtensionDebugContext.tsx
type DebugTab = 'bridge' | 'page' | 'tools' | 'console' | 'office';

// The office tab is only visible when tools.officeConnected is true
```

## 6. Implementation Phases

### Phase 1: WebSocket Relay
- [ ] Add WebSocket server to extension's background service worker (`localhost:19850`)
- [ ] Add reconnection logic with exponential backoff
- [ ] Add message routing between WebSocket ↔ `chrome.runtime`
- [ ] Add HELLO/HEARTBEAT handshake

### Phase 2: Frontend Route + Office.js
- [ ] Create `/office-addin` route at `apps/frontend/src/routes/office-addin/OfficeAddinPage.tsx`
- [ ] Load Office.js conditionally (`<script>` or dynamic import)
- [ ] Detect app type (Word/Excel/PPT) via `Office.context.host`
- [ ] Implement WebSocket client connecting to extension relay
- [ ] Implement `GET_DOCUMENT_INFO`, `GET_SELECTION` for all three apps
- [ ] Build task pane UI showing connection status, document info
- [ ] Create `manifest.xml` pointing to the frontend route
- [ ] Add route to `App.tsx` router

### Phase 3: Document Read Tools
- [ ] Implement all `GET_*` message handlers using Office.js APIs
- [ ] Word: paragraphs, tables, headers, comments, bookmarks
- [ ] Excel: sheets, ranges, used range, charts, named ranges, formulas
- [ ] PowerPoint: slides, slide content, speaker notes
- [ ] Register read-only MCP tools with AI backend

### Phase 4: Document Write Tools
- [ ] Implement write message handlers (INSERT, REPLACE, SET, ADD)
- [ ] Add confirmation dialogs for destructive operations
- [ ] Register write MCP tools (behind `allow_office_write` permission)
- [ ] Add undo support (batch Office.js operations into undo groups)

### Phase 5: Debug Panel
- [ ] Add `office` tab to `ExtensionDebugContext`
- [ ] Connection status with latency display
- [ ] Live document state viewer
- [ ] MCP tool registry display (with app-type filtering)
- [ ] Command log with timestamps and duration
- [ ] Manual test interface (message type dropdown + payload editor)
- [ ] Event stream display for push events

### Phase 6: Events & Real-time
- [ ] Implement event handlers (DOCUMENT_CHANGED, SELECTION_CHANGED, DOCUMENT_SAVED)
- [ ] Add event-driven context injection into AI chat
- [ ] Auto-refresh document state in debug panel on events

## 7. Security Considerations

| Concern | Mitigation |
|---|---|
| **WebSocket exposure** | Bind to `localhost` only; require HELLO handshake with shared secret |
| **Document write** | Require explicit `allow_office_write` permission per session |
| **Data exfiltration** | Content truncation (max 10k chars by default); user consent prompt before reading |
| **Auth** | Reuse MSAL SSO token from extension; no separate login |
| **Destructive ops** | All write operations wrapped in `context.sync()` + undo groups |

## 8. File Structure

```
apps/frontend/src/
├── routes/office-addin/
│   ├── OfficeAddinPage.tsx         # Main task pane page component
│   ├── useOfficeJs.ts              # Hook: loads Office.js, detects app type
│   ├── useOfficeBridge.ts          # Hook: WebSocket connection + message handling
│   ├── handlers/
│   │   ├── shared.ts               # Universal handlers (info, selection, text)
│   │   ├── word.ts                 # Word-specific Office.js handlers
│   │   ├── excel.ts                # Excel-specific Office.js handlers
│   │   └── powerpoint.ts           # PowerPoint-specific Office.js handlers
│   └── components/
│       ├── ConnectionStatus.tsx     # Connection indicator + doc info
│       └── CommandLog.tsx           # Recent commands list
├── core/extension/
│   └── useOfficeBridgeState.ts     # Shared state for debug panel
└── routes/extension/
    └── OfficeDebugPanel.tsx         # Debug panel in /extension route

apps/extension/src/
├── background/
│   └── office-relay.ts             # WebSocket server + message relay
└── shared/
    └── office-protocol.ts           # Shared types

public/
└── office-addin/
    └── manifest.xml                 # Office add-in manifest
```

## 9. Example: AI Chat Interaction

```
User:  "Opsummér det åbne Word-dokument og tilføj en konklusion"

AI:    [Uses office_get_document_info]
       → { app: "Word", fileName: "Årsrapport_2026.docx", modified: true }

AI:    [Uses office_get_content]  
       → "1. Indledning\nÅrsrapporten for 2026 præsenterer de vigtigste..."  (8,432 chars)

AI:    [Uses word_get_paragraphs]
       → [{ text: "1. Indledning", style: "Heading1" }, ...]

AI:    "Dokumentet er en årsrapport med 5 sektioner: Indledning, 
       Økonomi, Medarbejdere, Strategi og Risici. Det er p.t. 
       ikke gemt. Skal jeg tilføje en konklusion?"

User:  "Ja, tilføj den med Heading1 stil"

AI:    [Uses word_insert_paragraph { text: "6. Konklusion", style: "Heading1" }]
AI:    [Uses word_insert_paragraph { text: "Samlet set viser 2026...", style: "Normal" }]

AI:    "Konklusion tilføjet som afsnit 6. Du kan se den i bunden af dokumentet."
```
