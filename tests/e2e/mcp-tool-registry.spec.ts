import { test, expect } from '@playwright/test';

/**
 * MCP Tool Registry E2E — verifies the MCP server registry
 * dashboard, API endpoints, and CRUD operations work end-to-end.
 */

const MODULE_API = 'http://localhost:7005';
const PROXY_API = '/api/module/tool-management-tools';

test.describe('MCP Tool Registry — API', () => {
    test('worker health endpoint returns ok', async ({ request }) => {
        const res = await request.get(`${MODULE_API}/health`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.status).toBe('ok');
        expect(body.module).toBe('tool-management-tools');
    });

    test('GET /mcp-servers returns seeded servers with tools', async ({ request }) => {
        const res = await request.get(`${MODULE_API}/mcp-servers`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();

        expect(body.total).toBeGreaterThanOrEqual(2);
        expect(body.items).toBeInstanceOf(Array);

        // Verify the built-in servers exist
        const names = body.items.map((s: any) => s.name);
        expect(names).toContain('internal-search');
        expect(names).toContain('internal-context');

        // Check the built-in servers specifically (leftover test servers may also exist)
        const builtIn = body.items.filter((s: any) => s.isBuiltIn);
        expect(builtIn.length).toBeGreaterThanOrEqual(2);
        for (const server of builtIn) {
            expect(server.tools).toBeInstanceOf(Array);
            expect(server.type).toBe('internal');
            expect(server.status).toBe('online');
        }
    });

    test('GET /mcp-servers/:id returns server with tools', async ({ request }) => {
        const listRes = await request.get(`${MODULE_API}/mcp-servers`);
        const { items } = await listRes.json();
        const server = items.find((s: any) => s.name === 'internal-search');

        const res = await request.get(`${MODULE_API}/mcp-servers/${server.id}`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();

        expect(body.name).toBe('internal-search');
        expect(body.label).toBe('Internal Search');
        expect(body.tools.length).toBeGreaterThanOrEqual(3);

        const toolNames = body.tools.map((t: any) => t.name);
        expect(toolNames).toContain('web_search');
        expect(toolNames).toContain('rag_search');
        expect(toolNames).toContain('search_properties');
    });

    test('GET /mcp-servers?type=internal filters by type', async ({ request }) => {
        const res = await request.get(`${MODULE_API}/mcp-servers?type=internal`);
        expect(res.ok()).toBeTruthy();
        const { items } = await res.json();
        for (const s of items) {
            expect(s.type).toBe('internal');
        }
    });

    test('POST + GET + DELETE /mcp-servers — full CRUD lifecycle', async ({ request }) => {
        // Cleanup leftover from prior runs
        const existing = await request.get(`${MODULE_API}/mcp-servers`);
        const { items: prior } = await existing.json();
        const stale = prior.find((s: any) => s.name === 'test-external-server');
        if (stale) await request.delete(`${MODULE_API}/mcp-servers/${stale.id}`);

        // Create
        const createRes = await request.post(`${MODULE_API}/mcp-servers`, {
            data: {
                name: 'test-external-server',
                label: 'Test External MCP',
                description: 'A test external MCP server',
                type: 'external',
                transportType: 'sse',
                endpoint: 'https://mcp.example.com/sse',
                authType: 'none',
                icon: 'Globe',
            },
        });
        expect(createRes.status()).toBe(201);
        const created = await createRes.json();
        expect(created.name).toBe('test-external-server');
        expect(created.type).toBe('external');
        expect(created.tools).toEqual([]);

        // Get by ID
        const getRes = await request.get(`${MODULE_API}/mcp-servers/${created.id}`);
        expect(getRes.ok()).toBeTruthy();
        const fetched = await getRes.json();
        expect(fetched.label).toBe('Test External MCP');

        // Toggle off
        const toggleRes = await request.patch(`${MODULE_API}/mcp-servers/${created.id}/toggle`);
        expect(toggleRes.ok()).toBeTruthy();
        const toggled = await toggleRes.json();
        expect(toggled.isEnabled).toBe(false);

        // Toggle back on
        const toggleRes2 = await request.patch(`${MODULE_API}/mcp-servers/${created.id}/toggle`);
        const toggled2 = await toggleRes2.json();
        expect(toggled2.isEnabled).toBe(true);

        // Update
        const updateRes = await request.put(`${MODULE_API}/mcp-servers/${created.id}`, {
            data: { label: 'Updated Test MCP' },
        });
        expect(updateRes.ok()).toBeTruthy();
        const updated = await updateRes.json();
        expect(updated.label).toBe('Updated Test MCP');

        // Delete (soft)
        const deleteRes = await request.delete(`${MODULE_API}/mcp-servers/${created.id}`);
        expect(deleteRes.ok()).toBeTruthy();

        // Should be gone from list
        const afterRes = await request.get(`${MODULE_API}/mcp-servers/${created.id}`);
        expect(afterRes.status()).toBe(404);
    });

    test('POST duplicate name returns 409', async ({ request }) => {
        const res = await request.post(`${MODULE_API}/mcp-servers`, {
            data: {
                name: 'internal-search',
                label: 'Duplicate',
                type: 'internal',
            },
        });
        expect(res.status()).toBe(409);
    });

    test('MCP tool CRUD within a server', async ({ request }) => {
        // Create a temporary server
        const serverRes = await request.post(`${MODULE_API}/mcp-servers`, {
            data: {
                name: 'test-tool-crud-server',
                label: 'Tool CRUD Test Server',
                type: 'external',
                transportType: 'stdio',
                command: 'echo',
            },
        });
        expect(serverRes.status()).toBe(201);
        const server = await serverRes.json();

        // Add a tool
        const toolRes = await request.post(`${MODULE_API}/mcp-servers/${server.id}/tools`, {
            data: {
                name: 'test_tool',
                label: 'Test Tool',
                description: 'A test tool for CRUD',
                category: 'general',
                inputSchema: {
                    type: 'object',
                    properties: { query: { type: 'string' } },
                    required: ['query'],
                },
            },
        });
        expect(toolRes.status()).toBe(201);
        const tool = await toolRes.json();
        expect(tool.name).toBe('test_tool');

        // List tools
        const listRes = await request.get(`${MODULE_API}/mcp-servers/${server.id}/tools`);
        expect(listRes.ok()).toBeTruthy();
        const { items } = await listRes.json();
        expect(items.length).toBe(1);

        // Toggle tool
        const toggleRes = await request.patch(
            `${MODULE_API}/mcp-servers/${server.id}/tools/${tool.id}/toggle`,
        );
        expect(toggleRes.ok()).toBeTruthy();
        const toggled = await toggleRes.json();
        expect(toggled.isEnabled).toBe(false);

        // Update tool
        const updateRes = await request.put(
            `${MODULE_API}/mcp-servers/${server.id}/tools/${tool.id}`,
            { data: { label: 'Updated Test Tool' } },
        );
        expect(updateRes.ok()).toBeTruthy();
        const updated = await updateRes.json();
        expect(updated.label).toBe('Updated Test Tool');

        // Delete tool
        const deleteRes = await request.delete(
            `${MODULE_API}/mcp-servers/${server.id}/tools/${tool.id}`,
        );
        expect(deleteRes.ok()).toBeTruthy();

        // Cleanup server
        await request.delete(`${MODULE_API}/mcp-servers/${server.id}`);
    });

    test('duplicate tool name on same server returns 409', async ({ request }) => {
        // Use an existing server
        const listRes = await request.get(`${MODULE_API}/mcp-servers`);
        const { items } = await listRes.json();
        const server = items.find((s: any) => s.name === 'internal-search');

        const res = await request.post(`${MODULE_API}/mcp-servers/${server.id}/tools`, {
            data: {
                name: 'web_search',
                label: 'Duplicate Web Search',
            },
        });
        expect(res.status()).toBe(409);
    });

    test('health check updates server status', async ({ request }) => {
        const listRes = await request.get(`${MODULE_API}/mcp-servers`);
        const { items } = await listRes.json();
        const server = items.find((s: any) => s.name === 'internal-search');

        const res = await request.post(`${MODULE_API}/mcp-servers/${server.id}/health-check`);
        expect(res.ok()).toBeTruthy();
        const body = await res.json();
        expect(body.status).toBe('online');
        expect(body.lastHealthCheck).toBeTruthy();
    });
});

test.describe('MCP Tool Registry — UI', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        // Click demo login to open user selection dialog
        const demoBtn = page.getByRole('button', { name: /demo/i });
        await demoBtn.click();
        // Select "Admin User" from the demo login dialog
        await page.locator('text=Admin User').click();
        // Wait for redirect to any authenticated page (home or chat)
        await page.waitForURL(/\/(home|chat)/, { timeout: 15_000 });
    });

    test('dashboard loads and shows MCP servers', async ({ page }) => {
        await page.goto('/modules/tool-management-tools');
        await expect(page.locator('text=MCP Tool Registry')).toBeVisible({ timeout: 10_000 });

        // Should show server count
        await expect(page.locator('text=/\\d+ servers/')).toBeVisible();
        await expect(page.locator('text=/\\d+ tools/').first()).toBeVisible();

        // Built-in servers should be listed
        await expect(page.locator('text=Internal Search')).toBeVisible();
        await expect(page.locator('text=Context Tools')).toBeVisible();
    });

    test('servers show type badges and status', async ({ page }) => {
        await page.goto('/modules/tool-management-tools');
        await expect(page.locator('text=Internal Search')).toBeVisible({ timeout: 10_000 });

        // Type badge
        await expect(page.locator('text=Internal').first()).toBeVisible();

        // Status indicator
        await expect(page.locator('text=Online').first()).toBeVisible();
    });

    test('tools are visible when server is expanded', async ({ page }) => {
        await page.goto('/modules/tool-management-tools');
        await expect(page.locator('text=Internal Search')).toBeVisible({ timeout: 10_000 });

        // Tools should auto-expand for servers with tools
        await expect(page.getByText('Web Search', { exact: true })).toBeVisible({ timeout: 5_000 });
        await expect(page.getByText('Document Search', { exact: true })).toBeVisible();
        await expect(page.getByText('Property Data', { exact: true })).toBeVisible();
    });

    test('type filter buttons work', async ({ page }) => {
        await page.goto('/modules/tool-management-tools');
        await expect(page.locator('text=Internal Search')).toBeVisible({ timeout: 10_000 });

        // Click the filter buttons
        const allBtn = page.locator('button', { hasText: 'All' });
        const internalBtn = page.locator('button', { hasText: 'Internal' });
        const externalBtn = page.locator('button', { hasText: 'External' });

        await expect(allBtn).toBeVisible();
        await expect(internalBtn).toBeVisible();
        await expect(externalBtn).toBeVisible();

        // Filter to internal — should show built-in servers
        await internalBtn.click();
        await expect(page.locator('text=Internal Search')).toBeVisible({ timeout: 5_000 });

        // Back to all — should still show built-in servers
        await allBtn.click();
        await expect(page.locator('text=Internal Search')).toBeVisible({ timeout: 5_000 });
    });

    test('"Add MCP Server" button navigates to form', async ({ page }) => {
        await page.goto('/modules/tool-management-tools');
        await expect(page.locator('text=MCP Tool Registry')).toBeVisible({ timeout: 10_000 });

        await page.getByRole('link', { name: /Add MCP Server/i }).or(page.locator('button:has-text("Add MCP Server")')).first().click();
        await expect(page).toHaveURL(/mcp-servers\/new/, { timeout: 5_000 });
        await expect(page.getByRole('heading', { name: 'Add MCP Server' })).toBeVisible();
    });

    test('new MCP server form has all fields', async ({ page }) => {
        await page.goto('/modules/tool-management-tools/mcp-servers/new');
        await expect(page.getByRole('heading', { name: 'Add MCP Server' })).toBeVisible({ timeout: 10_000 });

        // Type and transport selects
        await expect(page.locator('select').first()).toBeVisible();

        // Name and label inputs
        await expect(page.locator('input[placeholder*="github"]')).toBeVisible();
        await expect(page.locator('input[placeholder*="GitHub"]')).toBeVisible();

        // Auth select
        await expect(page.locator('text=Authentication')).toBeVisible();
    });

    test('can create and see new external MCP server', async ({ page, request }) => {
        const uniqueName = `pw-test-${Date.now()}`;
        const uniqueLabel = `PW Test ${Date.now()}`;

        // Navigate to form
        await page.goto('/modules/tool-management-tools/mcp-servers/new');
        await expect(page.getByRole('heading', { name: 'Add MCP Server' })).toBeVisible({ timeout: 10_000 });

        // Fill in the form
        await page.locator('input[placeholder*="github"]').fill(uniqueName);
        await page.locator('input[placeholder*="GitHub"]').fill(uniqueLabel);
        await page.locator('textarea').first().fill('Created by Playwright test');
        await page.locator('input[type="url"]').fill('https://mcp.example.com/test');

        // Submit
        await page.getByRole('button', { name: /Add MCP Server/i }).click();

        // Should redirect back to dashboard
        await expect(page).toHaveURL(/\/modules\/tool-management-tools$/, { timeout: 10_000 });

        // New server should appear
        await expect(page.getByText(uniqueLabel)).toBeVisible({ timeout: 10_000 });

        // Cleanup via API
        const res = await request.get(`${MODULE_API}/mcp-servers`);
        const { items } = await res.json();
        const testServer = items.find((s: any) => s.name === uniqueName);
        if (testServer) {
            await request.delete(`${MODULE_API}/mcp-servers/${testServer.id}`);
        }
    });
});
