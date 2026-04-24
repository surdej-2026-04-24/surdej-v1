# Plan: core-comms Module — Communication Support

## Overview
A communication module supporting **email** (SendGrid), **SMS** (SMSGate), and **webhooks** (in + out).
The webhook receiver is a **separate worker** with a public URL via Cloudflare, buffering events in NATS.
All communications are logged with initiator ID.

## Architecture

```
                          ┌──────────────────────────┐
  Cloudflare Tunnel       │  Webhook Receiver (7008) │
  (public URL) ──────────▶│  Fastify – buffers to    │
                          │  NATS JetStream          │
                          └──────────┬───────────────┘
                                     │ NATS
                                     ▼
  Frontend ──REST──▶ API Gateway ──NATS──▶ ┌──────────────────────┐
                     /api/module/          │  Comms Worker (7007) │
                     core-comms/*          │  ├── SendGrid email  │
                                           │  ├── SMSGate SMS     │
                                           │  ├── Webhook out     │
                                           │  ├── NATS consumer   │
                                           │  │   (inbound hooks) │
                                           │  └── Prisma (logs)   │
                                           └──────────────────────┘
```

## Module Structure

```
modules/core-comms/
├── shared/                        # @surdej/module-core-comms-shared
│   └── src/
│       ├── schemas.ts             # Communication, WebhookEvent, channel enums
│       └── index.ts
├── worker/                        # @surdej/module-core-comms-worker (port 7007)
│   ├── prisma/schema/core_comms.prisma
│   ├── Dockerfile.dev
│   └── src/
│       ├── server.ts              # Fastify + NATS registration + inbound consumer
│       ├── routes.ts              # REST API routes (send, list, webhooks CRUD)
│       ├── db.ts                  # Prisma client
│       └── providers/
│           ├── email-sendgrid.ts  # SendGrid provider
│           ├── sms-smsgate.ts     # SMSGate provider
│           └── webhook-outbound.ts # Outbound webhook dispatch
├── webhook-receiver/              # @surdej/module-core-comms-webhook-receiver (port 7008)
│   ├── Dockerfile.dev
│   └── src/
│       ├── server.ts              # Public-facing Fastify + NATS publish
│       └── routes.ts              # POST /webhook/:channelId
└── ui/                            # @surdej/module-core-comms-ui
    └── src/
        ├── hooks/useCommsApi.ts
        ├── commands.ts
        ├── components/
        │   ├── CommunicationLog.tsx
        │   └── SendMessageForm.tsx
        └── index.ts
```

## Phases

### Phase 1 — Scaffolding & Core (this session)
- [x] Create plan
- [x] Create shared package with Zod DTOs
- [x] Create main worker with SendGrid email + SMSGate SMS providers
- [x] Create Prisma schema for communication logs
- [x] Create webhook receiver worker (NATS buffering)
- [x] Create UI package (log viewer + send form)
- [x] Create Dockerfiles + docker-compose services
- [x] Create .env files with credentials
- [x] Install dependencies & verify

### Phase 2 — Integration & Testing (next session)
- [ ] Wire webhook NATS consumer in main worker
- [ ] Register commands in frontend skin
- [ ] Add unit tests for providers
- [ ] Test full flow: send email → log → view in UI
- [ ] Test webhook buffering during API downtime
- [ ] Cloudflare tunnel configuration docs

### Phase 3 — Hardening
- [ ] Rate limiting on webhook receiver
- [ ] Retry logic for failed sends
- [ ] SendGrid webhook status callbacks
- [ ] SMS delivery status tracking
- [ ] Communication templates
