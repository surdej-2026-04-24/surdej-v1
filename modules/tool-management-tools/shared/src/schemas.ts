/**
 * Module: tool-management-tools — Zod Schemas
 *
 * Shared DTOs for MCP server registry, tool definitions, use cases,
 * and workflow management.
 *
 * Used by both the worker (server-side validation) and the UI (client-side).
 */

import { z } from 'zod';

// ─── Module Identity ───────────────────────────────────────────

export const MODULE_NAME = 'tool-management-tools';

export const NATS_SUBJECTS = {
    REGISTER: 'module.register',
    DEREGISTER: 'module.deregister',
    HEARTBEAT: 'module.heartbeat',
    EVENTS: `module.${MODULE_NAME}.>`,
} as const;

// ─── Tool Category ─────────────────────────────────────────────

export const TOOL_CATEGORIES = [
    'search',
    'analysis',
    'generation',
    'context',
    'integration',
    'general',
] as const;

export type ToolCategory = typeof TOOL_CATEGORIES[number];

// ─── MCP Server Types ──────────────────────────────────────────

export const MCP_SERVER_TYPES = ['internal', 'external'] as const;
export type McpServerType = typeof MCP_SERVER_TYPES[number];

export const MCP_TRANSPORT_TYPES = ['stdio', 'sse', 'streamable-http'] as const;
export type McpTransportType = typeof MCP_TRANSPORT_TYPES[number];

export const MCP_AUTH_TYPES = ['none', 'api-key', 'bearer', 'oauth'] as const;
export type McpAuthType = typeof MCP_AUTH_TYPES[number];

export const MCP_SERVER_STATUSES = ['online', 'offline', 'error', 'unknown'] as const;
export type McpServerStatus = typeof MCP_SERVER_STATUSES[number];

// ─── MCP Server Schema ────────────────────────────────────────

export const McpServerSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid().nullable().optional(),
    name: z.string().min(1).max(100),
    label: z.string().min(1).max(255),
    description: z.string().max(2000).optional().nullable(),
    type: z.enum(MCP_SERVER_TYPES).default('internal'),
    transportType: z.enum(MCP_TRANSPORT_TYPES).default('sse'),
    endpoint: z.string().max(2000).optional().nullable(),
    command: z.string().max(500).optional().nullable(),
    args: z.array(z.string()).default([]),
    envVars: z.record(z.string()).optional().nullable(),
    headers: z.record(z.string()).optional().nullable(),
    authType: z.enum(MCP_AUTH_TYPES).default('none'),
    icon: z.string().max(50).optional().nullable(),
    isEnabled: z.boolean().default(true),
    isBuiltIn: z.boolean().default(false),
    status: z.enum(MCP_SERVER_STATUSES).default('unknown'),
    statusMessage: z.string().optional().nullable(),
    lastHealthCheck: z.string().datetime().optional().nullable(),
    metadata: z.record(z.unknown()).optional().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().optional().nullable(),
});
export type McpServer = z.infer<typeof McpServerSchema>;

export const McpServerWithToolsSchema = McpServerSchema.extend({
    tools: z.array(z.lazy(() => McpToolSchema)).default([]),
});
export type McpServerWithTools = z.infer<typeof McpServerWithToolsSchema>;

export const CreateMcpServerSchema = z.object({
    tenantId: z.string().uuid().nullable().optional(),
    name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    label: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    type: z.enum(MCP_SERVER_TYPES).default('external'),
    transportType: z.enum(MCP_TRANSPORT_TYPES).default('sse'),
    endpoint: z.string().max(2000).optional(),
    command: z.string().max(500).optional(),
    args: z.array(z.string()).optional(),
    envVars: z.record(z.string()).optional(),
    headers: z.record(z.string()).optional(),
    authType: z.enum(MCP_AUTH_TYPES).default('none'),
    authConfig: z.record(z.unknown()).optional(),
    icon: z.string().max(50).optional(),
    isEnabled: z.boolean().optional(),
    isBuiltIn: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
});
export type CreateMcpServer = z.infer<typeof CreateMcpServerSchema>;

export const UpdateMcpServerSchema = CreateMcpServerSchema.partial().omit({ name: true });
export type UpdateMcpServer = z.infer<typeof UpdateMcpServerSchema>;

export const McpServerListResponseSchema = z.object({
    items: z.array(McpServerWithToolsSchema),
    total: z.number().int().nonnegative(),
});
export type McpServerListResponse = z.infer<typeof McpServerListResponseSchema>;

// ─── MCP Tool Schema ──────────────────────────────────────────

export const McpToolSchema = z.object({
    id: z.string().uuid(),
    serverId: z.string().uuid(),
    name: z.string().min(1).max(200),
    label: z.string().min(1).max(255),
    description: z.string().max(2000).optional().nullable(),
    inputSchema: z.record(z.unknown()).optional().nullable(),
    category: z.string().max(50).default('general'),
    icon: z.string().max(50).optional().nullable(),
    isEnabled: z.boolean().default(true),
    metadata: z.record(z.unknown()).optional().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type McpTool = z.infer<typeof McpToolSchema>;

export const CreateMcpToolSchema = z.object({
    name: z.string().min(1).max(200),
    label: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    inputSchema: z.record(z.unknown()).optional(),
    category: z.string().max(50).optional(),
    icon: z.string().max(50).optional(),
    isEnabled: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
});
export type CreateMcpTool = z.infer<typeof CreateMcpToolSchema>;

export const UpdateMcpToolSchema = CreateMcpToolSchema.partial();
export type UpdateMcpTool = z.infer<typeof UpdateMcpToolSchema>;

// ─── Use Case IDs ──────────────────────────────────────────────

export const USE_CASE_IDS = [
    'improve-text',
    'generate-marketing',
    'analyze-document',
    'prospect-lookup',
    'quick-research',
    'general',
] as const;

export type UseCaseId = typeof USE_CASE_IDS[number];

// ─── Tool Schema ───────────────────────────────────────────────

export const ToolSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid().nullable().optional(),
    name: z.string().min(1).max(100),       // e.g. "web_search"
    label: z.string().min(1).max(255),      // e.g. "Web Search"
    description: z.string().max(2000).optional(),
    category: z.enum(TOOL_CATEGORIES).default('general'),
    icon: z.string().max(50).optional(),    // Lucide icon name
    isEnabled: z.boolean().default(true),
    isBuiltIn: z.boolean().default(false),
    metadata: z.record(z.unknown()).optional(),
    useCases: z.array(z.string()).default([]),
    promptTemplate: z.string().optional(),  // Session prompt prefix
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type Tool = z.infer<typeof ToolSchema>;

// ─── Create / Update DTOs ──────────────────────────────────────

export const CreateToolSchema = ToolSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export type CreateTool = z.infer<typeof CreateToolSchema>;

export const UpdateToolSchema = CreateToolSchema.partial();
export type UpdateTool = z.infer<typeof UpdateToolSchema>;

// ─── List Response ─────────────────────────────────────────────

export const ToolListResponseSchema = z.object({
    items: z.array(ToolSchema),
    total: z.number().int().nonnegative(),
});
export type ToolListResponse = z.infer<typeof ToolListResponseSchema>;

// ─── Use Case Definition (legacy in-memory) ───────────────────

export const UseCaseSchema = z.object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    icon: z.string(),
    promptTemplate: z.string(),
    tools: z.array(z.string()),
    workflowMode: z.boolean().optional().default(false),
});
export type UseCase = z.infer<typeof UseCaseSchema>;

// ─── Built-in Use Cases ────────────────────────────────────────

export const BUILT_IN_USE_CASES: UseCase[] = [
    {
        id: 'improve-text',
        label: 'Forbedr min tekst',
        description: 'AI forbedrer og polerer den markerede tekst',
        icon: 'Sparkles',
        promptTemplate: 'Du er en professionel tekstredaktør. Forbedr følgende tekst så den er klar, præcis og engagerende:\n\n',
        tools: ['page_context'],
        workflowMode: false,
    },
    {
        id: 'generate-marketing',
        label: 'Generer marketingbeskrivelse',
        description: 'Opret en overbevisende marketingbeskrivelse baseret på konteksten',
        icon: 'Megaphone',
        promptTemplate: 'Du er en ekspert i ejendomsmarketing. Skriv en overbevisende og professionel marketingbeskrivelse til:\n\n',
        tools: ['page_context'],
        workflowMode: false,
    },
    {
        id: 'analyze-document',
        label: 'Analysér dokument',
        description: 'Dyb analyse af et uploadet dokument eller den aktuelle side',
        icon: 'FileSearch',
        promptTemplate: 'Analysér følgende dokument grundigt og fremhæv nøgleinformation, tendenser og indsigter:\n\n',
        tools: ['rag_search', 'page_context'],
        workflowMode: false,
    },
    {
        id: 'prospect-lookup',
        label: 'Prospect-opslag',
        description: 'Søg og berig ejendomsdata fra databasen',
        icon: 'Building2',
        promptTemplate: 'Foretag et detaljeret opslag i ejendomsdatabasen for følgende:\n\n',
        tools: ['search_properties'],
        workflowMode: false,
    },
    {
        id: 'quick-research',
        label: 'Hurtig research',
        description: 'Søg på nettet og i videnbasen for hurtige svar',
        icon: 'SearchCheck',
        promptTemplate: 'Foretag en grundig research og giv et klart, faktabaseret svar på:\n\n',
        tools: ['web_search', 'rag_search'],
        workflowMode: false,
    },
    {
        id: 'general',
        label: 'Generel assistent',
        description: 'Fri AI-assistance uden specifik kontekst',
        icon: 'Bot',
        promptTemplate: '',
        tools: ['web_search', 'rag_search', 'search_properties'],
        workflowMode: false,
    },
];

// ─── Built-in Workflow Task Definitions ────────────────────────
// Used by the API to auto-provision built-in workflows in the DB.

export interface BuiltInWorkflowTaskDef {
    taskId: string;
    title: string;
    sortOrder: number;
    systemPrompt: string;
    allowedTools: string[];
    dataSchema: {
        type: 'object';
        required: string[];
        properties: Record<string, { type: string; description?: string; multiline?: boolean }>;
    };
    userHint?: string;
    description?: string;
}

export const BUILT_IN_WORKFLOW_TASKS: Record<string, BuiltInWorkflowTaskDef[]> = {};

// ─── Model Tiers ───────────────────────────────────────────────

export const MODEL_TIERS = ['low', 'medium', 'high', 'reasoning'] as const;
export type ModelTier = typeof MODEL_TIERS[number];

// ─── Persisted Use Case (DB) ───────────────────────────────────

export const DbUseCaseSchema = z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid().nullable().optional(),
    slug: z.string().min(1).max(100),
    label: z.string().min(1).max(255),
    description: z.string().max(2000).optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    isBuiltIn: z.boolean().default(false),
    isActive: z.boolean().default(true),
    metadata: z.record(z.unknown()).optional().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().optional().nullable(),
});
export type DbUseCase = z.infer<typeof DbUseCaseSchema>;

export const CreateDbUseCaseSchema = z.object({
    tenantId: z.string().uuid().nullable().optional(),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    label: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    icon: z.string().max(50).optional(),
    isBuiltIn: z.boolean().optional(),
    isActive: z.boolean().optional(),
    workflowMode: z.boolean().optional().default(false),
    metadata: z.record(z.unknown()).optional(),
});
export type CreateDbUseCase = z.infer<typeof CreateDbUseCaseSchema>;

export const UpdateDbUseCaseSchema = CreateDbUseCaseSchema.partial().omit({ slug: true });
export type UpdateDbUseCase = z.infer<typeof UpdateDbUseCaseSchema>;

// ─── Use Case Version ──────────────────────────────────────────

export const UseCaseVersionSchema = z.object({
    id: z.string().uuid(),
    useCaseId: z.string().uuid(),
    version: z.number().int().positive(),
    promptTemplate: z.string().min(1),
    tools: z.array(z.string()).default([]),
    modelTier: z.enum(MODEL_TIERS).default('medium'),
    changelog: z.string().optional().nullable(),
    createdAt: z.string().datetime(),
});
export type UseCaseVersionDto = z.infer<typeof UseCaseVersionSchema>;

export const CreateUseCaseVersionSchema = z.object({
    promptTemplate: z.string().min(1),
    tools: z.array(z.string()).default([]),
    modelTier: z.enum(MODEL_TIERS).default('medium'),
    changelog: z.string().optional(),
});
export type CreateUseCaseVersion = z.infer<typeof CreateUseCaseVersionSchema>;

// ─── Workflow Task Definition ──────────────────────────────────

export const DataSchemaPropertySchema: z.ZodType<any> = z.lazy(() => z.object({
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    description: z.string().optional(),
    multiline: z.boolean().optional(),
    items: z.lazy(() => DataSchemaPropertySchema).optional(),
}));

export const DataSchemaSchema = z.object({
    type: z.literal('object'),
    required: z.array(z.string()).default([]),
    properties: z.record(DataSchemaPropertySchema),
});
export type DataSchema = z.infer<typeof DataSchemaSchema>;

export const WorkflowTaskSchema = z.object({
    id: z.string().uuid(),
    useCaseId: z.string().uuid(),
    taskId: z.string().min(1).max(100),
    title: z.string().min(1).max(255),
    sortOrder: z.number().int().default(0),
    systemPrompt: z.string().min(1),
    allowedTools: z.array(z.string()).default([]),
    dataSchema: DataSchemaSchema,
    seedData: z.record(z.unknown()).optional().nullable(),
    userHint: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type WorkflowTaskDto = z.infer<typeof WorkflowTaskSchema>;

export const CreateWorkflowTaskSchema = z.object({
    taskId: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/, 'lowercase alphanumeric with hyphens/underscores'),
    title: z.string().min(1).max(255),
    sortOrder: z.number().int().optional(),
    systemPrompt: z.string().min(1),
    allowedTools: z.array(z.string()).default([]),
    dataSchema: DataSchemaSchema,
    seedData: z.record(z.unknown()).optional(),
    userHint: z.string().optional(),
    description: z.string().optional(),
});
export type CreateWorkflowTask = z.infer<typeof CreateWorkflowTaskSchema>;

export const UpdateWorkflowTaskSchema = CreateWorkflowTaskSchema.partial();
export type UpdateWorkflowTask = z.infer<typeof UpdateWorkflowTaskSchema>;

// ─── Workflow Session ──────────────────────────────────────────

export const SESSION_STATUSES = ['active', 'completed', 'aborted'] as const;
export type SessionStatus = typeof SESSION_STATUSES[number];

export const WorkflowSessionSchema = z.object({
    id: z.string().uuid(),
    useCaseId: z.string().uuid(),
    userId: z.string(),
    tenantId: z.string().uuid().optional().nullable(),
    currentStepIdx: z.number().int().default(0),
    status: z.enum(SESSION_STATUSES).default('active'),
    formData: z.record(z.unknown()).default({}),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type WorkflowSessionDto = z.infer<typeof WorkflowSessionSchema>;

export const SessionContextVersionSchema = z.object({
    id: z.string().uuid(),
    sessionId: z.string().uuid(),
    stepIndex: z.number().int(),
    formData: z.record(z.unknown()),
    createdAt: z.string().datetime(),
});
export type SessionContextVersionDto = z.infer<typeof SessionContextVersionSchema>;

export const SessionMessageSchema = z.object({
    id: z.string().uuid(),
    sessionId: z.string().uuid(),
    stepIndex: z.number().int(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    metadata: z.record(z.unknown()).optional().nullable(),
    createdAt: z.string().datetime(),
});
export type SessionMessageDto = z.infer<typeof SessionMessageSchema>;

// ─── Use Case Test Case ────────────────────────────────────────

export const UseCaseTestCaseSchema = z.object({
    id: z.string().uuid(),
    useCaseId: z.string().uuid(),
    name: z.string().min(1).max(255),
    userPrompt: z.string().min(1),
    evaluationPrompt: z.string().min(1),
    expectedBehavior: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type UseCaseTestCaseDto = z.infer<typeof UseCaseTestCaseSchema>;

export const CreateUseCaseTestCaseSchema = z.object({
    name: z.string().min(1).max(255),
    userPrompt: z.string().min(1),
    evaluationPrompt: z.string().min(1),
    expectedBehavior: z.string().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
});
export type CreateUseCaseTestCase = z.infer<typeof CreateUseCaseTestCaseSchema>;

export const UpdateUseCaseTestCaseSchema = CreateUseCaseTestCaseSchema.partial();
export type UpdateUseCaseTestCase = z.infer<typeof UpdateUseCaseTestCaseSchema>;

// ─── Use Case Test Attachment ──────────────────────────────────

export const UseCaseTestAttachmentSchema = z.object({
    id: z.string().uuid(),
    testCaseId: z.string().uuid(),
    filename: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
    createdAt: z.string().datetime(),
});
export type UseCaseTestAttachmentDto = z.infer<typeof UseCaseTestAttachmentSchema>;

// ─── Use Case Test Run ─────────────────────────────────────────

export const TestRunStatus = ['pending', 'running', 'passed', 'failed', 'error'] as const;
export type TestRunStatusType = typeof TestRunStatus[number];

export const EvaluationResultSchema = z.object({
    passed: z.boolean(),
    score: z.number().min(0).max(1).optional(),
    reasoning: z.string(),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

export const TokenUsageSchema = z.object({
    promptTokens: z.number().int().nonnegative(),
    completionTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const UseCaseTestRunSchema = z.object({
    id: z.string().uuid(),
    testCaseId: z.string().uuid(),
    versionId: z.string().uuid(),
    status: z.enum(TestRunStatus),
    modelTier: z.enum(MODEL_TIERS),
    aiResponse: z.string().optional().nullable(),
    evaluationResult: EvaluationResultSchema.optional().nullable(),
    durationMs: z.number().int().optional().nullable(),
    tokenUsage: TokenUsageSchema.optional().nullable(),
    error: z.string().optional().nullable(),
    createdAt: z.string().datetime(),
});
export type UseCaseTestRunDto = z.infer<typeof UseCaseTestRunSchema>;

// ─── Test Runner Request ───────────────────────────────────────

export const RunTestsRequestSchema = z.object({
    versionId: z.string().uuid(),
    testCaseIds: z.array(z.string().uuid()).optional(),  // if omitted, run all active test cases
    modelTier: z.enum(MODEL_TIERS).optional(),           // override the version's model tier
});
export type RunTestsRequest = z.infer<typeof RunTestsRequestSchema>;

export const RunTestsSummarySchema = z.object({
    useCaseId: z.string().uuid(),
    versionId: z.string().uuid(),
    totalTests: z.number().int(),
    passed: z.number().int(),
    failed: z.number().int(),
    errors: z.number().int(),
    runs: z.array(UseCaseTestRunSchema),
});
export type RunTestsSummary = z.infer<typeof RunTestsSummarySchema>;
