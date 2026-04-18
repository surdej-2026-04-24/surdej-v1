FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Install ──
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.json ./
COPY packages/core/package.json packages/core/
COPY workers/_template/package.json workers/_template/
COPY workers/knowledge/package.json workers/knowledge/
RUN pnpm install --frozen-lockfile

# ── Build core ──
COPY packages/core/ packages/core/
RUN pnpm --filter @surdej/core build

# ── Copy worker source ──
COPY workers/_template/ workers/_template/
COPY workers/knowledge/ workers/knowledge/

# ── Run with tsx ──
CMD ["pnpm", "--filter", "@surdej/worker-knowledge", "dev"]
