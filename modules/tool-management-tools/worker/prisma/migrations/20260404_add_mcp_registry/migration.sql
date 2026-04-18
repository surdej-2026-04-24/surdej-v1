-- MCP Server Registry
-- Adds McpServer and McpTool tables for managing MCP (Model Context Protocol)
-- servers and their tools. Supports both internal (platform) and external MCP servers.

-- ─── McpServer ─────────────────────────────────────────────────

CREATE TABLE "tool_management_tools"."McpServer" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"        TEXT,
    "name"            TEXT NOT NULL,
    "label"           TEXT NOT NULL,
    "description"     TEXT,
    "type"            TEXT NOT NULL DEFAULT 'internal',
    "transportType"   TEXT NOT NULL DEFAULT 'sse',
    "endpoint"        TEXT,
    "command"         TEXT,
    "args"            TEXT[] DEFAULT ARRAY[]::TEXT[],
    "envVars"         JSONB,
    "headers"         JSONB,
    "authType"        TEXT NOT NULL DEFAULT 'none',
    "authConfig"      JSONB,
    "icon"            TEXT,
    "isEnabled"       BOOLEAN NOT NULL DEFAULT true,
    "isBuiltIn"       BOOLEAN NOT NULL DEFAULT false,
    "status"          TEXT NOT NULL DEFAULT 'unknown',
    "statusMessage"   TEXT,
    "lastHealthCheck" TIMESTAMP(3),
    "metadata"        JSONB,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    "deletedAt"       TIMESTAMP(3),

    CONSTRAINT "McpServer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "McpServer_name_key" ON "tool_management_tools"."McpServer"("name");
CREATE INDEX "McpServer_tenantId_idx" ON "tool_management_tools"."McpServer"("tenantId");
CREATE INDEX "McpServer_type_idx" ON "tool_management_tools"."McpServer"("type");
CREATE INDEX "McpServer_isEnabled_idx" ON "tool_management_tools"."McpServer"("isEnabled");
CREATE INDEX "McpServer_status_idx" ON "tool_management_tools"."McpServer"("status");

-- ─── McpTool ───────────────────────────────────────────────────

CREATE TABLE "tool_management_tools"."McpTool" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid(),
    "serverId"    TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "description" TEXT,
    "inputSchema" JSONB,
    "category"    TEXT NOT NULL DEFAULT 'general',
    "icon"        TEXT,
    "isEnabled"   BOOLEAN NOT NULL DEFAULT true,
    "metadata"    JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpTool_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "McpTool_serverId_name_key" ON "tool_management_tools"."McpTool"("serverId", "name");
CREATE INDEX "McpTool_serverId_idx" ON "tool_management_tools"."McpTool"("serverId");
CREATE INDEX "McpTool_category_idx" ON "tool_management_tools"."McpTool"("category");
CREATE INDEX "McpTool_isEnabled_idx" ON "tool_management_tools"."McpTool"("isEnabled");

-- ─── Foreign Key ───────────────────────────────────────────────

ALTER TABLE "tool_management_tools"."McpTool"
    ADD CONSTRAINT "McpTool_serverId_fkey"
    FOREIGN KEY ("serverId") REFERENCES "tool_management_tools"."McpServer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
