---
name: surdej-new-extension-tool
description: Interactively scaffold a new context-aware extension tool panel with hostname detection, bridge integration, and optional sub-views
---

## Objective
Guide the user through creating a new context-aware tool for the browser extension's side panel.
Extension tools appear conditionally based on the page the user is browsing and integrate with
the chat UI via prompt injection and the bridge protocol.

## Architecture Reference

The extension tool system has four layers:

1. **Context detection** — `getContextTools()` in `apps/frontend/src/routes/extension/ExtensionPage.tsx`
2. **Panel component** — a React component in `apps/frontend/src/routes/extension/`
3. **Bridge protocol** — message types in `apps/extension/src/shared/protocol.ts`
4. **Tool management** — registration in `modules/tool-management-tools/worker/src/routes.ts`

## Instructions for the Agent

### Step 1 — Interview the User

Ask these questions (skip any the user already answered):

1. **Hostname / context trigger**: Which websites should activate this tool?
   - Exact domain (e.g. `example.com`) or suffix match (`.example.com`)?
   - Any additional conditions? (form fields, URL patterns, page content)

2. **Tool identity**:
   - Tool ID (kebab-case, e.g. `my-service-data`)
   - Display label and short description
   - Icon from `lucide-react` (suggest one based on the description)
   - Default prompt to inject into chat when the tool button is clicked

3. **Panel component**:
   - Does the tool need a collapsible panel below the toolbar? (like PDF RefineryToolsPanel)
   - If yes, what does the panel display? (data tables, previews, forms, etc.)

4. **Sub-views**: Does the panel need multiple tabs/views?
   - If yes, list each sub-view with a name and purpose.

5. **Bridge needs**: Does the tool need to interact with the host page?
   - Existing bridge actions: `FETCH_PAGE`, `GET_PAGE_TEXT`, `GET_SELECTION`,
     `QUERY_SELECTOR`, `CLICK_ELEMENT`, `FILL_INPUT`, `GET_FORM_FIELDS`,
     `FETCH_IMAGE`, `GET_XSRF_TOKEN`, `EXECUTE_SCRIPT`, `GET_PAGE_SNAPSHOT`
   - Need a new bridge action? Describe what it should do.

6. **Tool management**: Which use cases should this tool belong to?
   - Existing: `quick-research`, `analyze-document`, `prospect-lookup`,
     `generate-marketing`, `improve-text`, `general`
   - Or define a new use case.

### Step 2 — Generate the Implementation

Once answers are gathered, create/modify files in this order:

#### 2a. Add ContextTool entry

Edit `apps/frontend/src/routes/extension/ExtensionPage.tsx`:

- In `getContextTools()`, add a new hostname block **following the existing pattern**:

```typescript
// [hostname] tools
if (hostname && hostname.endsWith('[domain]')) {
    tools.push({
        id: '[tool-id]',
        icon: [LucideIcon],
        label: t('extension.tool[Name]'),
        description: t('extension.tool[Name]Desc'),
        prompt: '[default prompt text]',
    });
}
```

- Add the corresponding i18n keys to the translation files (search for existing
  `extension.tool` keys to find the right files).
- Import the Lucide icon at the top of the file if not already imported.

#### 2b. Create the Panel Component (if needed)

Create `apps/frontend/src/routes/extension/[Name]ToolsPanel.tsx` following this template:

```typescript
import { useState } from 'react';
import { cn } from '@/lib/utils';
// Import Lucide icons as needed

// ─── Types ──────────────────────────────────────────────────────────
interface [Name]ToolsPanelProps {
    onInjectPrompt?: (prompt: string) => void;
}

// If sub-views are needed:
type [Name]View = 'view-a' | 'view-b';

export default function [Name]ToolsPanel({ onInjectPrompt }: [Name]ToolsPanelProps) {
    const [view, setView] = useState<[Name]View>('view-a');

    return (
        <div className="flex flex-col h-full">
            {/* Tab bar (only if sub-views) */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/20 shrink-0">
                <button
                    onClick={() => setView('view-a')}
                    className={cn(
                        'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                        view === 'view-a'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {/* Icon + label */}
                </button>
                {/* More tab buttons... */}
            </div>

            {/* View content */}
            <div className="flex-1 overflow-y-auto">
                {view === 'view-a' && <ViewA onInjectPrompt={onInjectPrompt} />}
                {view === 'view-b' && <ViewB onInjectPrompt={onInjectPrompt} />}
            </div>
        </div>
    );
}
```

**Key patterns to follow:**
- Use `onInjectPrompt` to send data to the chat input for AI analysis.
- Use the bridge (`import { ... } from '@/core/extension/bridge'`) for host page interaction.
- Use `text-[10px]` for compact UI in the side panel.
- Keep the panel height bounded (`max-h-[50%]` is applied by the parent).

#### 2c. Wire the Panel into ExtensionPage

In `apps/frontend/src/routes/extension/ExtensionPage.tsx`:

1. Add state for the panel toggle:
```typescript
const [[name]Open, set[Name]Open] = useState(false);
```

2. Add a boolean for hostname detection:
```typescript
const is[Name] = hostname && hostname.endsWith('[domain]');
```

3. Add a toggle button in the toolbar (near the existing tool toggles):
```typescript
{is[Name] && (
    <Button
        variant="ghost"
        size="icon"
        className={cn('h-6 w-6', [name]Open && 'bg-accent')}
        onClick={() => set[Name]Open(![name]Open)}
        title="[Tool label]"
    >
        <[Icon] className="h-3.5 w-3.5" />
    </Button>
)}
```

4. Add the collapsible panel section (near existing panel sections):
```typescript
{is[Name] && [name]Open && (
    <div className="border-b max-h-[50%] overflow-y-auto">
        <[Name]ToolsPanel
            onInjectPrompt={(prompt) => {
                setInput(prompt);
                inputRef.current?.focus();
            }}
        />
    </div>
)}
```

#### 2d. Extend Bridge Protocol (if new actions needed)

In `apps/extension/src/shared/protocol.ts`:
- Add the new action to the `BridgeRequestType` union.

In `apps/extension/src/content/content-script.ts`:
- Add a handler case for the new action type.

#### 2e. Register in Tool Management

In `modules/tool-management-tools/worker/src/routes.ts`, add to the `BUILT_IN_TOOLS` array:

```typescript
{
    id: crypto.randomUUID(),
    name: '[tool_name]',
    label: '[Tool Label]',
    description: '[Description]',
    category: 'integration',  // or 'search', 'context', 'general'
    icon: '[LucideIconName]',
    isEnabled: true,
    isBuiltIn: true,
    useCases: ['[use-case-1]', '[use-case-2]'],
    promptTemplate: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
},
```

### Step 3 — Verify

- Confirm all new imports are added.
- Confirm i18n keys exist for labels/descriptions.
- Run `pnpm typecheck` to verify no type errors.
- If a new bridge action was added, verify the content script handles it.

### Step 4 — Summary

Print a summary of all files created/modified.
