import Fastify from 'fastify';
import { healthRoutes } from '../core/health/routes.js';
import { configRoutes } from '../core/config/routes.js';
import { authRoutes } from '../core/auth/routes.js';
import { usersRoutes } from '../core/users/routes.js';
import { featuresRoutes } from '../core/features/routes.js';
import { skinsRoutes } from '../core/skins/routes.js';
import { tenantsRoutes } from '../core/tenants/routes.js';
import { feedbackRoutes } from '../core/feedback/routes.js';

/**
 * Build a Fastify app for testing — does NOT listen on a port.
 * Use `app.inject()` to make requests.
 */
export async function buildTestApp() {
    const app = Fastify({ logger: false });

    await app.register(healthRoutes, { prefix: '/api/health' });
    await app.register(configRoutes, { prefix: '/api/config' });
    await app.register(authRoutes, { prefix: '/api/auth' });
    await app.register(usersRoutes, { prefix: '/api/users' });
    await app.register(featuresRoutes, { prefix: '/api/features' });
    await app.register(skinsRoutes, { prefix: '/api/skins' });
    await app.register(tenantsRoutes, { prefix: '/api/tenants' });
    await app.register(feedbackRoutes, { prefix: '/api/feedback' });

    await app.ready();
    return app;
}

/**
 * Login as a demo user and return the Bearer token.
 */
export async function loginAs(
    app: ReturnType<typeof Fastify>,
    email: string,
): Promise<string> {
    const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email },
    });
    const body = JSON.parse(res.payload) as { token: string };
    return body.token;
}
