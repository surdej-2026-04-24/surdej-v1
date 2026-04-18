# Surdej Browser Extension Recipe

## 🎯 Objective
Create a browser extension for the Surdej environment that seamlessly integrates Surdej AI capabilities into the user's web browsing experience. The extension will feature a dedicated sidebar housing the Surdej platform via an iframe and will establish a two-way communication channel enabling an edge-based MCP (Model Context Protocol) Server for the frontend chat.

## 📋 Core Requirements

### 1. Structure and UI Components
- **Sidebar Integration:** 
  - The extension must inject a collapsible/toggleable sidebar into the active browser tab.
  - The sidebar will house an `<iframe>` rendering the Surdej frontend.
- **Welcome Page:** 
  - A friendly onboarding page displayed upon initial installation to guide the user on how to use the extension, configure their endpoint, and open the sidebar.
- **Options/Configuration Page:** 
  - A dedicated settings page allowing the user to configure extension preferences.
- **Extension Entrypoint & Authentication (`/extension`):**
  - The Surdej frontend loaded via the extension iframe MUST point to a dedicated extension entrypoint (`/extension`).
  - Upon loading this entrypoint, the frontend must test authentication and execute an MSAL popup auth constraint targeted towards the default tenant to securely authenticate the user.
- **Developer Integration Hub (`/developer`):**
  - A hub page within the Surdej frontend under `/developer` featuring options and playground tools for testing the extension integration natively before loading it strictly within the plugin sidebar.
  - The hub must be able to demonstrate the ability to interact with hosting pages. Ideally, the extension should support Playwright so everything can be controlled from inside Surdej.

### 2. Configuration & State Management
- **Endpoint Configuration:** 
  - The iframe URL should be configurable via the Options page.
  - **Default Endpoint:** `https://ai.example-tenant.net`
  - Users can add, select, or override custom Surdej frontend endpoints as their target.
- **Storage:** 
  - The configured endpoints and user preferences must be securely stored using synchronizeable extension storage (e.g., `chrome.storage.sync` or `browser.storage.sync`) so their settings persist across devices.

### 3. Communication Channel & MCP Server Integration
- **Content Script Messaging Layer:** 
  - The extension must provide a robust, secure communication channel (e.g., using `window.postMessage` and extension `runtime` ports) bridging the active host webpage (content script) and the iframe (Surdej frontend).
- **Frontend MCP Server Bridging:** 
  - The communication architecture should enable the Surdej frontend to create an **MCP (Model Context Protocol) server** that securely integrates the active browser tab's Context (DOM reading, page summaries, current URL) directly into the Surdej frontend chat interface.
  - *Goal:* Allow the Surdej AI model to contextually "see" or interact with what the user is currently browsing via this custom MCP transport.

## 🚀 Implementation Plan Outline
1. **Scaffold Extension with CRXJS:** Setup standard Manifest V3 extension boilerplate using **Vite and the `@crxjs/vite-plugin`** framework. Ensure background worker, content scripts, options page, and popup/sidebar are correctly integrated via the Vite configuration.
2. **Build Settings & Storage:** Create the configuration UI and wire up `chrome.storage.sync` for managing the iframe endpoints.
3. **Develop Surdej Base Features:** 
   - Add the new `/developer` page for testing the extension integration.
   - Add the dedicated `/extension` entrypoint ensuring MSAL popup authentication against the default tenant.
4. **Develop the Sidebar:** Inject the iframe into pages and build the toggle interaction. Wire the iframe `src` to the user's configured endpoint (specifically aimed at the `/extension` route).
5. **Implement the Comms Bridge:** Establish the message relay bridging the host page -> content script -> iframe window.
6. **Enable MCP Integration:** Define the custom MCP transport protocol within the iframe so Surdej's chat can natively query the content page.

---
*Note: Use this super prompt in combination with the `surdej-blend` workflow to systematically implement the code step-by-step.*