---
name: surdej-new-feature
description: Scaffold a new feature module with all required files
---

# Scaffold a New Feature Module

This workflow creates a new self-contained module in `modules/member-<name>/` with `shared/`, `worker/`, and `ui/` sub-packages. See `.surdej/agents/guidelines/instructions.md` §16a for the full architecture.

## Prerequisites

- The user provides a **feature name** (e.g. `onboarding`, `billing`, `inventory`)
- The module naming convention is `member-<feature>`

## Steps

1. **Ask the user** for the module name if not provided. The name should be kebab-case (e.g. `onboarding`, `time-tracking`).

2. **Create the shared package** at `modules/member-<name>/shared/`:
   - `package.json` — name: `@surdej/module-member-<name>-shared`, with `zod` and `typescript` deps
   - `tsconfig.json` — extends nothing, target `ES2022`, module `Node16`
   - `src/schemas.ts` — initial Zod schemas with `MODULE_NAME` constant and at least one Create/Update schema
   - `src/index.ts` — barrel export

3. **Create the worker package** at `modules/member-<name>/worker/`:
   - `package.json` — name: `@surdej/module-member-<name>-worker`, with dependencies: `fastify`, `@fastify/cors`, `nats`, `@prisma/client`, `tsx`, `typescript`, plus workspace dep on the shared package
   - `tsconfig.json` — target `ES2022`, module `Node16`
   - `prisma/schema/member_<name>.prisma` — Prisma schema using PostgreSQL schema `member_<name>` (hyphens → underscores), with `multiSchema` preview feature, output to `../../node_modules/.prisma/member-<name>-client`
   - `src/server.ts` — Fastify server with NATS registration, heartbeat (30s), graceful shutdown
   - `src/routes.ts` — CRUD routes using shared Zod schemas for validation

4. **Create the UI package** at `modules/member-<name>/ui/`:
   - `package.json` — name: `@surdej/module-member-<name>-ui`, with `react` and `react-dom` as peer deps, workspace dep on shared package
   - `tsconfig.json` — target `ES2022`, module `Node16`, jsx `react-jsx`
   - `src/index.ts` — barrel export
   - `src/hooks/useModuleApi.ts` — hook that calls `/api/module/member-<name>/` through the core gateway
   - `src/components/` — at least one list and one form component

// turbo
5. **Install dependencies**: `pnpm install`

6. **Verify** the workspace recognized all 3 packages:
   ```bash
   pnpm list --filter "@surdej/module-member-<name>-*" --depth=0
   ```

7. **Inform the user** about next steps:
   - Run `pnpm --filter @surdej/module-member-<name>-worker prisma:generate` to generate the Prisma client
   - Run `pnpm --filter @surdej/module-member-<name>-worker prisma:migrate` after setting `DATABASE_URL` to create tables
   - Start the worker with `pnpm --filter @surdej/module-member-<name>-worker dev`
   - The core API gateway will auto-discover the module via NATS at `/api/module/member-<name>/`

## File Templates

### shared/src/schemas.ts
```typescript
import { z } from 'zod';

export const MODULE_NAME = 'member-<name>';

// ─── Schemas ───────────────────────────────────────────────────

export const <Name>Schema = z.object({
    id: z.string().uuid(),
    // ... fields
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type <Name> = z.infer<typeof <Name>Schema>;

export const Create<Name>Schema = <Name>Schema.omit({ id: true, createdAt: true, updatedAt: true });
export type Create<Name> = z.infer<typeof Create<Name>Schema>;

export const Update<Name>Schema = Create<Name>Schema.partial();
export type Update<Name> = z.infer<typeof Update<Name>Schema>;

export const <Name>ListSchema = z.array(<Name>Schema);
```

### worker/src/server.ts
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connect, JSONCodec } from 'nats';
import { MODULE_NAME } from '@surdej/module-member-<name>-shared';
import { registerRoutes } from './routes.js';

const PORT = parseInt(process.env.MODULE_PORT ?? '700X', 10);
const HOST = process.env.MODULE_HOST ?? '0.0.0.0';
const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4224';
const MODULE_ID = process.env.MODULE_ID ?? crypto.randomUUID();

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
registerRoutes(app);

// NATS self-registration
const nc = await connect({ servers: NATS_URL });
const codec = JSONCodec();
const registration = {
    moduleId: MODULE_ID,
    moduleName: MODULE_NAME,
    version: '0.1.0',
    baseUrl: `http://localhost:${PORT}`,
    routes: ['GET /', 'POST /', 'GET /:id', 'PUT /:id', 'DELETE /:id'],
    timestamp: new Date().toISOString(),
};

nc.publish('module.register', codec.encode(registration));
const heartbeat = setInterval(() => {
    nc.publish('module.heartbeat', codec.encode({
        moduleName: MODULE_NAME, timestamp: new Date().toISOString(),
    }));
}, 30_000);

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
        clearInterval(heartbeat);
        nc.publish('module.deregister', codec.encode({ moduleName: MODULE_NAME }));
        await nc.drain();
        await app.close();
    });
}

await app.listen({ port: PORT, host: HOST });
```

## Important Rules

1. **Never import from `@surdej/core` or `apps/api`** — modules are standalone
2. **Prisma schema name = module name** with underscores (e.g. `member_onboarding`)
3. **UI hooks call `/api/module/<name>`** — never the worker directly
4. **Shared DTOs are mandatory** — never duplicate Zod schemas
5. **Each module gets a unique port** — check existing modules to avoid conflicts
