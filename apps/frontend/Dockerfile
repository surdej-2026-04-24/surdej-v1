# ──────────────────────────────────────────────
# Surdej Frontend — Production Dockerfile
# Multi-stage build: Vite → Nginx static serve
# ──────────────────────────────────────────────

# ── Stage 1: Base ──
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.21.0 --activate
WORKDIR /app

# ── Stage 2: Dependencies ──
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/core/package.json packages/core/
COPY apps/frontend/package.json apps/frontend/
# Copy module package.json files for workspace resolution
COPY modules/ modules/
RUN pnpm install --frozen-lockfile --prod=false

# ── Stage 3: Build ──
FROM deps AS builder

# Copy all sources needed for the build
COPY packages/core/ packages/core/
COPY apps/frontend/ apps/frontend/
COPY modules/ modules/
COPY contracts/ contracts/
COPY tsconfig.json ./

# Build core first
RUN pnpm --filter @surdej/core build

# Build shared modules referenced by UI
    pnpm --filter @surdej/module-member-nosql-shared build

# Build frontend (Vite)
ARG VITE_API_URL=
ARG VITE_AUTH_PROVIDER=entra
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_AUTH_PROVIDER=${VITE_AUTH_PROVIDER}
RUN pnpm --filter @surdej/frontend build

# ── Stage 4: Nginx static server ──
FROM nginx:1.27-alpine AS production

# Custom nginx config for SPA routing
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# Nginx config template: envsubst replaces ${API_UPSTREAM} at startup
# Place in /etc/nginx/templates/ so the nginx entrypoint processes it
COPY apps/frontend/nginx.conf /etc/nginx/templates/default.conf.template

# Default API upstream (docker-compose service name)
ENV API_UPSTREAM=http://api:5001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --spider -q http://localhost:80/health || exit 1

EXPOSE 80
