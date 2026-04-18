FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Python for embed.py (memory-efficient vector embedding) ──
RUN apk add --no-cache python3 py3-pip py3-psycopg2
COPY workers/pdf-refinery/requirements-embed.txt /tmp/requirements-embed.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements-embed.txt

WORKDIR /app

# ── Install Node deps ──
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.json ./
COPY packages/core/package.json packages/core/
COPY workers/_template/package.json workers/_template/
COPY workers/pdf-refinery/package.json workers/pdf-refinery/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# ── Prisma generate ──
COPY apps/api/prisma/ apps/api/prisma/
RUN pnpm --filter @surdej/api exec prisma generate

# ── Build core ──
COPY packages/core/ packages/core/
RUN pnpm --filter @surdej/core build

# ── Copy worker source ──
COPY workers/_template/ workers/_template/
COPY workers/pdf-refinery/ workers/pdf-refinery/

# ── Run with tsx (no watch — saves memory) ──
CMD ["pnpm", "--filter", "@surdej/worker-pdf-refinery", "exec", "tsx", "src/index.ts"]
