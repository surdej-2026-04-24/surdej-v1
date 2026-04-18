# Port Strategy

## Architecture

```
┌─────────────────────────────────────┐
│  Host machine                       │
│                                     │
│  Frontend (Vite)  → localhost:4001  │
│        ↓ API calls (proxied)        │
│  ┌──────────────────────────────────┤
│  │  Docker Compose network          │
│  │                                  │
│  │  API (Fastify) → :5001 (exposed) │
│  │       ↓              ↓           │
│  │  postgres:5432    nats:4222      │
│  │  (internal)       (internal)     │
│  └──────────────────────────────────┤
└─────────────────────────────────────┘
```

**Only the API port is exposed to the host.** PostgreSQL and NATS are
Docker-internal — never reachable from outside the Compose network.

## Port convention

The **API** port is the base. The **frontend dev server** runs at **API + 1000**.

| Component     | Formula          | surdej-v1 | surdej-v2 | surdej-v3 |
|---------------|------------------|-----------|-----------|-----------|
| API           | `5000 + N`       | **5001**  | 5002      | 5003      |
| Frontend      | API + 1000       | **4001**  | 6002      | 6003      |

**Rules:**
- API is the canonical port
- Frontend dev server = API port + 1000
- Instance 1 starts at 5001/4001

Infrastructure services (postgres, nats) use standard internal ports
(5432, 4222) — they never conflict because each Docker Compose project
runs in its own isolated network.

## Running a copy (e.g. surdej-v2)

1. Copy the repo to `surdej-v2/`
2. Change **3 values** in `docker-compose.yml`:
   - API port mapping: `127.0.0.1:5002:5002`
   - `PORT` env var: `5002`
   - `CORS_ORIGIN` env var: `http://localhost:6002`
3. Set frontend dev server port to `6002` in `vite.config.ts`
4. Update proxy target to `http://localhost:5002`
5. That's it — no other changes needed

## Development workflow

```bash
# Start API + infrastructure (first time builds the image)
docker compose up -d

# Start frontend (runs natively on host)
pnpm dev         # → http://localhost:4001

# View API logs
docker compose logs -f api

# Rebuild API after dependency changes
docker compose build api && docker compose up -d api

# Run migrations
docker compose exec api pnpm exec prisma migrate dev

# Run seeds
docker compose exec api pnpm exec prisma db seed

# Run API tests
docker compose exec api pnpm test
```
