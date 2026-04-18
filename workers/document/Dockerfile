FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Install ──
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY workers/_template/package.json workers/_template/
COPY workers/document/package.json workers/document/
RUN pnpm install --frozen-lockfile

# ── Build core ──
COPY packages/core/ packages/core/
RUN pnpm --filter @surdej/core build

# ── Prisma generate ──
COPY apps/api/prisma/ apps/api/prisma/
RUN pnpm --filter @surdej/api exec prisma generate

# ── Copy worker source ──
COPY workers/_template/ workers/_template/
COPY workers/document/src/ workers/document/src/
COPY workers/document/tsconfig.json workers/document/tsconfig.json
COPY workers/document/prisma/ workers/document/prisma/

# ── Run with tsx ──
CMD ["pnpm", "--filter", "@surdej/worker-document", "dev"]
