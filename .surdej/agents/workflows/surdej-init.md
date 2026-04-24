---
name: surdej-init
description: Initialize a fully configured local development workstation
---

## Objective
Configure a new workstation (physical or Codespace) for the Surdej platform. This workflow ensures that the local environment is isolated, fully configured with correct ports, and integrated with necessary services (Docker, OpenAI, etc.).

## Instructions for the Agent

1. **Identify Project Context**
   - Read `surdej.yaml` to identify the current project instance (e.g., `surdej-v1`, `surdej-test-nexi`, `surdej-test-pdf-refinery`).
   - Extract the configured ports for `frontend`, `api`, and `helper`.

2. **Generate Local Configuration (.env)**
   - Check if a root `.env` file exists. If not, create one.
   - Populate `.env` with:
     - `COMPOSE_PROJECT_NAME`: Matches the project name (to isolate Docker containers).
     - `API_PORT`, `FRONTEND_PORT`, `HELPER_PORT`: From `surdej.yaml`.
     - `API_URL`: `http://localhost:<API_PORT>`
     - Service keys placeholders: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (ask user for values or leave blank).

3. **Configure Docker & Services**
   - Ensure `docker-compose.yml` uses the ports defined in `.env` (e.g., `${API_PORT:-5001}:5001`).
   - Ensure `apps/frontend/vite.config.ts` and `apps/helper/src/server.ts` are configured to load these ports from the environment.

4. **Install & Build Dependencies**
   - Run `pnpm install`.
   - Explicitly build core and all module shared packages to prevent resolution errors:
     ```bash
     pnpm --filter @surdej/core build
     pnpm --filter @surdej/types build
     pnpm --filter "@surdej/module-*-shared" build
     ```

5. **Initialize Database & Docker**
   - Start the Docker stack:
     ```bash
     pnpm docker:up
     ```
   - **Important**: Database migrations must run *inside* the container network.
   - Run migrations: `pnpm db:migrate` (which runs `docker compose exec api ...`).
   - Seed the database: `pnpm db:seed`.

6. **Start Development Servers**
   - Instruct the user to start the frontend and helper in separate terminals:
     - `pnpm dev`
     - `pnpm dev:helper`
   - Verify the setup by checking `http://localhost:<API_PORT>/health`.

7. **Optional: Cloud Infrastructure Sync**
   - If the user intends to deploy, verify `infrastructure` variables in `surdej.yaml` and offer to sync them to GitHub Actions/Vars using `gh variable set`.

## Validation Checklist
- [ ] `.env` is created with correct `COMPOSE_PROJECT_NAME` and ports.
- [ ] `docker-compose.yaml` exposes the correct `API_PORT`.
- [ ] Dependencies (`@surdej/core`, `@surdej/types`) are built.
- [ ] Database is migrated and seeded.
- [ ] Frontend and Helper apps are runnable.
