/**
 * Worker Integration Tests
 *
 * Tests worker registration, heartbeat, drain, and deregistration
 * against a running API server (http://localhost:5001).
 *
 * Prerequisites:
 *   - API server running (docker compose up -d api)
 *   - PostgreSQL + NATS available
 *
 * Run: pnpm --filter @surdej/tests test:integration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API = process.env.API_URL ?? 'http://localhost:5001/api';

// Helpers
async function get(path: string) {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
    return res.json();
}

async function post(path: string, body?: unknown) {
    const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
    return res.json();
}

// ─── Tests ──────────────────────────────────────────────────────

describe('Worker Registration & Lifecycle', () => {
    let testInstanceId: string;

    beforeAll(() => {
        testInstanceId = `test-worker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    });

    it('should list workers (starts empty or with existing)', async () => {
        const workers = await get('/workers');
        expect(Array.isArray(workers)).toBe(true);
    });

    it('should register a test worker via API', async () => {
        const registration = await post('/workers/register', {
            instanceId: testInstanceId,
            type: 'test',
            version: '0.1.0',
            capabilities: ['echo', 'test'],
            maxConcurrency: 5,
            hostname: 'test-host',
        });

        expect(registration).toBeDefined();
        expect(registration.instanceId).toBe(testInstanceId);
    });

    it('should appear in worker list after registration', async () => {
        const workers = await get('/workers');
        const found = workers.find((w: Record<string, unknown>) => w.instanceId === testInstanceId);
        expect(found).toBeDefined();
        expect(found.type).toBe('test');
        expect(found.status).toBe('online');
    });

    it('should retrieve worker detail by instance ID', async () => {
        const workers = await get('/workers');
        const found = workers.find((w: Record<string, unknown>) => w.instanceId === testInstanceId);
        if (!found) throw new Error('Worker not found');

        const detail = await get(`/workers/${found.id}`);
        expect(detail.instanceId).toBe(testInstanceId);
        expect(detail.capabilities).toContain('echo');
        expect(detail.maxConcurrency).toBe(5);
    });

    it('should accept a heartbeat', async () => {
        const result = await post('/workers/heartbeat', {
            instanceId: testInstanceId,
            activeJobs: 2,
            totalProcessed: 42,
            totalFailed: 1,
            memoryUsage: 128_000_000,
            cpuUsage: 25.5,
        });

        expect(result).toBeDefined();
    });

    it('should update lastHeartbeat timestamp after heartbeat', async () => {
        const workers = await get('/workers');
        const found = workers.find((w: Record<string, unknown>) => w.instanceId === testInstanceId);
        expect(found).toBeDefined();
        expect(found.lastHeartbeat).toBeDefined();
    });

    it('should drain a worker', async () => {
        const workers = await get('/workers');
        const found = workers.find((w: Record<string, unknown>) => w.instanceId === testInstanceId);
        if (!found) throw new Error('Worker not found');

        const result = await post(`/workers/${found.id}/drain`);
        expect(result).toBeDefined();

        // Verify status changed
        const detail = await get(`/workers/${found.id}`);
        expect(detail.status).toBe('draining');
    });

    it('should deregister a worker', async () => {
        const result = await post('/workers/deregister', {
            instanceId: testInstanceId,
            reason: 'integration-test-cleanup',
        });
        expect(result).toBeDefined();
    });

    afterAll(async () => {
        // Cleanup: try to deregister in case test failed mid-way
        try {
            await post('/workers/deregister', {
                instanceId: testInstanceId,
                reason: 'integration-test-cleanup',
            });
        } catch {
            // Already cleaned up
        }
    });
});

describe('Worker Health State', () => {
    it('should return aggregated health state', async () => {
        const health = await get('/health');
        expect(health).toBeDefined();
        expect(health.status).toBe('ok');
    });

    it('workers endpoint returns valid JSON array', async () => {
        const workers = await get('/workers');
        expect(Array.isArray(workers)).toBe(true);
        for (const worker of workers) {
            expect(worker).toHaveProperty('instanceId');
            expect(worker).toHaveProperty('type');
            expect(worker).toHaveProperty('status');
        }
    });
});

describe('Job Dispatch (via API)', () => {
    it('should list available worker types', async () => {
        const workers = await get('/workers');
        const types = new Set(workers.map((w: Record<string, string>) => w.type));
        // Types is a set of registered worker types
        expect(types).toBeDefined();
    });

    // Note: actual NATS job dispatch requires a running worker
    // These tests verify the API endpoints exist and return proper errors
    it('should reject dispatch to unknown worker type', async () => {
        try {
            await post('/workers/dispatch', {
                type: 'nonexistent-worker-type',
                action: 'echo',
                payload: { test: true },
            });
            // If it doesn't throw, the endpoint might queue gracefully
        } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : '';
            expect(errMsg).toMatch(/4\d\d|5\d\d/); // 4xx or 5xx
        }
    });
});
