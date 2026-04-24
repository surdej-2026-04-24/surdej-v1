import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../db.js';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { generateTotpSetup, verifyTotp, generateBackupCodes, verifyBackupCode } from './totp.js';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
    const MFA_TOKEN_EXPIRY = 5 * 60; // 5 minutes

    /** Create a short-lived JWT for MFA challenge */
    function createMfaChallengeToken(userId: string): string {
        const secret = process.env['SESSION_SECRET'] || 'surdej-mfa-secret';
        return jwt.sign({ userId, purpose: 'mfa-challenge' }, secret, { expiresIn: MFA_TOKEN_EXPIRY });
    }

    /** If user has TOTP enabled, return mfa_required response instead of a session */
    function mfaChallengeResponse(user: { id: string; totpEnabled: boolean }) {
        if (!user.totpEnabled) return null;
        return {
            mfa_required: true,
            mfaToken: createMfaChallengeToken(user.id),
        };
    }

    /** Roles that require MFA */
    const MFA_REQUIRED_ROLES = ['ADMIN', 'SUPER_ADMIN'];

    /** Check if this user is an admin who needs MFA but hasn't set it up */
    function isAdminMissingMfa(user: { role: string; totpEnabled: boolean }): boolean {
        return MFA_REQUIRED_ROLES.includes(user.role) && !user.totpEnabled;
    }
    // POST /api/auth/lookup
    // Resolves tenants and auth providers based on email domain
    app.post('/lookup', async (req, reply) => {
        const { email } = z.object({ email: z.string().email() }).parse(req.body);
        const domain = email.split('@')[1];

        // 1. Find tenants by domain
        const tenantDomains = await prisma.tenantDomain.findMany({
            where: { domain },
            include: {
                tenant: {
                    include: {
                        authProviders: {
                            where: { isEnabled: true },
                            select: { type: true, connectionId: true, metadata: true, clientId: true }
                        }
                    }
                }
            }
        });

        // 2. If tenants found, return them with providers
        if (tenantDomains.length > 0) {
            return {
                outcome: tenantDomains.length === 1 ? 'found' : 'multiple',
                tenants: tenantDomains.map((td: any) => ({
                    id: td.tenant.id,
                    name: td.tenant.name,
                    slug: td.tenant.slug,
                    logoUrl: td.tenant.logoUrl,
                    backgroundUrl: td.tenant.backgroundUrl,
                    providers: td.tenant.authProviders
                }))
            };
        }

        // 3. Fallback: use the default (first non-demo) tenant's auth provider
        //    This allows any email (e.g. niels@happymates.dk) to sign in via SSO
        //    even if their domain isn't explicitly registered.
        const defaultTenant = await prisma.tenant.findFirst({
            where: { isDemo: false, deletedAt: null },
            include: {
                authProviders: {
                    where: { isEnabled: true },
                    select: { type: true, connectionId: true, metadata: true, clientId: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        if (defaultTenant && defaultTenant.authProviders.length > 0) {
            console.log(`[Auth Lookup] No domain match for '${domain}', falling back to default tenant: ${defaultTenant.name}`);
            return {
                outcome: 'found',
                tenants: [{
                    id: defaultTenant.id,
                    name: defaultTenant.name,
                    slug: defaultTenant.slug,
                    logoUrl: defaultTenant.logoUrl,
                    backgroundUrl: defaultTenant.backgroundUrl,
                    providers: defaultTenant.authProviders
                }]
            };
        }

        // 4. Last resort: check for demo users
        const demoUsers = await prisma.user.findMany({
            where: { isDemoUser: true },
            select: { id: true, email: true, name: true, displayName: true, role: true, avatarUrl: true }
        });

        if (demoUsers.length > 0) {
            return {
                outcome: 'demo',
                users: demoUsers
            };
        }

        return reply.status(404).send({
            outcome: 'none',
            error: 'No workspace found for this email domain.'
        });
    });

    // GET /api/auth/resolve-host?hostname=foo.bar.com
    // Resolves public info for a tenant if the hostname matches a verified domain
    app.get<{ Querystring: { hostname: string } }>('/resolve-host', async (req, reply) => {
        const { hostname } = req.query;
        if (!hostname) return reply.status(400).send({ error: 'Missing hostname' });

        const tenantDomain = await prisma.tenantDomain.findFirst({
            where: { domain: hostname, verified: true },
            include: {
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        logoUrl: true,
                        backgroundUrl: true,
                        description: true,
                        metadata: true
                    }
                }
            }
        });

        if (tenantDomain) {
            return {
                found: true,
                tenant: tenantDomain.tenant
            };
        }

        // Fallback: if hostname doesn't match (e.g. localhost in dev),
        // return the first non-demo tenant as the default login context
        const defaultTenant = await prisma.tenant.findFirst({
            where: { isDemo: false, deletedAt: null },
            select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                backgroundUrl: true,
                description: true,
                metadata: true
            },
            orderBy: { createdAt: 'asc' }
        });

        if (defaultTenant) {
            return { found: true, tenant: defaultTenant };
        }

        return { found: false };
    });

    // ─── Dev-only: Impersonation ─────────────────────────────────────
    // These endpoints are only available in non-production environments.

    if (process.env.NODE_ENV !== 'production') {
        // GET /api/auth/dev/tenant-users?tenantId=... — list all users in a tenant
        app.get<{ Querystring: { tenantId?: string } }>('/dev/tenant-users', async (req, reply) => {
            // If no tenantId provided, use the first non-demo tenant
            let targetTenantId = req.query.tenantId;
            if (!targetTenantId) {
                const defaultTenant = await prisma.tenant.findFirst({
                    where: { isDemo: false, deletedAt: null },
                    select: { id: true },
                    orderBy: { createdAt: 'asc' }
                });
                targetTenantId = defaultTenant?.id;
            }

            if (!targetTenantId) {
                return reply.status(404).send({ error: 'No tenant found' });
            }

            const users = await prisma.user.findMany({
                where: { tenantId: targetTenantId, deletedAt: null },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    displayName: true,
                    role: true,
                    avatarUrl: true,
                },
                orderBy: [{ role: 'asc' }, { name: 'asc' }],
            });

            return reply.send({ tenantId: targetTenantId, users });
        });

        // POST /api/auth/dev/impersonate — create a session as any user
        app.post('/dev/impersonate', async (req, reply) => {
            const { userId } = req.body as { userId: string };
            if (!userId) return reply.status(400).send({ error: 'userId required' });

            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) return reply.status(404).send({ error: 'User not found' });

            const session = await prisma.session.create({
                data: {
                    userId: user.id,
                    token: crypto.randomUUID(),
                    provider: 'dev',
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                },
            });

            console.log(`[Dev] Impersonating user: ${user.email} (${user.name})`);

            return reply.send({
                token: session.token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    displayName: user.displayName,
                    role: user.role,
                    avatarUrl: user.avatarUrl,
                    authProvider: session.provider,
                },
            });
        });
    }

    // POST /api/auth/login
    app.post('/login', async (request: FastifyRequest, reply) => {
        const authProvider = process.env['AUTH_PROVIDER'] ?? 'demo';

        if (authProvider === 'demo') {
            const body = loginSchema.parse(request.body);
            const user = await prisma.user.findUnique({ where: { email: body.email } });

            if (!user) {
                return reply.status(401).send({ error: 'User not found' });
            }

            // Check if MFA is required
            const mfa = mfaChallengeResponse(user);
            if (mfa) {
                return reply.send(mfa);
            }

            // Create a session
            const session = await prisma.session.create({
                data: {
                    userId: user.id,
                    token: crypto.randomUUID(),
                    provider: 'demo',
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
                },
            });

            return reply.send({
                token: session.token,
                mfaSetupRequired: isAdminMissingMfa(user),
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    displayName: user.displayName,
                    role: user.role,
                    avatarUrl: user.avatarUrl,
                    authProvider: session.provider,
                },
            });
        }

        // Entra ID / other providers — JWT validation happens in middleware
        return reply.status(501).send({ error: `Auth provider '${authProvider}' not yet implemented` });
    });

    // GET /api/auth/login/:provider — Start OAuth flow
    app.get<{ Params: { provider: string }, Querystring: { tenantId: string, redirect: string, login_hint?: string } }>('/login/:provider', async (req, reply) => {
        const { provider } = req.params;
        const { tenantId, redirect, login_hint } = req.query;

        if (!tenantId) {
            return reply.status(400).send({ error: 'Tenant ID required' });
        }

        // Find provider config
        const config = await prisma.authProvider.findUnique({
            where: {
                tenantId_type: {
                    tenantId,
                    type: provider // e.g. 'microsoft'
                }
            }
        });

        if (!config || !config.isEnabled || !config.clientId) {
            return reply.status(404).send({ error: 'Provider not configured' });
        }

        // Construct Auth URL
        if (config.type === 'microsoft' || config.type === 'entra') {
            const metadata = config.metadata as any;
            const scope = 'openid profile email User.Read';
            const state = Buffer.from(JSON.stringify({ tenantId, redirect })).toString('base64');
            const callbackUrl = `${process.env.API_URL || 'http://localhost:5001'}/api/auth/callback/${provider}`;

            const params = new URLSearchParams({
                client_id: config.clientId,
                response_type: 'code',
                redirect_uri: callbackUrl,
                response_mode: 'query',
                scope,
                state
            });

            if (login_hint) {
                params.append('login_hint', login_hint);
            }

            const url = `https://login.microsoftonline.com/${metadata.tenantId || 'common'}/oauth2/v2.0/authorize?${params.toString()}`;
            return reply.redirect(url);
        }

        return reply.status(501).send({ error: 'Provider not supported yet' });
    });

    // GET /api/auth/callback/:provider — Handle OAuth code
    app.get<{ Params: { provider: string }, Querystring: { code: string, state: string, error?: string } }>('/callback/:provider', async (req, reply) => {
        const { provider } = req.params;
        const { code, state, error } = req.query;

        if (error) {
            return reply.status(400).send({ error: `OAuth Error: ${error}` });
        }

        let decodedState: any = {};
        try {
            decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        } catch {
            // Ignore parse errors from invalid state
        }

        // TODO: Exchange code for token using config.clientSecret
        // For now, simulate success or error

        return reply.send({
            message: 'OAuth callback received. Implementation pending client secret.',
            code,
            provider,
            state: decodedState
        });
    });

    // POST /api/auth/callback/microsoft-spa
    app.post('/callback/microsoft-spa', async (req, reply) => {
        const { idToken, tenantId, clientId } = req.body as { idToken: string, accessToken: string, tenantId: string, clientId?: string };

        if (!idToken) {
            return reply.status(400).send({ error: 'Missing idToken' });
        }

        // 0. Resolve Internal Tenant ID
        let internalTenantId = tenantId;
        console.log(`[Auth] Resolving tenant for ClientID: ${clientId}, MS TenantID: ${tenantId}`);

        if (clientId) {
            const provider = await prisma.authProvider.findFirst({
                where: { clientId }
            });
            if (provider) {
                internalTenantId = provider.tenantId;
                console.log(`[Auth] Mapped to Internal TenantID: ${internalTenantId}`);
            } else {
                console.warn(`[Auth] ClientID ${clientId} not found in AuthProvider table. Falling back to MS TenantID.`);
            }
        }

        // Verify that the resolved tenant exists to avoid FK errors later
        const tenantExists = await prisma.tenant.findUnique({
            where: { id: internalTenantId },
            select: { id: true }
        });

        if (!tenantExists) {
            console.error(`[Auth] Tenant ${internalTenantId} does not exist in local database.`);
            return reply.status(400).send({
                error: 'Configuration Error',
                message: `Tenant not found for Client ID (mapped to ${internalTenantId}). Please ensure the Authentication Provider is correctly configured.`
            });
        }

        // 1. Verify token (Decode for now, assuming trust in HTTPS transport from client)
        // In production, verify signature with jwks-rsa against Microsoft keys
        const decoded = jwt.decode(idToken) as any;
        if (!decoded) {
            return reply.status(400).send({ error: 'Invalid token' });
        }

        const email = decoded.email || decoded.preferred_username;
        if (!email) {
            return reply.status(400).send({ error: 'Token missing email' });
        }

        // 2. Find or Create User (JIT)
        let user = await prisma.user.findUnique({ where: { email } });

        // ─── Extract Entra ID Roles ───
        // Default all users to superadmin (full access for all prod users)
        let targetRoleSlug = 'superadmin';
        if (Array.isArray(decoded.roles) && decoded.roles.length > 0) {
            // Map Entra ID app role to tenant role slug (e.g. "Admin" -> "admin")
            targetRoleSlug = String(decoded.roles[0]).toLowerCase();
            console.log(`[Auth] Entra ID role found in token: ${decoded.roles[0]} -> mapping to slug: ${targetRoleSlug}`);
        }

        // Hardcoded admin access for niels@happymates.dk
        if (email.toLowerCase() === 'niels@happymates.dk') {
            targetRoleSlug = 'superadmin';
            console.log(`[Auth] Elevating ${email} to superadmin automatically.`);
        }

        const resolveRole = async (slug: string) => {
            let role = await prisma.tenantRole.findFirst({
                where: { tenantId: internalTenantId, isBuiltIn: true, slug }
            });

            if (!role) {
                let friendlyName = slug.charAt(0).toUpperCase() + slug.slice(1);
                let priority = 10; // member default

                if (slug === 'superadmin' || slug === 'super_admin') {
                    friendlyName = 'Super Admin';
                    priority = 100;
                } else if (slug === 'admin') {
                    friendlyName = 'Admin';
                    priority = 50;
                } else if (slug === 'reader') {
                    friendlyName = 'Reader';
                    priority = 0;
                }

                console.warn(`[Auth] Role '${slug}' not found for tenant. Auto-creating built-in role.`);
                role = await prisma.tenantRole.create({
                    data: {
                        tenantId: internalTenantId,
                        name: friendlyName,
                        slug: slug,
                        isBuiltIn: true,
                        priority: priority
                    }
                });
            }
            return role;
        };

        const resolvedRole = await resolveRole(targetRoleSlug);
        let globalRole: any = 'MEMBER';
        if (targetRoleSlug === 'admin' || targetRoleSlug === 'super_admin' || targetRoleSlug === 'superadmin') {
            globalRole = (targetRoleSlug === 'super_admin' || targetRoleSlug === 'superadmin') ? 'SUPER_ADMIN' : 'ADMIN';
        }

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    name: decoded.name || email.split('@')[0],
                    displayName: decoded.name,
                    role: globalRole, // Legacy global role
                    isDemoUser: false
                }
            });

            // Add to Tenant
            await prisma.userTenant.create({
                data: {
                    userId: user.id,
                    tenantId: internalTenantId,
                    roleId: resolvedRole.id,
                    isDefault: true
                }
            });
        } else {
            // Update global role if elevated, or generally sync it
            if (user.role !== globalRole) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { role: globalRole }
                });
                user.role = globalRole;
            }

            // Ensure membership
            const membership = await prisma.userTenant.findUnique({
                where: {
                    userId_tenantId: { userId: user.id, tenantId: internalTenantId }
                }
            });

            if (!membership) {
                await prisma.userTenant.create({
                    data: {
                        userId: user.id,
                        tenantId: internalTenantId,
                        roleId: resolvedRole.id,
                        isDefault: false
                    }
                });
            } else if (membership.roleId !== resolvedRole.id) {
                console.log(`[Auth] Syncing role for user ${user.email} -> ${targetRoleSlug}`);
                await prisma.userTenant.update({
                    where: { id: membership.id },
                    data: { roleId: resolvedRole.id }
                });
            }
        }


        // Check if MFA is required before creating session
        const mfa = mfaChallengeResponse(user);
        if (mfa) {
            return reply.send(mfa);
        }

        // 3. Create Session
        const session = await prisma.session.create({
            data: {
                userId: user.id,
                token: crypto.randomUUID(),
                provider: 'entra',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
            }
        });

        // 4. Return Session
        return {
            token: session.token,
            mfaSetupRequired: isAdminMissingMfa(user),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                displayName: user.displayName,
                role: user.role,
                avatarUrl: user.avatarUrl,
                authProvider: session.provider
            }
        };
    });

    // POST /api/auth/logout
    app.post('/logout', async (request: FastifyRequest, reply) => {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (token) {
            await prisma.session.deleteMany({ where: { token } });
        }
        return reply.send({ success: true });
    });

    // POST /api/auth/session/refresh — extend a valid session by 24h
    app.post('/session/refresh', async (request: FastifyRequest, reply) => {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return reply.status(401).send({ error: 'Not authenticated' });
        }

        const session = await prisma.session.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!session || session.expiresAt < new Date()) {
            return reply.status(401).send({ error: 'Session expired' });
        }

        // Extend session by 24 hours
        const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.session.update({
            where: { token },
            data: { expiresAt: newExpiry },
        });

        return reply.send({
            token: session.token,
            expiresAt: newExpiry.toISOString(),
            user: {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name,
                displayName: session.user.displayName,
                role: session.user.role,
                avatarUrl: session.user.avatarUrl,
                authProvider: session.provider,
            },
        });
    });

    // GET /api/auth/me
    app.get('/me', async (request: FastifyRequest, reply) => {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return reply.status(401).send({ error: 'Not authenticated' });
        }

        const session = await prisma.session.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!session || session.expiresAt < new Date()) {
            return reply.status(401).send({ error: 'Session expired' });
        }

        const { user } = session;

        // Fetch ACL context — tenant memberships + permissions
        const memberships = await prisma.userTenant.findMany({
            where: { userId: user.id, removedAt: null },
            include: {
                tenant: { select: { id: true, name: true, slug: true, logoUrl: true } },
                role: {
                    include: {
                        permissions: {
                            where: { granted: true },
                            include: { permission: true },
                        },
                    },
                },
            },
            orderBy: { joinedAt: 'asc' },
        });

        const defaultMembership = memberships.find(m => m.isDefault) ?? memberships[0];

        // Deduplicate permissions for the active role
        const seen = new Set<string>();
        const permissions = (defaultMembership?.role.permissions ?? [])
            .filter((rp: any) => {
                const key = `${rp.permission.resource}:${rp.permission.action}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .map((rp: any) => `${rp.permission.resource}:${rp.permission.action}`);

        return reply.send({
            id: user.id,
            email: user.email,
            name: user.name,
            displayName: user.displayName,
            role: user.role,             // legacy enum — kept for backward compat
            avatarUrl: user.avatarUrl,
            authProvider: session.provider,
            preferences: user.preferences ?? {},
            mfaEnabled: user.totpEnabled,
            mfaSetupRequired: isAdminMissingMfa(user),
            acl: {
                activeTenantId: defaultMembership?.tenantId ?? null,
                roleSlug: defaultMembership?.role.slug ?? null,
                rolePriority: defaultMembership?.role.priority ?? 0,
                permissions,
                tenants: memberships.map(m => ({
                    id: m.tenant.id,
                    name: m.tenant.name,
                    slug: m.tenant.slug,
                    logoUrl: m.tenant.logoUrl,
                    role: { name: m.role.name, slug: m.role.slug, priority: m.role.priority },
                    isDefault: m.isDefault,
                })),
            },
        });
    });

    // POST /api/auth/lookup/phone — Check if a phone number exists (no auth required)
    app.post('/lookup/phone', async (req, reply) => {
        const schema = z.object({
            phone: z.string().min(4).max(20),
        });

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid phone number format' });
        }

        const normalized = parsed.data.phone.replace(/[\s\-()]/g, '');

        const user = await prisma.user.findUnique({
            where: { phone: normalized },
            select: { id: true, displayName: true, name: true, avatarUrl: true },
        });

        if (!user) {
            return reply.send({ found: false });
        }

        return reply.send({
            found: true,
            displayName: user.displayName || user.name,
            avatarUrl: user.avatarUrl,
        });
    });

    // POST /api/auth/login/phone-pin — Authenticate with phone number + PIN code
    app.post('/login/phone-pin', async (req, reply) => {
        const schema = z.object({
            phone: z.string().min(4).max(20),
            pin: z.string().min(4).max(10),
        });

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid phone number or PIN format' });
        }

        const { phone, pin } = parsed.data;

        // Normalize: strip spaces/dashes, ensure E.164-ish
        const normalized = phone.replace(/[\s\-()]/g, '');

        const user = await prisma.user.findUnique({ where: { phone: normalized } });

        if (!user || !user.pinHash) {
            // Constant-time: always compare to avoid timing attacks
            await bcrypt.compare(pin, '$2a$10$dummy.hash.for.timing.attack.prevention.only');
            return reply.status(401).send({ error: 'Invalid phone number or PIN' });
        }

        const valid = await bcrypt.compare(pin, user.pinHash);
        if (!valid) {
            return reply.status(401).send({ error: 'Invalid phone number or PIN' });
        }

        // Check if MFA is required
        const mfa = mfaChallengeResponse(user);
        if (mfa) {
            return reply.send(mfa);
        }

        // Create session
        const session = await prisma.session.create({
            data: {
                userId: user.id,
                token: crypto.randomUUID(),
                provider: 'phone-pin',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
            },
        });

        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        return reply.send({
            token: session.token,
            mfaSetupRequired: isAdminMissingMfa(user),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                displayName: user.displayName,
                role: user.role,
                avatarUrl: user.avatarUrl,
                authProvider: session.provider,
            },
        });
    });

    // PUT /api/auth/me/preferences — update user preferences (shallow merge)
    app.put('/me/preferences', async (request: FastifyRequest<{ Body: Record<string, any> }>, reply) => {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return reply.status(401).send({ error: 'Not authenticated' });
        }

        const session = await prisma.session.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!session || session.expiresAt < new Date()) {
            return reply.status(401).send({ error: 'Session expired' });
        }

        const existing = (session.user.preferences as Record<string, any>) ?? {};
        const merged = { ...existing, ...(request.body ?? {}) };

        await prisma.user.update({
            where: { id: session.user.id },
            data: { preferences: merged },
        });

        return reply.send({ preferences: merged });
    });

    // ─── MFA / TOTP Endpoints ────────────────────────────────────────

    /** Helper: resolve authenticated user from Bearer token */
    async function getAuthenticatedUser(request: FastifyRequest, reply: any) {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            reply.status(401).send({ error: 'Not authenticated' });
            return null;
        }
        const session = await prisma.session.findUnique({
            where: { token },
            include: { user: true },
        });
        if (!session || session.expiresAt < new Date()) {
            reply.status(401).send({ error: 'Session expired' });
            return null;
        }
        return session.user;
    }

    // GET /api/auth/mfa/status — check if MFA is enabled for the current user
    app.get('/mfa/status', async (request, reply) => {
        const user = await getAuthenticatedUser(request, reply);
        if (!user) return;

        return reply.send({ enabled: user.totpEnabled });
    });

    // POST /api/auth/mfa/setup — generate TOTP secret + QR code (must be authenticated)
    app.post('/mfa/setup', async (request, reply) => {
        const user = await getAuthenticatedUser(request, reply);
        if (!user) return;

        if (user.totpEnabled) {
            return reply.status(400).send({ error: 'TOTP is already enabled. Disable it first to reconfigure.' });
        }

        const setup = await generateTotpSetup(user.email);

        // Store secret temporarily — not enabled until verified
        await prisma.user.update({
            where: { id: user.id },
            data: { totpSecret: setup.secret, totpEnabled: false },
        });

        return reply.send({
            qrCodeDataUrl: setup.qrCodeDataUrl,
            uri: setup.uri,
            // Never return the raw secret to the client for security; QR code is sufficient
        });
    });

    // POST /api/auth/mfa/verify-setup — verify initial token, enable TOTP, return backup codes
    app.post('/mfa/verify-setup', async (request, reply) => {
        const user = await getAuthenticatedUser(request, reply);
        if (!user) return;

        const { token } = z.object({ token: z.string().length(6) }).parse(request.body);

        if (!user.totpSecret) {
            return reply.status(400).send({ error: 'No TOTP setup in progress. Call /mfa/setup first.' });
        }

        const valid = verifyTotp(user.totpSecret, token);
        if (!valid) {
            return reply.status(400).send({ error: 'Invalid verification code. Please try again.' });
        }

        // Generate backup codes
        const backups = await generateBackupCodes();

        await prisma.user.update({
            where: { id: user.id },
            data: {
                totpEnabled: true,
                totpBackupCodes: backups.hashed,
            },
        });

        console.log(`[MFA] TOTP enabled for user: ${user.email}`);

        return reply.send({
            enabled: true,
            backupCodes: backups.plaintext, // Show once — never stored in plaintext
        });
    });

    // POST /api/auth/mfa/disable — disable TOTP (requires current TOTP token for confirmation)
    app.post('/mfa/disable', async (request, reply) => {
        const user = await getAuthenticatedUser(request, reply);
        if (!user) return;

        if (!user.totpEnabled || !user.totpSecret) {
            return reply.status(400).send({ error: 'TOTP is not enabled.' });
        }

        const { token } = z.object({ token: z.string().length(6) }).parse(request.body);

        const valid = verifyTotp(user.totpSecret, token);
        if (!valid) {
            return reply.status(400).send({ error: 'Invalid verification code.' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                totpEnabled: false,
                totpSecret: null,
                totpBackupCodes: [],
            },
        });

        console.log(`[MFA] TOTP disabled for user: ${user.email}`);

        return reply.send({ enabled: false });
    });

    // POST /api/auth/mfa/verify — verify TOTP or backup code during login challenge
    app.post('/mfa/verify', async (request, reply) => {
        const schema = z.object({
            mfaToken: z.string(),
            code: z.string().min(6).max(10),
        });

        const parsed = schema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Invalid request' });
        }

        const { mfaToken, code } = parsed.data;

        // Decode the MFA challenge token
        let mfaPayload: { userId: string; purpose: string };
        try {
            const secret = process.env['SESSION_SECRET'] || 'surdej-mfa-secret';
            mfaPayload = jwt.verify(mfaToken, secret) as any;
            if (mfaPayload.purpose !== 'mfa-challenge') throw new Error('Invalid purpose');
        } catch {
            return reply.status(401).send({ error: 'Invalid or expired MFA challenge. Please log in again.' });
        }

        const user = await prisma.user.findUnique({ where: { id: mfaPayload.userId } });
        if (!user || !user.totpSecret || !user.totpEnabled) {
            return reply.status(401).send({ error: 'MFA not configured for this user' });
        }

        // Try TOTP verification first (6-digit code)
        let verified = false;
        if (code.length === 6 && /^\d{6}$/.test(code)) {
            verified = verifyTotp(user.totpSecret, code);
        }

        // If not verified as TOTP, try backup code
        if (!verified) {
            const backupIndex = await verifyBackupCode(code, user.totpBackupCodes);
            if (backupIndex >= 0) {
                verified = true;
                // Remove used backup code
                const updatedCodes = [...user.totpBackupCodes];
                updatedCodes.splice(backupIndex, 1);
                await prisma.user.update({
                    where: { id: user.id },
                    data: { totpBackupCodes: updatedCodes },
                });
                console.log(`[MFA] Backup code used for user: ${user.email} (${user.totpBackupCodes.length - 1} remaining)`);
            }
        }

        if (!verified) {
            return reply.status(401).send({ error: 'Invalid verification code' });
        }

        // MFA passed — create full session
        const session = await prisma.session.create({
            data: {
                userId: user.id,
                token: crypto.randomUUID(),
                provider: 'mfa-verified',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });

        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        console.log(`[MFA] TOTP verified for user: ${user.email}`);

        return reply.send({
            token: session.token,
            mfaSetupRequired: isAdminMissingMfa(user),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                displayName: user.displayName,
                role: user.role,
                avatarUrl: user.avatarUrl,
                authProvider: session.provider,
            },
        });
    });
}
