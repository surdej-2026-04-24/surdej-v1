# Surdej — Domain Extension Guide

> How to add your own domain to the Surdej platform.

---

## Overview

A **domain** is a self-contained feature area that extends the Surdej platform. Each domain consists of up to four parts:

| Part | Location | Purpose |
|------|----------|---------|
| **Frontend domain** | `apps/frontend/src/domains/<name>/` | Pages, components, manifests |
| **API plugin** | `apps/api/src/domains/<name>/` | REST endpoints, business logic |
| **Worker** | `workers/<name>/` | Background processing via NATS |
| **Topologies** | `domains/<name>/topologies/` | Architecture visualizations |

You only need the parts relevant to your domain. A simple domain might only have a frontend manifest and API plugin.

---

## Step 1: Create the Frontend Domain

### Directory structure

```
apps/frontend/src/domains/my-domain/
├── manifest.ts              # Domain manifest (required)
├── pages/
│   ├── DashboardPage.tsx    # Main page
│   └── DetailPage.tsx       # Detail page
└── topologies/
    └── architecture.generated.ts  # Generated topology
```

### The manifest

```typescript
// apps/frontend/src/domains/my-domain/manifest.ts

interface DomainManifest {
    id: string;
    name: string;
    version: string;
    commands: { id: string; title: string; icon?: string; when?: string }[];
    routes: { path: string; commandId: string; component: string }[];
    contextKeys?: string[];
    sidebarItems?: { commandId: string; order?: number; group?: string }[];
    topologies?: string[];
    activateOn?: string;
}

export const manifest: DomainManifest = {
    id: 'my-domain',
    name: 'My Domain',
    version: '1.0.0',

    commands: [
        {
            id: 'domain.my-domain.dashboard',
            title: 'My Dashboard',
            icon: 'LayoutDashboard',
        },
        {
            id: 'domain.my-domain.detail',
            title: 'Detail View',
            icon: 'FileText',
        },
    ],

    routes: [
        {
            path: '/my-domain',
            commandId: 'domain.my-domain.dashboard',
            component: 'pages/DashboardPage',
        },
        {
            path: '/my-domain/:id',
            commandId: 'domain.my-domain.detail',
            component: 'pages/DetailPage',
        },
    ],

    sidebarItems: [
        { commandId: 'domain.my-domain.dashboard', group: 'My Domain', order: 1 },
        { commandId: 'domain.my-domain.detail', group: 'My Domain', order: 2 },
    ],

    topologies: ['my-domain-architecture'],

    activateOn: 'isAuthenticated',
};

export default manifest;
```

### Command ID conventions

| Prefix | Purpose | Example |
|--------|---------|---------|
| `domain.<name>.*` | Domain navigation | `domain.pdf-refinery.refinery` |
| `navigate.*` | Core navigation | `navigate.home` |
| `tool.*` | Utility actions | `tool.worker.drain` |
| `app.*` | Application-wide | `app.toggle-theme` |

### Icon names

Use [Lucide React](https://lucide.dev/icons/) icon names (PascalCase). Examples: `FileStack`, `Upload`, `Search`, `Building2`, `Inbox`, `BookOpen`.

---

## Step 2: Create the API Plugin

### Directory structure

```
apps/api/src/domains/my-domain/
├── plugin.ts          # Fastify plugin (auto-discovered)
├── routes.ts          # Route definitions
└── service.ts         # Business logic
```

### The plugin

```typescript
// apps/api/src/domains/my-domain/plugin.ts
import type { FastifyInstance } from 'fastify';

export default async function myDomainPlugin(fastify: FastifyInstance) {
    // Register routes under /api/my-domain/
    fastify.get('/api/my-domain/items', async (request, reply) => {
        return { items: [] };
    });

    fastify.post('/api/my-domain/items', async (request, reply) => {
        const body = request.body as { name: string };
        return { id: crypto.randomUUID(), name: body.name };
    });
}

// Plugin metadata — used by the domain scanner
export const meta = {
    name: 'my-domain',
    version: '1.0.0',
    prefix: '/api/my-domain',
};
```

The API server auto-discovers plugins at `apps/api/src/domains/*/plugin.ts` on startup.

---

## Step 3: Create a Worker (Optional)

See the [Worker Development Guide](./worker-development.md) for full details.

### Quick start

```bash
cp -r workers/_template workers/my-worker
```

Edit `workers/my-worker/src/index.ts`:

```typescript
import { WorkerBase } from '@surdej/worker-template';

const worker = new WorkerBase({
    type: 'my-worker',
    version: '1.0.0',
    capabilities: ['process', 'transform'],
    maxConcurrency: 4,
    prismaSchema: 'my_domain',
});

worker.handle('job.my-domain.process', async (job) => {
    const { itemId } = job.payload;
    // Process the item...
    return { itemId, status: 'completed' };
});

worker.start();
```

Add to `docker-compose.yml`:

```yaml
my-worker:
    build:
        context: .
        dockerfile: workers/my-worker/Dockerfile
    profiles: ["workers"]
    environment:
        NATS_URL: nats://nats:4222
        NODE_ENV: development
    depends_on:
        nats:
            condition: service_healthy
```

---

## Step 4: Add Topologies (Optional)

Create topology definitions to visualize your domain in the Topology Hub:

```typescript
// apps/frontend/src/domains/my-domain/topologies/architecture.generated.ts
import type { TopologyDefinition } from '@surdej/core';

export const MY_DOMAIN_ARCHITECTURE: TopologyDefinition = {
    id: 'my-domain-architecture',
    type: 'infrastructure',
    name: 'My Domain Architecture',
    description: 'Infrastructure overview of My Domain.',
    icon: 'Network',
    commandId: 'navigate.topology.my-domain-architecture',
    layers: [
        {
            id: 'services',
            label: 'Services',
            icon: 'Server',
            visible: true,
            nodes: [
                {
                    id: 'my-api',
                    label: 'API',
                    icon: 'Server',
                    description: 'My Domain API endpoints.',
                    color: 'from-emerald-500 to-teal-500',
                    level: 0,
                    properties: [
                        { key: 'Port', value: '5001', copyable: true },
                    ],
                    tags: ['api'],
                },
            ],
        },
    ],
    actors: [],
    connections: [],
};
```

Then register the topology in your domain manifest:

```typescript
topologies: ['my-domain-architecture'],
```

And import it into the demo data file (or let the Vite plugin discover it automatically):

```typescript
// core/topology/demo-data.ts
import { MY_DOMAIN_ARCHITECTURE } from '@/domains/my-domain/topologies/architecture.generated';
```

---

## Step 5: Wire Into a Skin

For your domain pages to appear in the sidebar, they must be included in the active skin's sidebar items. Edit an existing skin or create a new one that includes your domain commands.

---

## Checklist

- [ ] Created `manifest.ts` with commands, routes, sidebar items
- [ ] Created page components in `pages/`
- [ ] Created API plugin (if needed) with `meta` export
- [ ] Created worker (if needed) with `WorkerBase`
- [ ] Added topology definitions (if needed)
- [ ] Registered topologies in manifest
- [ ] Added worker to `docker-compose.yml` (if applicable)
- [ ] Verified domain appears in ⌘K palette
- [ ] Verified pages render correctly
- [ ] Verified topology shows in Topology Hub

---

## See Also

- [Architecture Guide](./architecture.md) — Platform design overview
- [Worker Development Guide](./worker-development.md) — Building workers
- [Skin Creation Guide](./skin-creation.md) — Custom skins
