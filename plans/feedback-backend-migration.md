# Feedback System: IndexedDB → Server-Side Migration

> **Created**: 2026-02-25
> **Status**: ✅ Implementation started

## Overview

Move feedback sessions from browser-only IndexedDB storage to server-side PostgreSQL + MinIO.
The frontend store becomes a thin API client wrapper.

## Data Model

### New Prisma Models

Replace the existing `FeedbackEntry` model with a full session model:

```prisma
model FeedbackSession {
  id            String   @id @default(uuid())
  tenantId      String?
  userId        String
  title         String
  description   String?
  status        String   @default("active")  // active, paused, completed
  startUrl      String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  completedAt   DateTime?

  tenant        Tenant?  @relation(fields: [tenantId], references: [id])
  user          User     @relation(fields: [userId], references: [id])
  
  // One-to-many children
  navigationEntries FeedbackNavigation[]
  screenshots       FeedbackScreenshot[]
  voiceRecordings   FeedbackRecording[]   @relation("VoiceRecordings")
  videoRecordings   FeedbackRecording[]   @relation("VideoRecordings")
  chatTranscripts   FeedbackChatTranscript[]

  @@index([userId])
  @@index([tenantId])
}

model FeedbackNavigation {
  id         String   @id @default(uuid())
  sessionId  String
  url        String
  title      String
  duration   Float?   // seconds
  createdAt  DateTime @default(now())

  session FeedbackSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model FeedbackScreenshot {
  id         String   @id @default(uuid())
  sessionId  String
  url        String   // page URL where screenshot was taken
  blobPath   String   // MinIO storage key
  comment    String?
  createdAt  DateTime @default(now())

  session FeedbackSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model FeedbackRecording {
  id         String   @id @default(uuid())
  sessionId  String
  type       String   // "voice" | "video"
  blobPath   String   // MinIO storage key
  duration   Float    // seconds
  comment    String?
  createdAt  DateTime @default(now())

  sessionVoice FeedbackSession? @relation("VoiceRecordings", fields: [sessionId], references: [id], onDelete: Cascade)
  sessionVideo FeedbackSession? @relation("VideoRecordings", fields: [sessionId], references: [id], onDelete: Cascade)
}

model FeedbackChatTranscript {
  id                String   @id @default(uuid())
  sessionId         String
  conversationId    String   // links to AiConversation.id
  conversationTitle String?
  model             String
  messages          Json     // FeedbackChatMessage[]
  messageCount      Int
  url               String
  createdAt         DateTime @default(now())

  session FeedbackSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/feedback/sessions` | Create (start) a session |
| `GET` | `/api/feedback/sessions` | List all sessions for user |
| `GET` | `/api/feedback/sessions/:id` | Get session with all children |
| `PATCH` | `/api/feedback/sessions/:id` | Update (pause, resume, complete) |
| `DELETE` | `/api/feedback/sessions/:id` | Delete session + children + blobs |
| `POST` | `/api/feedback/sessions/:id/navigation` | Add navigation entry |
| `POST` | `/api/feedback/sessions/:id/screenshots` | Upload screenshot (multipart) |
| `POST` | `/api/feedback/sessions/:id/recordings` | Upload recording (multipart) |
| `POST` | `/api/feedback/sessions/:id/chats` | Attach chat transcript |
| `GET` | `/api/feedback/blobs/:path` | Stream blob (screenshot/recording) |

### Binary Storage

Screenshots and recordings go to MinIO under `feedback/{tenantId}/{sessionId}/{type}-{id}.{ext}`

### Frontend Migration

The feedbackStore.ts changes from IndexedDB calls to `fetch()` API calls.
The types stay the same so the UI components don't change.

## Implementation Order

1. Prisma schema + migration
2. API routes
3. Frontend store migration
