---
name: surdej-boot
description: Boot the surdej development environment using VS Code tasks
---

## Quick Start: One-Command Bootstrap

Run the VS Code task **"Bootstrap: Install + Docker Up"** to install dependencies and start all infrastructure in one step. Then proceed to database setup (steps 4-6) and start the frontend (step 8).

## Step-by-Step Boot Process

### 1. Install All Dependencies
**Run VS Code task:** `Bootstrap: Install All Dependencies`
- Press `Cmd+Shift+P` → `Tasks: Run Task` → select `Bootstrap: Install All Dependencies`
- This runs: `pnpm install`

### 2. Start Infrastructure
**Run VS Code task:** `Docker: Start Infrastructure`
- Press `Cmd+Shift+P` → `Tasks: Run Task` → select `Docker: Start Infrastructure`
- Starts all services: Postgres, Redis, NATS, MinIO
- This runs: `docker compose up -d`

### 3. Wait for Services to Be Healthy
Monitor the Docker services:
```bash
sleep 5 && docker compose ps --format "table {{.Name}}\t{{.Status}}" | head -10
```

5. **Build Shared Packages**
   - Run: `pnpm --filter @surdej/core build`
   - This compiles `packages/core` to `dist/` — required by the frontend and other consumers that reference `@surdej/core` via its `exports` field.

### 6. Run Database Migrations
**Run VS Code task:** `DB: Prisma Migrate`
- Press `Cmd+Shift+P` → `Tasks: Run Task` → select `DB: Prisma Migrate`
- This runs: `docker compose run --rm api pnpm exec prisma migrate dev`

### 7. Generate Prisma Client
**Run VS Code task:** `DB: Prisma Generate`
- Press `Cmd+Shift+P` → `Tasks: Run Task` → select `DB: Prisma Generate`
- This runs: `docker compose run --rm api pnpm exec prisma generate`

### 8. Seed the Database
**Run VS Code task:** `DB: Prisma Seed`
- Press `Cmd+Shift+P` → `Tasks: Run Task` → select `DB: Prisma Seed`
- This runs: `docker compose run --rm api pnpm exec prisma db seed`

### 9. Verify API is Running
Check the API health endpoint:
```bash
sleep 3 && curl -s http://localhost:5001/api/health | python3 -m json.tool
```

### 10. Start the Frontend
**Run VS Code task:** `Dev: Surdej Frontend`
- Press `Cmd+Shift+P` → `Tasks: Run Task` → select `Dev: Surdej Frontend`
- Frontend will be available at `http://localhost:4002`
- This runs: `pnpm --filter @surdej/frontend dev`

### 11. Start the Browser Extension
**Run VS Code task:** `Dev: Surdej Extension`
- Press `Cmd+Shift+P` → `Tasks: Run Task` → select `Dev: Surdej Extension`
- Builds the extension with hot-reload via Vite + CRXJS
- This runs: `pnpm --filter @surdej/extension dev`

## Available VS Code Tasks

All boot steps are available as VS Code tasks in `.vscode/tasks.json`. Access them via:
- **Menu:** Terminal → Run Task
- **Keyboard:** `Cmd+Shift+P` → `Tasks: Run Task`

| Task Name | Purpose |
|---|---|
| `Bootstrap: Install All Dependencies` | Install pnpm dependencies |
| `Bootstrap: Install + Docker Up` | One-click: install deps + start Docker |
| `Docker: Start Infrastructure` | Start Postgres, Redis, NATS, MinIO |
| `Docker: Start All` | Start infrastructure + optional workers |
| `DB: Prisma Migrate` | Run database migrations |
| `DB: Prisma Generate` | Generate Prisma client |
| `DB: Prisma Seed` | Seed database with initial data |
| `Dev: Surdej API (Docker)` | Start API with Docker (with logs) |
| `Dev: Surdej Frontend` | Start Surdej frontend dev server |
| `Dev: Surdej Extension` | Start browser extension dev server |

## Notes

- All infrastructure (Postgres, Redis, NATS, MinIO) runs in Docker
- **API** runs in Docker on port **5001** (with volume mounts for hot-reload)
- **Frontend** runs natively on port **4002** via Vite
- **Browser extension** runs natively via Vite + CRXJS for hot-reload
- Workers are optional — start via `Docker: Start All` task or `docker compose --profile workers up -d`
