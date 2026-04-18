import {
    MODULE_NAME,
    ToolSchema,
    ToolListResponseSchema,
    McpServerWithToolsSchema,
    McpServerListResponseSchema,
    McpToolSchema,
    type Tool,
    type CreateTool,
    type UpdateTool,
    type ToolListResponse,
    type UseCase,
    type McpServerWithTools,
    type McpServerListResponse,
    type CreateMcpServer,
    type UpdateMcpServer,
    type McpTool,
    type CreateMcpTool,
    type UpdateMcpTool,
} from '@surdej/module-tool-management-tools-shared';

const BASE = `/api/module/${MODULE_NAME}`;

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
}

export function useModuleApi() {
    return {
        // ─── Legacy Tool CRUD ──────────────────────────────────
        list: async (params?: { category?: string; useCase?: string; enabled?: boolean }): Promise<ToolListResponse> => {
            const qs = new URLSearchParams();
            if (params?.category) qs.set('category', params.category);
            if (params?.useCase) qs.set('useCase', params.useCase);
            if (params?.enabled !== undefined) qs.set('enabled', String(params.enabled));
            const suffix = qs.toString() ? `?${qs}` : '';
            const data = await request<unknown>(`/${suffix}`);
            return ToolListResponseSchema.parse(data);
        },
        get: async (id: string): Promise<Tool> => {
            const data = await request<unknown>(`/${id}`);
            return ToolSchema.parse(data);
        },
        create: async (input: CreateTool): Promise<Tool> => {
            const data = await request<unknown>('/', {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return ToolSchema.parse(data);
        },
        update: async (id: string, input: UpdateTool): Promise<Tool> => {
            const data = await request<unknown>(`/${id}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            });
            return ToolSchema.parse(data);
        },
        toggle: async (id: string): Promise<Tool> => {
            const data = await request<unknown>(`/${id}/toggle`, { method: 'PATCH' });
            return ToolSchema.parse(data);
        },
        remove: async (id: string): Promise<void> => {
            await request(`/${id}`, { method: 'DELETE' });
        },
        listUseCases: async (): Promise<{ items: UseCase[]; total: number }> => {
            return request<{ items: UseCase[]; total: number }>('/use-cases');
        },

        // ─── MCP Server Registry ──────────────────────────────
        listMcpServers: async (params?: { type?: string; status?: string; enabled?: boolean }): Promise<McpServerListResponse> => {
            const qs = new URLSearchParams();
            if (params?.type) qs.set('type', params.type);
            if (params?.status) qs.set('status', params.status);
            if (params?.enabled !== undefined) qs.set('enabled', String(params.enabled));
            const suffix = qs.toString() ? `?${qs}` : '';
            const data = await request<unknown>(`/mcp-servers${suffix}`);
            return McpServerListResponseSchema.parse(data);
        },
        getMcpServer: async (id: string): Promise<McpServerWithTools> => {
            const data = await request<unknown>(`/mcp-servers/${id}`);
            return McpServerWithToolsSchema.parse(data);
        },
        createMcpServer: async (input: CreateMcpServer): Promise<McpServerWithTools> => {
            const data = await request<unknown>('/mcp-servers', {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return McpServerWithToolsSchema.parse(data);
        },
        updateMcpServer: async (id: string, input: UpdateMcpServer): Promise<McpServerWithTools> => {
            const data = await request<unknown>(`/mcp-servers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            });
            return McpServerWithToolsSchema.parse(data);
        },
        toggleMcpServer: async (id: string): Promise<McpServerWithTools> => {
            const data = await request<unknown>(`/mcp-servers/${id}/toggle`, { method: 'PATCH' });
            return McpServerWithToolsSchema.parse(data);
        },
        removeMcpServer: async (id: string): Promise<void> => {
            await request(`/mcp-servers/${id}`, { method: 'DELETE' });
        },
        healthCheckMcpServer: async (id: string): Promise<McpServerWithTools> => {
            const data = await request<unknown>(`/mcp-servers/${id}/health-check`, { method: 'POST' });
            return McpServerWithToolsSchema.parse(data);
        },
        discoverMcpTools: async (id: string): Promise<{ message: string; server: string; existingTools: number }> => {
            return request(`/mcp-servers/${id}/discover`, { method: 'POST' });
        },

        // ─── MCP Tools ────────────────────────────────────────
        listMcpTools: async (serverId: string): Promise<{ items: McpTool[]; total: number }> => {
            return request(`/mcp-servers/${serverId}/tools`);
        },
        createMcpTool: async (serverId: string, input: CreateMcpTool): Promise<McpTool> => {
            const data = await request<unknown>(`/mcp-servers/${serverId}/tools`, {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return McpToolSchema.parse(data);
        },
        updateMcpTool: async (serverId: string, toolId: string, input: UpdateMcpTool): Promise<McpTool> => {
            const data = await request<unknown>(`/mcp-servers/${serverId}/tools/${toolId}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            });
            return McpToolSchema.parse(data);
        },
        toggleMcpTool: async (serverId: string, toolId: string): Promise<McpTool> => {
            const data = await request<unknown>(`/mcp-servers/${serverId}/tools/${toolId}/toggle`, { method: 'PATCH' });
            return McpToolSchema.parse(data);
        },
        removeMcpTool: async (serverId: string, toolId: string): Promise<void> => {
            await request(`/mcp-servers/${serverId}/tools/${toolId}`, { method: 'DELETE' });
        },
    };
}
