# 12 — CLI & Testing

## Overview

Generic CLI tooling and testing strategy built into Surdej's core. The CLI handles
authentication, development utilities, worker management, and deployment tasks. The
testing framework covers unit, integration, and E2E testing with structured coverage targets.

## CLI Tooling

### Architecture

- Built with `commander` (CLI framework) + `chalk` (terminal styling).
- Runs as `pnpm cli:<command>` from the monorepo root.
- Token storage: per-project at `~/.surdej/tokens-{PROJECT_CODE}.json` (AES-256 encrypted).
- Auth flows: browser redirect (localhost:3847) or device code (headless).

### Authentication Commands

| Command | Description |
|---------|-------------|
| `cli:login` | Authenticate via browser (MSAL, opens localhost:3847) |
| `cli:logout` | Clear stored tokens |
| `cli:whoami` | Display current identity |
| `cli:token` | Show/refresh access token |
| `cli:test` | Test authenticated API calls |

### Infrastructure Commands

| Command | Description |
|---------|-------------|
| `cli:tunnel` | Manage Cloudflare tunnel |
| `cli:workers` | List connected workers and their health status |
| `cli:db:status` | Show Prisma schema status across all segments |
| `cli:db:migrate` | Run migrations for a specific schema segment |

### Development Commands

| Command | Description |
|---------|-------------|
| `cli:seed` | Seed database with development data |
| `cli:reset` | Reset all database schemas (with confirmation) |
| `cli:gen` | Generate Prisma clients for all schema segments |

### Dependencies

- `commander` — CLI framework
- `chalk` — Terminal output styling
- `keytar` — OS keychain integration (optional)
- `open` — Open browser for auth flow

## Testing Strategy

### Testing Pyramid

| Level | Framework | Speed | Target |
|-------|-----------|-------|--------|
| Unit | Vitest | Fast | Mocked dependencies, isolated logic |
| Integration | Vitest | Medium | Real database, real NATS, real API |
| E2E | Playwright | Slow | Full user flows in browser |

### Coverage Targets

| Area | Target |
|------|--------|
| Core services | 80% |
| UI components | 70% |
| Utilities & shared | 90% |
| Worker handlers | 80% |
| Overall | 75% |

### Integration Testing

- Tests run against real PostgreSQL and NATS (via Docker Compose test profile).
- Uses CLI tokens for authenticated API testing (no mocked auth).
- Each segmented Prisma schema is tested independently.

### Test Commands

| Command | Description |
|---------|-------------|
| `pnpm test` | Run all unit tests |
| `pnpm test:api` | Run API unit tests |
| `pnpm test:frontend` | Run frontend unit tests |
| `pnpm test:workers` | Run worker handler tests |
| `pnpm test:integration` | Run integration tests (requires running services) |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm test:coverage` | Generate coverage report |

### Test Data

- Seed scripts per schema segment in `scripts/seed/`.
- Factory functions for generating test data per domain.
- Demo mode doubles as a test data source.

---

*Genericized from CLI and testing patterns across both source projects.*
