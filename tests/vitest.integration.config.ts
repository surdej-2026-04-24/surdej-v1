import { defineConfig } from 'vitest/config';

/**
 * Vitest config for integration tests.
 *
 * Runs worker registration, heartbeat, and job dispatch tests
 * against a running API + NATS instance.
 */
export default defineConfig({
    test: {
        include: ['integration/**/*.test.ts'],
        testTimeout: 30_000,
        hookTimeout: 15_000,
    },
});
