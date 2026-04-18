# Implementation Plan: Browser Extension

**Super Prompt Focus:** Create a Surdej-integrated CRXJS browser extension, with an `iframe` sidebar pointing to `/extension`, a `/developer` hub, built-in communication bridge, and MCP server enabling Playwright capabilities inside the host page.

## Checklist

- [x] **Step 1: Scaffold Extension Workspace**
  - Create a new CRXJS/Vite app in `apps/extension`.
  - Setup Manifest V3 boilerplate (Background script, Content scripts, Popup/Options page).
  - Configure `chrome.storage.sync` setup for endpoint management (default: `https://ai.example-tenant.net`).
- [x] **Step 2: Frontend Base Features (`apps/frontend`)**
  - ~~Scaffold the `/developer` route as an Integration Hub~~ (already exists at `/developer`).
  - Scaffold the `/extension` route specifically for the iframe, triggering MSAL popup authentication against the default tenant.
- [x] **Step 3: Sidebar Interaction & Injection**
  - Implement background service worker with `chrome.sidePanel.setPanelOnActionClick`.
  - Side panel iframe loads the configured endpoint + `/extension`.
  - Endpoint managed via `chrome.storage.sync` and background messaging.
- [x] **Step 4: Extension Comms Bridge & MCP Transport**
  - Shared protocol types in `apps/extension/src/shared/protocol.ts`.
  - Content script rewritten as lightweight bridge relay (`content/main.tsx`) — handles DOM queries, page snapshots, element clicks, input filling.
  - Frontend bridge client (`core/extension/bridge.ts`) with typed async API.
  - React hook (`core/extension/useBridge.ts`) for reactive bridge state.
  - ExtensionPage auto-injects page context (URL, title, headings, text) into AI conversations.
- [ ] **Step 5: Documentation Updates**
  - Update architecture and developer documentation in the `docs/` folder outlining the Extension bridge, usage, and local testing configurations.
