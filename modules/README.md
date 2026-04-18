# Modules

Self-contained business feature modules. Each module is a complete vertical slice:

| Subfolder | Contents | Package Name |
|-----------|----------|--------------|
| `shared/` | Zod schemas (DTOs) shared between UI and worker | `@surdej/module-<name>-shared` |
| `worker/` | Standalone Fastify HTTP server + NATS registration | `@surdej/module-<name>-worker` |
| `ui/`     | React components consumed by the frontend | `@surdej/module-<name>-ui` |

## Naming Convention

Module folders use the pattern `member-<feature>`:

```
modules/
├── member-example/     # Template/reference module
├── member-onboarding/  # User onboarding flows
├── member-billing/     # Billing and invoicing
└── member-reports/     # Report generation
```

## How It Works

1. **Module worker starts** → connects to NATS → publishes `module.register` with its name and HTTP base URL.
2. **Core API gateway** listens on `module.register` → adds a reverse proxy route at `/api/module/<name>/*`.
3. **Frontend** imports UI components from `@surdej/module-<name>-ui` and calls `/api/module/<name>/...`.
4. **Shared DTOs** (Zod schemas) are imported by both worker and UI for type-safe validation.

## Creating a New Module

```bash
# Copy the example module
cp -r modules/member-example modules/member-my-feature

# Rename packages in package.json files
# Update NATS registration name in worker/src/server.ts
# Add to pnpm-workspace.yaml
# Add to docker-compose.yml (optional)
```

Or use the `/new-module` workflow if available.
