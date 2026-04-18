# System Prompt Generation Architecture Plan

This document outlines the architecture for dynamically constructing a highly contextual, "merged" system prompt. This approach ensures your core principles (like the Professional Data-Driven Advisor role) are consistently applied while swapping out specialized tools and localized instructions based on the active **Use Case**.

## 1. Core Architecture Concept

The goal is to replace the static `DEFAULT_SYSTEM_PROMPT` in the backend (`apps/api/src/core/ai/chat.ts`) with a structured **Prompt Builder Component**.

The prompt will be assembled using three primary blocks:
1. **Base Configuration**: The universal rules, formatting guidelines, language logic, and overall persona.
2. **Use Case Layer**: The specific goal, additional rules, and requested tool IDs defined by the active `UseCase` payload.
3. **Dynamic Tool Registry Layer**: The exact capabilities and instructions automatically pulled from the enabled tools in the backend MCP registry.

## 2. Updated Data Structures

### A. Base Persona Template (Backend or DB)
Extract your specific rules out of the hardcoded system prompt and into a structured object (or a DB table like `TenantConfig` if you want it editable per tenant).

```typescript
// Example: apps/api/src/core/ai/prompts/base-persona.ts
export const GlobalAdvisorPersona = {
  role: "You are a Professional Advisor specializing in {{domain}}. Your goal is to help users analyze documents, answer complex inquiries, and provide strategic advice based on available data. Be precise, factual, and professional. Use Markdown for formatting, and prioritize tables for data comparisons and overviews.",
  principles: [
    "Tool-First Approach: Always use relevant tools to fetch data before answering—NEVER guess. Never claim 'no data is available' without first exhausting all search and retrieval tools.",
    "Proactive Verification: Use web search tools proactively for news, market conditions, legislation, or general knowledge to ensure information is current, even if you believe you know the answer.",
    "Contextual Awareness: Use semantic search (RAG) to find specific information within uploaded documents and specialized database tools for structured data (e.g., property lists, financial records).",
    "Language Policy: Always respond in the same language used by the user."
  ],
  responseStructure: `To ensure clarity and professional standards, every response must follow this format:
- **Executive Summary**: Start with 2-3 sentences summarizing the main findings. Use bold text for key figures and metrics.
- **Detailed Analysis**: Use clear headings, bullet points, and tables to elaborate on the data.
- **Sources**: End every response with a "Sources" section. List every document name, URL, or tool result used to generate the answer. Format: \`[Source: Filename/URL]\`. Every claim must be backed by a cited source.`,
}
```

### B. Tool Descriptions Map
Instead of manually typing what each tool does in the system prompt, map your actual MCP Tool descriptions automatically into the prompt based on the tools enabled.

```typescript
// Automatically extract these from your `buildMcpTools()` definitions
function generateToolPrompt(enabledToolIds: string[], allTools: Record<string, CoreTool>) {
    const lines = ["Available Tools:"];
    for (const id of enabledToolIds) {
        const tool = allTools[id];
        if (tool) {
            lines.push(`- **${id}**: ${tool.description}`);
        }
    }
    return lines.join('\n');
}
```

## 3. The Prompt Builder Function

We will introduce a `buildMergedSystemPrompt(useCaseData, enabledTools)` function in the API layer. 

```typescript
// apps/api/src/core/ai/prompts/builder.ts

export interface UseCaseContext {
    id: string;
    domain?: string;
    promptTemplate?: string;   // Any additional instructions from the use case (e.g., "Focus specifically on identifying risk factors.")
}

export function buildMergedSystemPrompt(
    useCase: UseCaseContext | null, 
    enabledToolIds: string[], 
    mcpRegistry: Record<string, CoreTool>
): string {
    const domain = useCase?.domain || "Real Estate/Financial Analysis";
    
    // 1. Render Base Persona
    const roleStr = GlobalAdvisorPersona.role.replace('{{domain}}', domain);
    const principlesStr = GlobalAdvisorPersona.principles.map(p => `- ${p}`).join('\n');
    
    // 2. Render Tools
    const toolsStr = generateToolPrompt(enabledToolIds, mcpRegistry);

    // 3. Assemble
    const parts = [
        `# Role\n${roleStr}`,
        `# Core Principles\n${principlesStr}`,
    ];

    if (useCase?.promptTemplate) {
        parts.push(`# Task-Specific Instructions\n${useCase.promptTemplate}`);
    }

    parts.push(toolsStr);
    parts.push(`# Response Structure\n${GlobalAdvisorPersona.responseStructure}`);

    return parts.join('\n\n');
}
```

## 4. Frontend & Backend Integration Plan

**1. Update the Frontend to Send the Use Case ID**
Currently, `ChatPage.tsx` converts slash commands (e.g. `/strict-mode`) into raw text, or sends `enabledTools`. We need to explicitly pass `useCaseId` alongside the chat messages so the backend can look up the constraints.
*Action:* Add `useCaseId?: string` to `ChatRequest` in `ChatPage.tsx` and `api/chat.ts`.

**2. Evaluate the Tools Array**
The frontend already passes `Array.from(enabledTools)` into the payload. The backend will intersect the Use Case's required tools with the tools permitted to the tenant.

**3. Inject into the Vercel AI SDK**
In `streamChat` (`apps/api/src/core/ai/chat.ts`), we replace:
```typescript
let systemPrompt = request.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
```
With:
```typescript
const useCaseContext = request.useCaseId ? await fetchUseCase(request.useCaseId) : null;
let systemPrompt = buildMergedSystemPrompt(useCaseContext, toolNames, allMcpTools);
```

## How It Benefits You

- **Single Source of Truth**: The "Professional Data-Driven Advisor" rules only exist once in code/DB.
- **Dynamic Capabilities**: If you toggle an extra "News Search" tool on for a specific Use Case, the AI will *automatically* be taught how to use it through the tool string builder.
- **Strict Compliance**: Since the Response Structure block guarantees the `Executive Summary -> Detailed Analysis -> Sources` output, every prompt flavor (regardless of use case) adheres to the exact same high-standard format you set.
