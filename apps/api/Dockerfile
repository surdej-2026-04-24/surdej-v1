# ──────────────────────────────────────────────
# Surdej API — Production Dockerfile
# Multi-stage build for minimal image size
# ──────────────────────────────────────────────

# ── Stage 1: Base ──
FROM node:22-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.21.0 --activate
WORKDIR /app

# ── Stage 2: Dependencies ──
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod=false

# ── Stage 3: Build ──
FROM deps AS builder
COPY packages/core/ packages/core/
COPY apps/api/ apps/api/
COPY contracts/ contracts/
COPY tsconfig.json ./

# Build workspace dependencies
RUN pnpm --filter @surdej/core build

# Generate Prisma client
RUN pnpm --filter @surdej/api exec prisma generate

# Build API
RUN pnpm --filter @surdej/api build

# ── Stage 4: Production ──
FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://localhost:5001/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 5001
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
