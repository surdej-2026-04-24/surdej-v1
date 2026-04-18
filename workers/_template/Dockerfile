FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Install ──
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.json ./
COPY packages/core/package.json packages/core/
COPY workers/_template/package.json workers/_template/
RUN pnpm install --frozen-lockfile

# ── Build ──
COPY packages/core/ packages/core/
COPY workers/_template/ workers/_template/
RUN pnpm --filter @surdej/core build
RUN pnpm --filter @surdej/worker-template build

# ── Run ──
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=base /app/ /app/
CMD ["node", "workers/_template/dist/index.js"]
