/**
 * Shared pino logger for non-Fastify modules (worker-registry, gateway, etc.).
 * Uses the same compact colored console transport as the Fastify app logger.
 */
import pino from 'pino';

export const logger = pino({
    transport: {
        target: new URL('./console-transport.mjs', import.meta.url).pathname,
    },
});
