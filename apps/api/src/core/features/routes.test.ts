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

describe('GET /api/features', () => {
    it('should return seeded feature flags', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/features' });
        expect(res.statusCode).toBe(200);
        const features = JSON.parse(res.payload) as Array<{ featureId: string; ring: number }>;
        expect(features.length).toBeGreaterThanOrEqual(6);

        const topology = features.find((f) => f.featureId === 'topology-viewer');
        expect(topology).toBeDefined();
        expect(topology!.ring).toBe(1); // Internal ring
    });
});

describe('GET /api/features/:id', () => {
    it('should return a feature by featureId', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/features/topology-viewer',
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.featureId).toBe('topology-viewer');
        expect(body.title).toBe('Topology Viewer');
    });

    it('should return 404 for unknown feature', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/features/nonexistent-feature',
        });
        expect(res.statusCode).toBe(404);
    });
});

describe('PUT /api/features/:id', () => {
    it('should update a feature ring', async () => {
        const res = await app.inject({
            method: 'PUT',
            url: '/api/features/topology-viewer',
            payload: { ring: 3 },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.ring).toBe(3);

        // Restore
        await app.inject({
            method: 'PUT',
            url: '/api/features/topology-viewer',
            payload: { ring: 1 },
        });
    });
});
