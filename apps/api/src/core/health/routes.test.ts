import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../../test/helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
    app = await buildTestApp();
});

afterAll(async () => {
    await app.close();
});

describe('GET /api/health', () => {
    it('should return status ok', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/health' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.status).toBe('ok');
        expect(body.version).toBe('0.1.0');
        expect(body.uptime).toBeGreaterThan(0);
        expect(body.timestamp).toBeDefined();
    });

    it('should return ready', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/health/ready' });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.payload)).toEqual({ ready: true });
    });

    it('should return live', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/health/live' });
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.payload)).toEqual({ live: true });
    });
});

describe('GET /api/config', () => {
    it('should return runtime configuration', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/config' });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.authProvider).toBe('demo');
        expect(body.version).toBe('0.1.0');
        expect(body.features).toBeDefined();
        expect(body.features.topologyViewer).toBe(true);
    });
});
