FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Install ──
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.json ./
COPY modules/member-nosql/shared/package.json modules/member-nosql/shared/
COPY modules/member-nosql/worker/package.json modules/member-nosql/worker/
RUN pnpm install --frozen-lockfile

# ── Build shared ──
COPY modules/member-nosql/shared/ modules/member-nosql/shared/
RUN pnpm --filter @surdej/module-member-nosql-shared build

# ── Build worker ──
COPY modules/member-nosql/worker/ modules/member-nosql/worker/
RUN pnpm --filter @surdej/module-member-nosql-worker db:generate
RUN pnpm --filter @surdej/module-member-nosql-worker build

# ── Run ──
EXPOSE 7006
CMD ["node", "modules/member-nosql/worker/dist/server.js"]
