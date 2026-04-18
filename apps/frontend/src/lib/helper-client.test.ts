import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HelperClient, HelperError } from './helper-client';

let client: HelperClient;

beforeEach(() => {
    client = new HelperClient();
    client.configure({ baseUrl: 'http://127.0.0.1:5050', token: 'test-token' });
    vi.restoreAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('HelperClient', () => {
    describe('configure', () => {
        it('should throw when not configured', async () => {
            const unconfigured = new HelperClient();
            await expect(unconfigured.health()).rejects.toThrow('not configured');
        });
    });

    describe('health', () => {
        it('should call GET /health without auth', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ status: 'ok', service: 'surdej-helper', uptime: 42, projectRoot: '/test' }),
            });
            vi.stubGlobal('fetch', mockFetch);

            const result = await client.health();
            expect(result.status).toBe('ok');
            expect(result.uptime).toBe(42);

            // Should NOT have Authorization header for health
            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toBe('http://127.0.0.1:5050/health');
            expect(options.headers.Authorization).toBeUndefined();
        });
    });

    describe('openInEditor', () => {
        it('should call POST /open with auth', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ ok: true, opened: '/test/file.ts:10' }),
            });
            vi.stubGlobal('fetch', mockFetch);

            const result = await client.openInEditor({ file: 'src/index.ts', line: 10 });
            expect(result.ok).toBe(true);

            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toBe('http://127.0.0.1:5050/open');
            expect(options.method).toBe('POST');
            expect(options.headers.Authorization).toBe('Bearer test-token');
            expect(JSON.parse(options.body)).toEqual({ file: 'src/index.ts', line: 10 });
        });
    });

    describe('readFile', () => {
        it('should call POST /read', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ file: '/test/a.ts', encoding: 'utf-8', size: 100, content: 'hello' }),
            });
            vi.stubGlobal('fetch', mockFetch);

            const result = await client.readFile({ file: 'a.ts' });
            expect(result.content).toBe('hello');
            expect(result.size).toBe(100);
        });
    });

    describe('exchangeToken', () => {
        it('should call POST /token', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ provider: 'azure', status: 'not_implemented', message: 'stub' }),
            });
            vi.stubGlobal('fetch', mockFetch);

            const result = await client.exchangeToken('azure');
            expect(result.provider).toBe('azure');
            expect(result.status).toBe('not_implemented');
        });
    });

    describe('isAvailable', () => {
        it('should return true when health succeeds', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ status: 'ok' }),
            }));
            expect(await client.isAvailable()).toBe(true);
        });

        it('should return false when health fails', async () => {
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
            expect(await client.isAvailable()).toBe(false);
        });

        it('should cache the availability result', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ status: 'ok' }),
            });
            vi.stubGlobal('fetch', mockFetch);

            await client.isAvailable();
            await client.isAvailable();
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should reset cache on resetAvailability', async () => {
            const mockFetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ status: 'ok' }),
            });
            vi.stubGlobal('fetch', mockFetch);

            await client.isAvailable();
            client.resetAvailability();
            await client.isAvailable();
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('error handling', () => {
        it('should throw HelperError on non-2xx response', async () => {
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                status: 403,
                statusText: 'Forbidden',
                json: () => Promise.resolve({ error: 'Invalid token' }),
            }));

            try {
                await client.readFile({ file: 'test.ts' });
                expect.fail('Should have thrown');
            } catch (err) {
                expect(err).toBeInstanceOf(HelperError);
                const helperErr = err as HelperError;
                expect(helperErr.status).toBe(403);
                expect(helperErr.endpoint).toBe('/read');
                expect(helperErr.message).toContain('Invalid token');
            }
        });
    });
});
