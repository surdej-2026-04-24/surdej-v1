# 14 — MCP Handling

## Overview

Surdej integrates the **Model Context Protocol (MCP)** to provide a standardized interface
between AI models and external tools, data sources, and services. The platform acts as both
an MCP **server** (exposing its capabilities to AI clients) and an MCP **client** (consuming
external MCP servers for tool augmentation).

## What Is MCP?

MCP is an open protocol (initiated by Anthropic) that standardizes how AI applications
communicate with external systems. It defines:

- **Tools** — Functions the AI can invoke (e.g., "search knowledge base", "create article").
- **Resources** — Structured data the AI can read (e.g., database records, file contents).
- **Prompts** — Reusable prompt templates with parameters.

## Surdej as MCP Server

Surdej exposes its platform capabilities as an MCP server, making them available to any
MCP-compatible AI client (Claude Desktop, VS Code Copilot, Cursor, etc.).

### Exposed Tools

| Tool | Description | Maps To |
|------|-------------|---------|
| `surdej.search` | Semantic search across all indexed content | RAG pipeline |
| `surdej.knowledge.search` | Search knowledge articles | Knowledge management |
| `surdej.knowledge.create` | Create a knowledge article from content | Knowledge management |
| `surdej.command.execute` | Execute a registered command by ID | Command registry |
| `surdej.command.list` | List available commands | Command registry |
| `surdej.worker.status` | Get worker registry status | Worker registry |
| `surdej.feature.check` | Check feature flag status | Feature flags |

### Exposed Resources

| Resource | Description |
|----------|-------------|
| `surdej://articles/{id}` | Knowledge article content |
| `surdej://commands` | List of all registered commands |
| `surdej://workers` | Connected worker status |
| `surdej://config` | Current configuration (non-sensitive) |

### Server Implementation

```typescript
// apps/api/src/core/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";

const server = new McpServer({
  name: "surdej",
  version: "1.0.0",
});

// Register tools from command registry
server.tool("surdej.command.execute", schema, async (args) => {
  return commandRegistry.execute(args.commandId, args.params);
});

// Register resources
server.resource("surdej://articles/{id}", async (uri) => {
  const id = uri.pathname.split("/").pop();
  return articleService.getById(id);
});
```

### Transport

| Transport | Use Case |
|-----------|----------|
| **stdio** | CLI integration, local AI tools (Claude Desktop, Cursor) |
| **SSE** | Browser-based MCP clients, remote connections |
| **Streamable HTTP** | Production API endpoint at `/api/mcp` |

## Surdej as MCP Client

The platform can consume external MCP servers to augment its AI capabilities with
external tools and data sources.

### Client Configuration

```typescript
// Environment-based MCP server configuration
interface McpServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "sse" | "streamable-http";
  command?: string;        // for stdio transport
  url?: string;            // for SSE/HTTP transport
  env?: Record<string, string>;
  tools?: string[];        // whitelist of allowed tools (optional)
}
```

### AI Chat Integration

When the AI chat receives a user message, it can invoke tools from connected MCP servers:

```
User message → AI model → Tool call (MCP) → External server → Result → AI response
```

Connected MCP tools appear in the AI chat as available capabilities. The model decides
when to invoke them based on the conversation context.

### Tool Discovery

- On startup, the MCP client connects to configured servers and discovers available tools.
- Tools are surfaced in the AI chat UI as available capabilities.
- Tool invocations are logged in `AiUsageLog` for audit and cost tracking.

## Domain Extension

Derived projects can expose domain-specific MCP tools:

```typescript
// domains/my-domain/mcp-tools.ts
export const domainTools: McpToolDefinition[] = [
  {
    name: "domain.my-domain.analyze",
    description: "Analyze a domain-specific document",
    schema: analyzeSchema,
    handler: async (args) => domainService.analyze(args),
  },
];
```

These are registered alongside core tools when the domain module activates.

## Data Model (Prisma — `core` schema)

| Model | Purpose |
|-------|---------|
| `McpServerConfig` | Configured external MCP servers |
| `McpToolInvocation` | Audit log of tool invocations |

## Commands

| Command ID | Description |
|------------|-------------|
| `navigate.settings.mcp` | MCP server configuration page |
| `mcp.server.list` | List configured MCP servers |
| `mcp.server.test` | Test connection to an MCP server |

## Dependencies

- `@modelcontextprotocol/sdk` — Official MCP TypeScript SDK

---

*New specification for Surdej core MCP integration.*
