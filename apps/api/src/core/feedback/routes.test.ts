import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, loginAs } from '../../test/helpers.js';

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
    app = await buildTestApp();
    token = await loginAs(app, 'developer@surdej.dev');
});

afterAll(async () => {
    await app.close();
});

describe('POST /api/feedback', () => {
    it('should create feedback with auth', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/feedback',
            headers: { authorization: 'Bearer ' + token },
            payload: {
                type: 'bug',
                title: 'Test bug report',
                body: 'Something is broken',
            },
        });
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.payload);
        expect(body.type).toBe('bug');
        expect(body.title).toBe('Test bug report');
        expect(body.userId).toBeDefined();
        expect(body.status).toBe('open');
    });

    it('should create feedback without auth', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/feedback',
            payload: {
                type: 'feature',
                title: 'Anonymous feature request',
            },
        });
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.payload);
        expect(body.userId).toBeNull();
    });

    it('should reject invalid type', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/feedback',
            payload: {
                type: 'invalid',
                title: 'Test',
            },
        });
        expect(res.statusCode).toBe(500); // Zod throws
    });
});

describe('GET /api/feedback', () => {
    it('should return feedback entries', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/feedback' });
        expect(res.statusCode).toBe(200);
        const entries = JSON.parse(res.payload) as Array<{ title: string }>;
        expect(entries.length).toBeGreaterThanOrEqual(1);
    });
});

describe('GET /api/feedback/:id', () => {
    it('should return a feedback entry by id', async () => {
        // First get the list to find an ID
        const listRes = await app.inject({ method: 'GET', url: '/api/feedback' });
        const entries = JSON.parse(listRes.payload) as Array<{ id: string }>;
        const entry = entries[0]!;

        const res = await app.inject({ method: 'GET', url: '/api/feedback/' + entry.id });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.id).toBe(entry.id);
    });

    it('should return 404 for unknown feedback', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/feedback/00000000-0000-0000-0000-000000000000',
        });
        expect(res.statusCode).toBe(404);
    });
});
