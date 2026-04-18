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

describe('GET /api/users', () => {
    it('should return seeded demo users', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/users' });
        expect(res.statusCode).toBe(200);
        const users = JSON.parse(res.payload) as Array<{ email: string; role: string }>;
        expect(users.length).toBeGreaterThanOrEqual(4);

        const admin = users.find((u) => u.email === 'admin@surdej.dev');
        expect(admin).toBeDefined();
        expect(admin!.role).toBe('SUPER_ADMIN');
    });
});

describe('GET /api/users/:id', () => {
    it('should return a user by id', async () => {
        // First get the list to find an ID
        const listRes = await app.inject({ method: 'GET', url: '/api/users' });
        const users = JSON.parse(listRes.payload) as Array<{ id: string; email: string }>;
        const user = users[0]!;

        const res = await app.inject({ method: 'GET', url: '/api/users/' + user.id });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.id).toBe(user.id);
        expect(body.email).toBe(user.email);
    });

    it('should return 404 for unknown user', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/users/00000000-0000-0000-0000-000000000000',
        });
        expect(res.statusCode).toBe(404);
    });
});
