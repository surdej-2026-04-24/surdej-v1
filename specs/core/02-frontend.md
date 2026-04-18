# 02 — Frontend

## Overview

A single React 19 frontend application. The skinning system controls which navigation
items and features are visible per deployment. Domain modules extend the UI via
manifest-based discovery (see spec 16).

## Core Dependencies

| Category | Packages |
|----------|----------|
| **Framework** | React 19, React Router 7.9, Vite 7.2 |
| **Styling** | Tailwind CSS 3.4, class-variance-authority |
| **UI Components** | Shadcn UI (Radix primitives), Lucide React icons, cmdk (command palette) |
| **State** | React Context (Auth, Features, Feedback, Accessibility), Zustand (skins, commands) |
| **AI** | Vercel AI SDK React hooks (`useChat`) — streams from API, no direct provider calls |
| **Auth** | `@azure/msal-browser`, `@azure/msal-react` |
| **SharePoint** | PnPjs (`@pnp/graph`, `@pnp/sp`) |
| **Editor** | Monaco Editor (`@monaco-editor/react`) |
| **Maps** | Leaflet + React-Leaflet |
| **Animation** | Framer Motion |
| **Export** | jspdf, jszip, html2canvas, gifenc |
| **Misc** | react-markdown, yaml, vite-plugin-pwa, react-zoom-pan-pinch |

## Design Tokens & Theming

### CSS Custom Properties (Layer 1)

HSL-based tokens defined in `index.css`:

- Background, foreground, card, popover, muted, accent, destructive
- Primary, typography, corner radii — defined per skin/brand
- Chart palette: 5-color series

### Accessibility (Layer 2)

Managed by `AccessibilityContext`:

| Feature | Options |
|---------|---------|
| Theme | Light / Dark |
| High Contrast | On / Off (AAA 7:1 ratios, `.high-contrast` CSS class) |
| Font Scaling | 100% / 110% / 125% / 150% (root `rem` scaling) |
| Reduce Motion | On / Off (`prefers-reduced-motion` support) |

Settings persisted to `localStorage`. UI at Settings → Accessibility.

### Skinning System (Layer 3)

Three-layer architecture: **Skin Layer → Command Layer → Target Layer**

- Zustand store + IndexedDB persistence
- Skins control sidebar navigation: items, order, visibility
- Navigation items map to **commands** (not routes)
- **Command Registry**: singleton with register/execute/search. Well-known commands for nav routes, skin management, and tools
- **Command Palette (⌘K)**: shadcn Command component (cmdk), fuzzy search, grouped results, recent history
- Built-in skins: Default (full nav), Minimal (Home, Chat, Settings)
- SkinEditor: drag-and-drop sidebar customisation, clone, export/import

## Application Layout

Single layout shell in `routes/layout.tsx`. All regions wrapped in `WireframeElement` for
inspection. Provider hierarchy:

```
RootLayout
├── LanguageProvider
├── FeedbackProvider
├── ChatHistoryProvider
└── WireframeProvider
    └── RootLayoutInner (the visual shell)
```

### Visual Anatomy

```
┌──────────────────────────────────────────────────────────┐
│ Sidebar (264px, collapsible)  │  Header / Topbar         │
│                               │  ┌─────────────────────┐ │
│  ┌─ SidebarHeader ──────────┐ │  │ Hamburger │ Bread-  │ │
│  │  Logo + brand name       │ │  │ /collapse │ crumbs  │ │
│  └──────────────────────────┘ │  └─────────────────────┘ │
│                               │  ┌── HeaderToolbar ────┐ │
│  ┌─ SidebarNav ─────────────┐ │  │ Feedback │ Lang │   │ │
│  │  Skin-driven nav items   │ │  │ QuickChat│ Help │   │ │
│  │  (from active skin's     │ │  │ Tools    │ Theme│   │ │
│  │   sidebar commands)      │ │  │ Fullscreen│ Status│ │ │
│  └──────────────────────────┘ │  └─────────────────────┘ │
│                               │                          │
│                               │  ┌── Main Content ─────┐ │
│  ┌─ SidebarFooter ──────────┐ │  │  <Outlet />          │ │
│  │  User avatar + dropdown  │ │  │  (routed pages)      │ │
│  │  (profile, logout, etc.) │ │  │                      │ │
│  └──────────────────────────┘ │  └──────────────────────┘ │
│                               │                          │
│                               │  ┌── Footer ───────────┐ │
│                               │  │ About │ SkinName ⌘K │ │
│                               │  └──────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Sidebar

- 264px fixed width on desktop, slide-out drawer on mobile
- **SidebarHeader**: logo + brand name (from active skin)
- **SidebarNav**: dynamic items from active skin's `sidebar.items`, each resolved via
  the command registry (icon, label, route all come from the command)
- **SidebarFooter**: user avatar dropdown (profile, settings, logout)

### Header Toolbar

Right-aligned toolbar buttons:

| Button | Icon | Action |
|--------|------|--------|
| Feedback | Camera/Mic/Video | Start/manage feedback session (see Feedback below) |
| Language | Globe | Language selector dropdown (en/da) |
| Quick Chat | MessageCircle | Toggle chat flyover (see Quick Chat below) |
| Help | HelpCircle | Open help panel |
| Tools | LayoutGrid | Dropdown: Install PWA, Wireframe Mode |
| Theme | Sun/Moon | Toggle light/dark |
| Fullscreen | Maximize/ExternalLink | Fullscreen or open-in-new-window (iframe mode) |
| Status | ServiceStatusIndicator | API connection health |

### Footer

- Left: "About" link
- Right: `CommandPaletteFooterTrigger` (shows active skin name + ⌘K button) + GitHub icon

## Wireframe Mode

A toggle-able inspection mode that reveals the component structure of the UI.
Activated from **Tools → Wireframe Mode** in the header toolbar.

### How It Works

- `WireframeProvider` context holds a boolean `wireframeMode` state
- `WireframeElement` wrapper component wraps every high-level layout region
- When **off**: children render normally (transparent passthrough)
- When **on**: each wrapped region shows:
  - Dashed outline (dark red for depth 1, blue for depth 2, emerald for depth 3)
  - Floating label pill at top-left with component name + description
  - Copy-to-clipboard button on the label
  - Children opacity reduced to 0.7
- **Escape** key exits wireframe mode; floating "Exit Wireframe" button at bottom-right

### Wrapped Elements

Every high-level component is wrapped:

```tsx
<WireframeElement name="Sidebar" description="Main navigation">
<WireframeElement name="SidebarHeader" description="Logo and branding">
<WireframeElement name="SidebarNav" description="Navigation links">
<WireframeElement name="SidebarFooter" description="User profile">
<WireframeElement name="Breadcrumb" description="Navigation path">
<WireframeElement name="HeaderToolbar" description="Action buttons">
<WireframeElement name="QuickChatButton" description="Open AI chat">
<WireframeElement name="HelpButton" description="Open help">
<WireframeElement name="ToolsMenu" description="App tools dropdown">
<WireframeElement name="ThemeToggle" description="Toggle theme">
<WireframeElement name="Footer" description="App footer with links">
<WireframeElement name="HelpPanel" description="Documentation fly-in">
```

Domain modules should wrap their own high-level components the same way.

## Component Identity (Ctrl+Option+Hover) — NEW

An evolution of wireframe mode for **dev mode only**. When the user holds
**Ctrl+Option** (⌃⌥) and hovers over any component, a tooltip appears showing:

- **Component name** (e.g. `SidebarNav`)
- **Source file path** (e.g. `routes/layout.tsx:342`)
- **Click to open in editor** — calls the Helper API to open the file in VS Code

This uses the `data-component` attribute convention:

```tsx
<div data-component="SidebarNav" data-source="routes/layout.tsx:342">
  {/* ... */}
</div>
```

A global `DevInspector` component (mounted only when `import.meta.env.DEV`) listens
for `mouseover` events while Ctrl+Option are held, reads the nearest `data-component`
ancestor, and renders the tooltip. Clicking calls `helperClient.openInEditor()`.

This is complementary to wireframe mode: wireframe shows the full structure at once,
component identity inspects one element at a time.

## Helper API (Dev Mode Only)

A local Express server (`apps/helper/`) that bridges the frontend to the developer's
editor. Only runs during development. Binds to `127.0.0.1` (localhost only).

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Status check — returns `{ status, editor, projectRoot }` |
| `/open` | POST | Open file in VS Code — `{ path, line? }` → `code --goto` |
| `/read` | GET | Read file contents or directory listing |
| `/token` | GET | Session token (origin-restricted, no auth header) |

### Security

- Bearer token auth on all endpoints (except `/token` which is origin-restricted)
- Token auto-generated on startup, written to `.helper-token` file in project root
- Rate limiting per endpoint
- Path validation: only files within project root allowed
- File type allowlist (`.ts`, `.tsx`, `.md`, etc.), binary files blocked
- Token rotation on `SIGHUP`

### Frontend Client

`lib/helper-client.ts` — singleton `HelperClient` configured via `VITE_HELPER_PORT`
and `VITE_HELPER_TOKEN` env vars. Methods: `checkHealth()`, `openInEditor(path, line?)`,
`read(path)`. Returns `null` / is unavailable in production builds.

## Quick Chat (Toolbar Flyover)

A compact AI chat flyover triggered from the header toolbar's **MessageCircle** icon.

- Fixed-position panel (420px wide) anchored to top-right with semi-transparent backdrop
- **Streaming responses** from the API's `/api/ai/chat` endpoint (SSE)
- Message bubbles with user/assistant avatars, copy-to-clipboard
- Suggestion prompts when empty
- **Escape** to close, **Enter** to send, **Shift+Enter** for newline
- **"Open full chat →"** link navigates to `/chat` route
- Clear chat and maximise buttons in header

The quick chat does **not** persist history — it's for quick questions without
leaving the current page. Full chat at `/chat/[id]` has persistent conversations.

## Integration Boundary

The **REST API is the only integration point** between the frontend and the rest of the
platform. The frontend never imports or calls:

| ❌ Never in Frontend | ✅ Use Instead |
|---------------------|----------------|
| `@ai-sdk/azure`, `@ai-sdk/openai`, `@ai-sdk/anthropic` | `useChat()` streaming from `/api/ai/chat` |
| `nats` / `nats.ws` | API endpoints that dispatch jobs internally |
| `@prisma/client` | API endpoints for all data access |
| `@azure/keyvault-secrets` | API handles secrets server-side |
| `@microsoft/microsoft-graph-client` | API proxies Graph calls (except MSAL token acquisition) |

The only direct external connection the frontend makes is **MSAL authentication** (Entra ID
token acquisition in the browser). Everything else flows through the API.

## State Management

| Context | Purpose |
|---------|---------|
| `AuthContext` | User identity, roles, login/logout, demo mode |
| `FeatureContext` | Feature flag evaluation (`useFeature()` hook) |
| `FeedbackContext` | Screenshot capture, annotations, multimedia feedback |
| `AccessibilityContext` | Theme, contrast, font size, motion preferences |
| Zustand stores | Skin configuration, command registry |

## Key Routes / Pages (Core)

| Route | Description |
|-------|-------------|
| `/` | Home / Dashboard |
| `/chat/[id]` | AI Chat with streaming |
| `/settings` | App settings |
| `/settings/features` | Feature flag toggles |
| `/settings/accessibility` | Accessibility preferences |
| `/feedback` | Feedback session list |
| `/feedback/[id]` | Feedback session detail |
| `/presentation` | About / presentation page |

Domain routes are added by domain manifests (see spec 16) and live under `/domains/<id>/`.

## Feedback & Annotation System

Multi-media feedback sessions managed by `FeedbackContext`:

1. **Start session** — modal with title/description → creates session in IndexedDB
2. **During session** — toolbar shows inline controls:
   - 📷 Screenshot (3-second countdown, then `html2canvas` capture → annotation editor)
   - 🎤 Voice recording (`MediaRecorder` via `getUserMedia`)
   - 📹 Video recording (screen capture via `getDisplayMedia`)
   - ⏸️ Pause/Resume, ⏹️ Stop session
3. **Navigation tracking** — URL changes during session auto-logged with timestamps
4. **Annotation Editor** — full canvas-based editor with tools:
   - Arrow, rectangle, text, circle, blur
   - Colors, line widths, font sizes/families
   - Undo/redo, z-ordering
5. **Complete session** → navigates to `/feedback/[id]` detail page
6. **Export** — PDF (jspdf) and ZIP (jszip)
7. **Storage** — all data in IndexedDB (sessions store + blobs store)

Feedback can also be started from the **Help Panel** ("Start Support Session" button).

---

*Core frontend specification. Domain-specific pages and components are documented
in their respective domain specs.*
