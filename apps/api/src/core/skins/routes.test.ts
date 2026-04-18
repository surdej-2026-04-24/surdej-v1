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

describe('GET /api/skins', () => {
    it('should return built-in skins', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/skins' });
        expect(res.statusCode).toBe(200);
        const skins = JSON.parse(res.payload) as Array<{ name: string; isBuiltIn: boolean }>;
        expect(skins.length).toBeGreaterThanOrEqual(2);

        const defaultSkin = skins.find((s) => s.name === 'Default');
        expect(defaultSkin).toBeDefined();
        expect(defaultSkin!.isBuiltIn).toBe(true);
    });
});

describe('POST /api/skins', () => {
    it('should create a custom skin', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/skins',
            payload: {
                name: 'Test Custom Skin',
                description: 'For testing',
                branding: { title: 'Test' },
                sidebar: [{ commandId: 'navigate.home', group: 'Main', order: 1 }],
            },
        });
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.payload);
        expect(body.name).toBe('Test Custom Skin');
        expect(body.isBuiltIn).toBe(false);
    });
});

describe('DELETE /api/skins/:id', () => {
    it('should prevent deleting built-in skins', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: '/api/skins/skin-default',
        });
        expect(res.statusCode).toBe(403);
    });
});

describe('POST /api/skins/:id/clone', () => {
    it('should clone a skin', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/skins/skin-default/clone',
        });
        expect(res.statusCode).toBe(201);
        const body = JSON.parse(res.payload);
        expect(body.name).toBe('Default (Copy)');
        expect(body.isBuiltIn).toBe(false);
    });
});

describe('skin preferences', () => {
    it('GET /api/skins/me — should return a skin for authenticated user', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/skins/me',
            headers: { authorization: 'Bearer ' + token },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        // Should return either an active preference or fallback to a built-in skin
        expect(body.name).toBeDefined();
        expect(body.isBuiltIn).toBeDefined();
    });

    it('PUT /api/skins/me — should set and persist active skin', async () => {
        // Set to Minimal
        const res = await app.inject({
            method: 'PUT',
            url: '/api/skins/me',
            headers: { authorization: 'Bearer ' + token },
            payload: { skinId: 'skin-minimal' },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expect(body.name).toBe('Minimal');

        // Verify persisted via GET /me
        const meRes = await app.inject({
            method: 'GET',
            url: '/api/skins/me',
            headers: { authorization: 'Bearer ' + token },
        });
        const meBody = JSON.parse(meRes.payload);
        expect(meBody.name).toBe('Minimal');

        // Switch back to Default
        const res2 = await app.inject({
            method: 'PUT',
            url: '/api/skins/me',
            headers: { authorization: 'Bearer ' + token },
            payload: { skinId: 'skin-default' },
        });
        expect(res2.statusCode).toBe(200);
        expect(JSON.parse(res2.payload).name).toBe('Default');
    });
});
