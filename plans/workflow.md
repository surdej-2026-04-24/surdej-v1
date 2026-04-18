# Workflow Management System (Extended Use Cases)

> **Goal**: Evolve the existing "Use Cases" system into a fully-fledged, multi-step **Workflow Management System**. Admins will define structured procedures ("todos") and guide end-users step-by-step through complex tasks using targeted system prompts, specific MCP tools, and deterministic schema-driven UI forms. The system will feature an AI-guided creation wizard and live integration into the browser extension.

---

## 1. Core Workflow Concepts

### 1.1 Workflow Template (formerly Use Case)
Instead of a single AI prompt, a Use Case becomes a structured workflow template. It encapsulates a list of `tasks` (a `todo` list). 

For each **task (step)**, the definition contains:
- **System Prompt**: A highly specialized system prompt applied on top of the workflow's global context. It directs the AI on how to behave for this specific step.
- **MCP Tools**: A scoped array of tools activated specifically for this step.
- **Data Schema**: A JSON schema (configured in YAML format) that defines the exact information to be gathered before the step is deemed complete.

### 1.2 Session (Workflow Runtime)
When a user begins a Workflow Use Case, it creates a **Session**.
- A session is stateful and stored in the database.
- It tracks the active step, gathered data fields, and the cumulative context.
- **Context Versioning**: Each step progression creates a restorable snapshot in the DB. This allows the user to step back and automatically revert the document state and AI context to a prior checkpoint.

---

## 2. Admin & Creation UX (Phased Implementation)

### 2.1 Phase 1 — Live Workflows in Toolbar & Extension
Instead of hardcoded `BUILT_IN_USE_CASES`, the extension header and tools must read active DB Use Cases/Workflows dynamically:
- **New API endpoint**: `GET /use-cases/active` returns active workflows merging DB versions with built-in fallbacks.
- **Header Toolbar**: Opens the puzzle icon dialog displaying dynamically fetched workflows.
- **Extension UI**: Replaces static selection with the dynamic database selection, hydrating system prompt limits and tasks dynamically.

### 2.2 Phase 2 — AI Interview Wizard for Workflow Creation
Replace the plain `/modules/tool-management-tools/use-cases/new` form with a guided AI chat.
- **Interactive Wizard**: The admin chats with an AI to design the workflow.
- **Auto-Drafting Steps**: The AI asks about the goals and then outputs a structured JSON proposal matching the multi-step `todo` schema.
- **Live Preview**: The right panel updates with the proposed workflow tasks, system prompts, schemas, and tools for each step. The admin can tweak the schema/prompts manually before saving.

### 2.3 Phase 3 — AI-Suggested Test Cases
After generating a workflow template:
- Provide a "✨ Suggest Test Cases" button next to the workflow.
- Calling `/api/module/tool-management-tools/use-cases/:id/suggest-tests` analyzes the active `todo` structure and generates diverse test scenarios (mocking step progression or user inputs) and evaluation criteria.

### 2.4 Phase 4 — File Uploads (Global & Workflow Level)
- **Workflow Scope**: Support attaching reference documents (PDFs, templates, etc.) directly to the workflow definition itself (e.g. "always use this company policy manual for step 2").
- **Test Case Scope**: Attach test-specific documents to validate that the steps correctly extract constraints.

---

## 3. End-User Runtime UX (Extension Panel)

The primary interface for executing sessions is the Browser Extension Panel.

### 3.1 Task UI Layout
- **Task Header**: Prominent indicator tracking progress (e.g., "Step 2 of 5: Draft Outreach").
- **Step UI Form**: A form automatically generated from the step's JSON definition. 
- **AI Agent Area**: The chat area restricted to the current step's system prompt and toolset.

### 3.2 System Prompt Awareness & Data Gathering
- Natively inject **Schema Awareness** into the system prompt for every step. The AI specifically hunts for the missing information in the YAML requirements via the user's input or MCP tool execution.

### 3.3 Navigation and Gating
- **Next Step**: Locked until all `required` fields from the active step's YAML schema are fully collected. Once complete, the user accepts/modifies the data and clicks "Next".
- **Previous Step / Reset**: Users viewing older steps get a "Reset to this step" toggle. This forcefully drops all subsequent session history in the DB and reverts the active state to the older version snapshot.

### 3.4 Phase 5 — Workflows in `/chat`
In the future, bring the Workflow interaction out of just the Extension window and down into the primary `/chat` route:
- A dropdown/popover select for turning a standard chat into a Workflow Session.
- The step progress UI embedded natively at the top of the chat view.

---

## 4. Data Structure Example (YAML)

```yaml
name: "Onboard New Prospect"
slug: "onboard-prospect"
description: "A 2-step flow to research a company and write them an email"
todo:
  - taskId: "research_company"
    title: "1. Company Research"
    systemPrompt: "You are researching a target company. Use the web-search MCP to find recent initiatives."
    allowedTools: ["mcp_web_search"]
    schema:
      type: "object"
      required: ["companyName", "recentNews"]
      properties:
        companyName: { type: "string" }
        recentNews: { type: "string" }
        
  - taskId: "draft_outreach"
    title: "2. Draft Outreach Email"
    systemPrompt: "Draft an engaging outreach email based on the company data gathered in step 1."
    allowedTools: ["mcp_email_drafting"]
    schema:
      type: "object"
      required: ["emailSubject", "emailBody"]
      properties:
        emailSubject: { type: "string" }
        emailBody: { type: "string" }
```
