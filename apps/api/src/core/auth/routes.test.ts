import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, loginAs } from '../../test/helpers.js';

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
    app = await buildTestApp();
    token = await loginAs(app, 'admin@surdej.dev');
});

afterAll(async () => {
    await app.close();
});

describe('POST /api/auth/login', () => {
    it('should login with demo user', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: { email: 'admin@surdej.dev' },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.token).toBeDefined();
        expect(body.user.email).toBe('admin@surdej.dev');
        expect(body.user.role).toBe('SUPER_ADMIN');
    });

    it('should reject unknown user', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: { email: 'nobody@surdej.dev' },
        });
        expect(res.statusCode).toBe(401);
    });

    it('should reject invalid email', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: { email: 'not-an-email' },
        });
        expect(res.statusCode).toBe(500); // Zod throws
    });
});

describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/auth/me',
            headers: { authorization: 'Bearer ' + token },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.email).toBe('admin@surdej.dev');
        expect(body.role).toBe('SUPER_ADMIN');
    });

    it('should reject without token', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/auth/me',
        });
        expect(res.statusCode).toBe(401);
    });

    it('should reject with invalid token', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/auth/me',
            headers: { authorization: 'Bearer invalid-token' },
        });
        expect(res.statusCode).toBe(401);
    });
});

describe('POST /api/auth/logout', () => {
    it('should invalidate session', async () => {
        // Login fresh
        const loginRes = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: { email: 'member@surdej.dev' },
        });
        const { token: tempToken } = JSON.parse(loginRes.payload);

        // Verify token works
        const meRes = await app.inject({
            method: 'GET',
            url: '/api/auth/me',
            headers: { authorization: 'Bearer ' + tempToken },
        });
        expect(meRes.statusCode).toBe(200);

        // Logout
        const logoutRes = await app.inject({
            method: 'POST',
            url: '/api/auth/logout',
            headers: { authorization: 'Bearer ' + tempToken },
        });
        expect(logoutRes.statusCode).toBe(200);

        // Verify token no longer works
        const meRes2 = await app.inject({
            method: 'GET',
            url: '/api/auth/me',
            headers: { authorization: 'Bearer ' + tempToken },
        });
        expect(meRes2.statusCode).toBe(401);
    });
});
