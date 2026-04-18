---
name: surdej-newmodule
description: Scaffold a complete self-registering module with shared DTOs, worker, UI, commands, skin integration, Prisma schema, and NATS subjects
---

# Scaffold a New Module

This workflow creates a complete vertical-slice module at `modules/<membername>-<subject>/`
with `shared/`, `worker/`, and `ui/` sub-packages, plus command registration, skin wiring,
Prisma schema, and NATS subjects. See `.surdej/agents/guidelines/instructions.md` §16a.

## Prerequisites

- pnpm workspace configured with `modules/*/*` glob (see `pnpm-workspace.yaml`)
- Docker infra running (Postgres, NATS, Redis) or equivalent local services
- The user provides a **member name** and **subject**

## Step 1 — Interview

Ask the user **four questions** (batch them):

1. **Member name** — The namespace prefix (kebab-case). Examples: `member`, `ssn`, `senior`.
   Default: `member`
2. **Subject** — The feature (kebab-case). Examples: `activities`, `volunteers`, `scheduling`.
3. **Entity name** — PascalCase name for the primary data entity. Examples: `Activity`, `Volunteer`.
   Default: derived from subject (e.g. `activities` → `Activity`)
4. **Description** — One-sentence description of what the module does.

Derived values:
- `MODULE_SLUG` = `<membername>-<subject>` (e.g. `member-activities`)
- `MODULE_PATH` = `modules/<MODULE_SLUG>/`
- `PRISMA_SCHEMA` = `<membername>_<subject>` (hyphens → underscores, e.g. `member_activities`)
- `MODULE_PORT` = next available port starting from 7001 (scan existing modules to avoid conflicts)

## Step 2 — Create the Shared Package

Create `modules/<MODULE_SLUG>/shared/`:

### shared/package.json
```json
{
    "name": "@surdej/module-<MODULE_SLUG>-shared",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "main": "src/index.ts",
    "dependencies": {
        "zod": "^3.25.0"
    },
    "devDependencies": {
        "typescript": "^5.9.0-beta"
    }
}
```

### shared/tsconfig.json
```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "Node16",
        "moduleResolution": "Node16",
        "strict": true,
        "esModuleInterop": true,
        "declaration": true,
        "outDir": "dist",
        "rootDir": "src"
    },
    "include": ["src"]
}
```

### shared/src/schemas.ts
```typescript
import { z } from 'zod';

export const MODULE_NAME = '<MODULE_SLUG>';

// ─── NATS Subjects ─────────────────────────────────────────────

export const NATS_SUBJECTS = {
    register: 'module.register',
    deregister: 'module.deregister',
    heartbeat: 'module.heartbeat',
    events: `module.${MODULE_NAME}.>`,
} as const;

// ─── Schemas ───────────────────────────────────────────────────

export const <Entity>Schema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1),
    description: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type <Entity> = z.infer<typeof <Entity>Schema>;

export const Create<Entity>Schema = <Entity>Schema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export type Create<Entity> = z.infer<typeof Create<Entity>Schema>;

export const Update<Entity>Schema = Create<Entity>Schema.partial();
export type Update<Entity> = z.infer<typeof Update<Entity>Schema>;

export const <Entity>ListResponseSchema = z.object({
    items: z.array(<Entity>Schema),
    total: z.number(),
});
export type <Entity>ListResponse = z.infer<typeof <Entity>ListResponseSchema>;
```

### shared/src/index.ts
```typescript
export * from './schemas.js';
```

## Step 3 — Create the Worker Package

Create `modules/<MODULE_SLUG>/worker/`:

### worker/package.json
```json
{
    "name": "@surdej/module-<MODULE_SLUG>-worker",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "scripts": {
        "dev": "tsx watch --env-file=.env src/server.ts",
        "build": "tsc",
        "start": "node dist/server.js",
        "prisma:generate": "prisma generate",
        "prisma:migrate": "prisma migrate dev"
    },
    "dependencies": {
        "@fastify/cors": "^11.0.1",
        "@prisma/client": "^6.9.0",
        "@surdej/module-<MODULE_SLUG>-shared": "workspace:*",
        "fastify": "^5.3.3",
        "nats": "^2.29.3"
    },
    "devDependencies": {
        "prisma": "^6.9.0",
        "tsx": "^4.19.4",
        "typescript": "^5.9.0-beta"
    }
}
```

### worker/tsconfig.json
```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "Node16",
        "moduleResolution": "Node16",
        "strict": true,
        "esModuleInterop": true,
        "declaration": true,
        "outDir": "dist",
        "rootDir": "src"
    },
    "include": ["src"]
}
```

### worker/prisma/schema/<PRISMA_SCHEMA>.prisma
```prisma
generator client {
    provider        = "prisma-client-js"
    output          = "../../node_modules/.prisma/<MODULE_SLUG>-client"
    previewFeatures = ["multiSchema"]
}

datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
    schemas  = ["<PRISMA_SCHEMA>"]
}

model <Entity> {
    id          String   @id @default(uuid())
    title       String
    description String?
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt

    @@schema("<PRISMA_SCHEMA>")
}
```

### worker/.env
```dotenv
DATABASE_URL="postgresql://surdej:surdej_dev@localhost:5432/surdej?schema=public"
MODULE_PORT=<MODULE_PORT>
NATS_URL=nats://localhost:4222
```

### worker/src/server.ts
```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connect, JSONCodec } from 'nats';
import { MODULE_NAME, NATS_SUBJECTS } from '@surdej/module-<MODULE_SLUG>-shared';
import { registerRoutes } from './routes.js';

const PORT = parseInt(process.env.MODULE_PORT ?? '<MODULE_PORT>', 10);
const HOST = process.env.MODULE_HOST ?? '0.0.0.0';
const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';
const MODULE_ID = process.env.MODULE_ID ?? crypto.randomUUID();

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
registerRoutes(app);

// ─── NATS Self-Registration ───
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

nc.publish(NATS_SUBJECTS.register, codec.encode(registration));

const heartbeat = setInterval(() => {
    nc.publish(NATS_SUBJECTS.heartbeat, codec.encode({
        moduleName: MODULE_NAME,
        timestamp: new Date().toISOString(),
    }));
}, 30_000);

// ─── Graceful Shutdown ───
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
        clearInterval(heartbeat);
        nc.publish(NATS_SUBJECTS.deregister, codec.encode({ moduleName: MODULE_NAME }));
        await nc.drain();
        await app.close();
    });
}

await app.listen({ port: PORT, host: HOST });
app.log.info(`Module ${MODULE_NAME} running on http://${HOST}:${PORT}`);
```

### worker/src/routes.ts
```typescript
import type { FastifyInstance } from 'fastify';
import {
    Create<Entity>Schema,
    Update<Entity>Schema,
    type <Entity>,
} from '@surdej/module-<MODULE_SLUG>-shared';

// In-memory store (replace with Prisma once schema is migrated)
const store = new Map<string, <Entity>>();

export function registerRoutes(app: FastifyInstance) {
    // GET / — List all
    app.get('/', async () => {
        const items = Array.from(store.values());
        return { items, total: items.length };
    });

    // GET /:id — Get by ID
    app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
        const item = store.get(req.params.id);
        if (!item) return reply.status(404).send({ error: 'Not found' });
        return item;
    });

    // POST / — Create
    app.post('/', async (req, reply) => {
        const result = Create<Entity>Schema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });
        const item: <Entity> = {
            id: crypto.randomUUID(),
            ...result.data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        store.set(item.id, item);
        return reply.status(201).send(item);
    });

    // PUT /:id — Update
    app.put<{ Params: { id: string } }>('/:id', async (req, reply) => {
        const existing = store.get(req.params.id);
        if (!existing) return reply.status(404).send({ error: 'Not found' });
        const result = Update<Entity>Schema.safeParse(req.body);
        if (!result.success) return reply.status(400).send({ error: result.error.issues });
        const updated: <Entity> = {
            ...existing,
            ...result.data,
            updatedAt: new Date().toISOString(),
        };
        store.set(updated.id, updated);
        return updated;
    });

    // DELETE /:id — Remove
    app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
        if (!store.delete(req.params.id)) return reply.status(404).send({ error: 'Not found' });
        return { success: true };
    });
}
```

## Step 4 — Create the UI Package

Create `modules/<MODULE_SLUG>/ui/`:

### ui/package.json
```json
{
    "name": "@surdej/module-<MODULE_SLUG>-ui",
    "version": "0.1.0",
    "private": true,
    "type": "module",
    "main": "src/index.ts",
    "peerDependencies": {
        "react": "^19.0.0",
        "react-dom": "^19.0.0"
    },
    "dependencies": {
        "@surdej/module-<MODULE_SLUG>-shared": "workspace:*"
    },
    "devDependencies": {
        "@types/react": "^19.1.0",
        "typescript": "^5.9.0-beta"
    }
}
```

### ui/tsconfig.json
```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "Node16",
        "moduleResolution": "Node16",
        "strict": true,
        "esModuleInterop": true,
        "jsx": "react-jsx",
        "declaration": true,
        "outDir": "dist",
        "rootDir": "src"
    },
    "include": ["src"]
}
```

### ui/src/hooks/useModuleApi.ts
```typescript
import {
    MODULE_NAME,
    <Entity>Schema,
    <Entity>ListResponseSchema,
    type <Entity>,
    type Create<Entity>,
    type Update<Entity>,
    type <Entity>ListResponse,
} from '@surdej/module-<MODULE_SLUG>-shared';

const BASE = `/api/module/${MODULE_NAME}`;

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
}

export function useModuleApi() {
    return {
        list: async (): Promise<<Entity>ListResponse> => {
            const data = await request<unknown>('/');
            return <Entity>ListResponseSchema.parse(data);
        },
        get: async (id: string): Promise<<Entity>> => {
            const data = await request<unknown>(`/${id}`);
            return <Entity>Schema.parse(data);
        },
        create: async (input: Create<Entity>): Promise<<Entity>> => {
            const data = await request<unknown>('/', {
                method: 'POST',
                body: JSON.stringify(input),
            });
            return <Entity>Schema.parse(data);
        },
        update: async (id: string, input: Update<Entity>): Promise<<Entity>> => {
            const data = await request<unknown>(`/${id}`, {
                method: 'PUT',
                body: JSON.stringify(input),
            });
            return <Entity>Schema.parse(data);
        },
        remove: async (id: string): Promise<void> => {
            await request(`/${id}`, { method: 'DELETE' });
        },
    };
}
```

### ui/src/commands.ts
```typescript
/**
 * Command definitions for the <MODULE_SLUG> module.
 * Register these with the CommandRegistry in the frontend app.
 */
export const MODULE_COMMANDS = [
    {
        id: 'module.<subject>.list',
        title: '<Entity> — Oversigt',
        icon: 'List',
        category: 'Module',
    },
    {
        id: 'module.<subject>.create',
        title: 'Ny <Entity>',
        icon: 'Plus',
        category: 'Module',
    },
] as const;

export const MODULE_SIDEBAR_ITEMS = [
    { commandId: 'module.<subject>.list', group: '<Entity>', order: 1 },
    { commandId: 'module.<subject>.create', group: '<Entity>', order: 2 },
];
```

### ui/src/components/<Entity>List.tsx
```tsx
import { useState, useEffect } from 'react';
import { useModuleApi } from '../hooks/useModuleApi';
import type { <Entity> } from '@surdej/module-<MODULE_SLUG>-shared';

export function <Entity>List() {
    const api = useModuleApi();
    const [items, setItems] = useState<<Entity>[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.list().then(res => {
            setItems(res.items);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-4 text-muted-foreground">Loading...</div>;
    if (items.length === 0) return <div className="p-4 text-muted-foreground">No items yet.</div>;

    return (
        <div className="space-y-2 p-4">
            {items.map(item => (
                <div key={item.id} className="p-3 border rounded-lg">
                    <h3 className="font-medium">{item.title}</h3>
                    {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                </div>
            ))}
        </div>
    );
}
```

### ui/src/components/<Entity>Form.tsx
```tsx
import { useState } from 'react';
import { Create<Entity>Schema } from '@surdej/module-<MODULE_SLUG>-shared';
import { useModuleApi } from '../hooks/useModuleApi';

interface Props {
    onCreated?: () => void;
}

export function <Entity>Form({ onCreated }: Props) {
    const api = useModuleApi();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const result = Create<Entity>Schema.safeParse({ title, description });
        if (!result.success) {
            setError(result.error.issues.map(i => i.message).join(', '));
            return;
        }
        setSaving(true);
        try {
            await api.create(result.data);
            setTitle('');
            setDescription('');
            onCreated?.();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
            {error && <div className="text-destructive text-sm">{error}</div>}
            <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full p-2 border rounded"
                required
            />
            <textarea
                placeholder="Description (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full p-2 border rounded"
                rows={3}
            />
            <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            >
                {saving ? 'Saving...' : 'Create'}
            </button>
        </form>
    );
}
```

### ui/src/index.ts
```typescript
export { <Entity>List } from './components/<Entity>List.js';
export { <Entity>Form } from './components/<Entity>Form.js';
export { useModuleApi } from './hooks/useModuleApi.js';
export { MODULE_COMMANDS, MODULE_SIDEBAR_ITEMS } from './commands.js';
```

## Step 5 — Wire into Skin (Optional)

If the user wants to add sidebar items to an existing skin, update the skin record in the seed
or directly in the database. Example using the SSN skin:

```typescript
// In prisma/seed.ts or via API:
// Add MODULE_SIDEBAR_ITEMS entries to the skin's sidebar array
```

## Step 6 — Install & Verify

// turbo
```bash
pnpm install
```

Verify all 3 packages are recognized:
```bash
pnpm list --filter "@surdej/module-<MODULE_SLUG>-*" --depth=0
```

## Step 7 — Inform the User

Print these next steps:

1. **Generate Prisma client:**
   ```bash
   cd modules/<MODULE_SLUG>/worker && pnpm prisma:generate
   ```

2. **Create the database schema:**
   ```bash
   cd modules/<MODULE_SLUG>/worker && pnpm prisma:migrate
   ```

3. **Start the worker:**
   ```bash
   pnpm --filter @surdej/module-<MODULE_SLUG>-worker dev
   ```

4. **Import UI in the frontend** — use `@surdej/module-<MODULE_SLUG>-ui`

5. **Register commands** — import `MODULE_COMMANDS` from the UI package and register with `CommandRegistry`

6. The core API gateway auto-discovers the module via NATS at `/api/module/<MODULE_SLUG>/`

## Important Rules

1. **Never import from `@surdej/core` or `apps/api`** — modules are standalone
2. **Prisma schema** uses underscored name in a separate PostgreSQL schema (e.g. `member_activities`)
3. **UI hooks call `/api/module/<MODULE_SLUG>`** — never the worker directly
4. **Shared DTOs are mandatory** — never duplicate Zod schemas between worker and UI
5. **Each module gets a unique port** — scan existing `MODULE_PORT` values to avoid conflicts
6. **Placeholders** — replace all `<Entity>`, `<MODULE_SLUG>`, `<PRISMA_SCHEMA>`, `<MODULE_PORT>`, `<subject>` with actual values during scaffolding
