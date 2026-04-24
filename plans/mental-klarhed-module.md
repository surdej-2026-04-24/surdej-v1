# Mental Klarhed Module — Implementation Plan

> **Date:** 2026-04-24
> **Module:** `mental-klarhed`
> **Client:** Asger Johannes Steenholdt — Psykoterapeut MPF
> **Site:** https://www.asgersteenholdt.com/mental-klarhed/
> **Scope:** Full vertical-slice module: Livshjulet-assessment, AI-genereret PDF + videomanus, klientportal, GDPR-compliance

---

## Baggrund

"Mental Klarhed" er et individualiseret terapeutisk forløb over 3 måneder med 5 samtaler á 90 minutter.
**Digitaliseringsmålet:** automatisere forberedelsescyklussen mellem Asger og klienten, så begge møder op med overblik og fokus.

Forløbets cyklus pr. session:

```
[Klient modtager magic-link]
        │
        ▼
[Klient udfylder Livshjulet-assessment]
        │
        ▼
[AI genererer PDF (refleksionsopgaver) + Videomanus]
        │
        ▼
[Asger optager video, sender PDF + video til klient]
        │
        ▼
[Klient forbereder sig]
        │
        ▼
[90 min. online-session med Asger]
        │
        ▼  (gentages for session 2-5)
[Slutevaluering: ny Livshjulet + sammenligning]
```

---

## Konfiguration (svar fra interview)

| Parameter              | Valg                                             |
|------------------------|--------------------------------------------------|
| Module slug            | `mental-klarhed`                                 |
| Prisma schema          | `mental_klarhed`                                 |
| Module port            | **7010**                                         |
| Livshjulet-dimensioner | Klassiske 8 (se nedenfor)                        |
| Klientlogin            | Passwordless magic-link via e-mail               |
| AI-generering          | Azure OpenAI — fuldt automatisk                  |
| Antal sessioner        | Fast: 5 sessioner                                |
| Datapersistering       | Surdej PostgreSQL (EU-hosted)                    |
| Evaluering             | Ny Livshjulet + visuel sammenligning med start   |
| Sprog                  | Dansk + Engelsk                                  |

---

## Livshjulet — 8 Dimensioner

| # | Dansk               | Engelsk                  |
|---|---------------------|--------------------------|
| 1 | Helbred             | Health & Wellbeing       |
| 2 | Familie             | Family                   |
| 3 | Relationer          | Relationships            |
| 4 | Karriere / Arbejde  | Career / Work            |
| 5 | Økonomi             | Finances                 |
| 6 | Personlig udvikling | Personal Growth          |
| 7 | Fritid              | Leisure & Fun            |
| 8 | Omgivelser          | Home & Environment       |

Hver dimension scores **1–10** med mulighed for kortfattet fritekst-note.

---

## Arkitektur

```
modules/mental-klarhed/
├── shared/                                  # @surdej/module-mental-klarhed-shared
│   ├── package.json
│   └── src/
│       ├── index.ts
│       └── schemas.ts                       # Zod: Programme, Assessment, Session, Material
│
├── worker/                                  # @surdej/module-mental-klarhed-worker
│   ├── package.json
│   ├── .env
│   ├── prisma/schema/
│   │   └── mental_klarhed.prisma            # Datamodel
│   └── src/
│       ├── server.ts                        # Fastify + NATS-registrering
│       ├── routes/
│       │   ├── programmes.ts                # CRUD-forløb (Asger-admin)
│       │   ├── assessments.ts               # Klient udfylder Livshjulet
│       │   ├── materials.ts                 # Hent genereret PDF + manus
│       │   └── auth.ts                      # Magic-link generation + validering
│       ├── services/
│       │   ├── ai-generator.ts              # Azure OpenAI — PDF + videomanus
│       │   ├── pdf-renderer.ts              # PDF-generering (Puppeteer/PDFKit)
│       │   ├── email.ts                     # Magic-link e-mails
│       │   └── gdpr.ts                      # Slet klientdata, exportér data
│       └── lib/
│           └── livshjulet.ts                # Dimension-definitioner + scoring-logik
│
└── ui/                                      # @surdej/module-mental-klarhed-ui
    ├── package.json
    └── src/
        ├── index.ts
        ├── hooks/
        │   └── useMentalKlarhedApi.ts
        ├── commands.ts                      # CommandRegistry-definitioner
        └── components/
            ├── admin/
            │   ├── ProgrammeList.tsx         # Asger-dashboard: alle forløb
            │   ├── ProgrammeCreate.tsx       # Opret nyt forløb (invitér klient)
            │   ├── ProgrammeDetail.tsx       # Detaljevisning + næste trin
            │   └── MaterialReview.tsx        # Preview PDF + manus inden afsendelse
            └── client/
                ├── ClientPortal.tsx          # Klientens landingsside (via magic-link)
                ├── LivshjuletForm.tsx        # Interaktiv hjulet-test (SVG + sliders)
                ├── LivshjuletChart.tsx       # Visualisering af hjulet (radar chart)
                └── EvaluationView.tsx        # Slutevaluering: før/efter sammenligning
```

---

## Data Model (Prisma)

```prisma
// modules/mental-klarhed/worker/prisma/schema/mental_klarhed.prisma

generator client {
    provider        = "prisma-client-js"
    output          = "../../node_modules/.prisma/mental-klarhed-client"
    previewFeatures = ["multiSchema"]
}

datasource db {
    provider = "postgresql"
    url      = env("DATABASE_URL")
    schemas  = ["mental_klarhed"]
}

// ─── Klient ────────────────────────────────────────────────────
model Client {
    id          String      @id @default(uuid())
    email       String      @unique
    name        String
    locale      String      @default("da")        // "da" eller "en"
    consentAt   DateTime?                          // GDPR: tidsstempel for samtykke
    deletedAt   DateTime?                          // Soft-delete (GDPR right to erasure)
    programmes  Programme[]
    magicLinks  MagicLink[]
    createdAt   DateTime    @default(now())
    updatedAt   DateTime    @updatedAt

    @@schema("mental_klarhed")
}

// ─── Forløb ────────────────────────────────────────────────────
model Programme {
    id          String      @id @default(uuid())
    clientId    String
    client      Client      @relation(fields: [clientId], references: [id])
    status      ProgrammeStatus @default(INVITED)
    startedAt   DateTime?
    completedAt DateTime?
    sessions    Session[]
    assessments Assessment[]
    createdAt   DateTime    @default(now())
    updatedAt   DateTime    @updatedAt

    @@schema("mental_klarhed")
}

enum ProgrammeStatus {
    INVITED
    ACTIVE
    COMPLETED
    CANCELLED

    @@schema("mental_klarhed")
}

// ─── Session ───────────────────────────────────────────────────
model Session {
    id            String           @id @default(uuid())
    programmeId   String
    programme     Programme        @relation(fields: [programmeId], references: [id])
    sessionNumber Int              // 1-5
    scheduledAt   DateTime?
    status        SessionStatus    @default(PENDING)
    assessment    Assessment?      // pre-session Livshjulet
    material      PreSessionMaterial?
    createdAt     DateTime         @default(now())
    updatedAt     DateTime         @updatedAt

    @@schema("mental_klarhed")
}

enum SessionStatus {
    PENDING
    ASSESSMENT_SENT      // magic-link sendt til klient
    ASSESSMENT_DONE      // klient har udfyldt
    MATERIAL_GENERATED   // AI har genereret PDF + manus
    MATERIAL_SENT        // Asger har sendt til klient
    COMPLETED            // session afholdt

    @@schema("mental_klarhed")
}

// ─── Livshjulet-assessment ─────────────────────────────────────
model Assessment {
    id            String     @id @default(uuid())
    programmeId   String
    programme     Programme  @relation(fields: [programmeId], references: [id])
    sessionId     String?    @unique
    session       Session?   @relation(fields: [sessionId], references: [id])
    isInitial     Boolean    @default(false)   // true = start-assessment
    isFinal       Boolean    @default(false)   // true = slutevaluering
    scores        Json       // { helbred: 7, familie: 5, ... }
    notes         Json       // { helbred: "...", familie: "..." }
    completedAt   DateTime?
    createdAt     DateTime   @default(now())

    @@schema("mental_klarhed")
}

// ─── AI-genereret materiale ────────────────────────────────────
model PreSessionMaterial {
    id              String    @id @default(uuid())
    sessionId       String    @unique
    session         Session   @relation(fields: [sessionId], references: [id])
    pdfContent      String    // Markdown/HTML til PDF-rendering
    pdfUrl          String?   // Blob-URL efter rendering
    videoScript     String    // Manus til Asgers 90 sek. video
    generatedAt     DateTime  @default(now())
    sentAt          DateTime?

    @@schema("mental_klarhed")
}

// ─── Magic-links (passwordless auth) ──────────────────────────
model MagicLink {
    id          String    @id @default(uuid())
    clientId    String
    client      Client    @relation(fields: [clientId], references: [id])
    token       String    @unique    // kryptografisk tilfældig token (crypto.randomBytes)
    purpose     String               // "assessment", "portal", "evaluation"
    sessionId   String?              // hvis det er session-specifikt
    expiresAt   DateTime
    usedAt      DateTime?
    createdAt   DateTime  @default(now())

    @@schema("mental_klarhed")
}
```

---

## AI-generering

### Input til GPT-4
```
System: Du er Asger Johannes Steenholdt, erfaren psykoterapeut MPF.
        Skriv på [locale: da/en].

User:   Klient: {name}
        Session: {sessionNumber} af 5
        
        Livshjulet-scores:
        - Helbred: {score}/10 — "{note}"
        - Familie: {score}/10 — "{note}"
        ... (alle 8 dimensioner)
        
        Tidligere temaer fra forrige session: {previousThemes}
        
        Generer:
        1. PDF-refleksionsopgaver (ca. 1 A4-side, 3-4 konkrete opgaver)
           Fokusér på de 2-3 dimensioner med lavest score.
           Inkluder 1 opvarmningsøvelse + 2 refleksionsspørgsmål + 1 konkret handlingsopgave.
        
        2. Videomanus (ca. 200 ord = 90 sek.)
           Personligt, nærværende tone — som om Asger taler direkte til klienten.
           Anerkend klientens scores, introducer dagens fokus, afslut med invitation.
        
        Format: JSON { pdfContent: "...", videoScript: "..." }
```

### Slutevaluering (session 5)
- Generér sammenligning: initial assessment vs. final assessment
- Fremhæv dimensioner med størst fremgang
- Generer PDF med "Din rejse" — grafisk oversigt + refleksion over forløbet

---

## Magic-link Flow (GDPR-compliant)

```
1. Asger klikker "Send forberedelse" for en session
2. Worker genererer: token = crypto.randomBytes(32).toString('hex')
   Gemmer i MagicLink: { token, clientId, sessionId, purpose: "assessment", expiresAt: now+7days }
3. E-mail sendes til klient:
   "Asger har sendt dig din forberedelse til session {n}.
    Klik her for at udfylde din Livshjulet-test: {baseUrl}/k/{token}"
4. Klient klikker link → worker validerer token (ikke udløbet, ikke brugt)
   → setter session-cookie (signed JWT, httpOnly, 24t expiry)
   → markerer magicLink.usedAt = now()
5. Klienten udfylder assessment i ClientPortal
6. Assessment gemmes → AI-generering trigges automatisk
7. Asger notificeres via NATS (ny assessment tilgængelig)
```

**Sikkerhed:**
- Token er 32-byte kryptografisk tilfældig (256 bit entropi)
- TTL: 7 dage (vises i e-mail)
- Éngangs-brug: token invalideres ved brug
- JWT-cookie: httpOnly, SameSite=Strict, Secure
- Rate-limit på `/k/:token` endpoint

---

## GDPR-compliance

| Krav                        | Implementering                                          |
|-----------------------------|--------------------------------------------------------|
| Samtykke                    | Klient giver eksplicit samtykke ved første login       |
| Ret til indsigt             | `GET /api/module/mental-klarhed/me/data` — fuld export |
| Ret til sletning            | `DELETE /api/module/mental-klarhed/me` — soft-delete + plan for hard-delete |
| Databehandleraftale         | Asger som dataansvarlig, Surdej som databehandler      |
| Dataopbevaring              | PostgreSQL i EU (samme server som resten af surdej)    |
| Kryptering                  | At-rest: PostgreSQL disk-encryption, In-transit: TLS   |
| Logging                     | Ingen klientdata i app-logs — kun IDs og events        |
| Fortrolighed                | `deleted_at` soft-delete respekteres i alle queries    |

**Databehandleraftale:** Asger skal indgå databehandleraftale med Surdej-hostingudbyderen.
Skabelon inkluderes i modulets `/docs/gdpr-databehandleraftale-skabelon.md`.

---

## Routes (Fastify Worker)

### Admin-routes (Asger, kræver MSAL JWT)
```
GET    /admin/programmes              # List alle forløb
POST   /admin/programmes              # Opret nyt forløb (invitér klient)
GET    /admin/programmes/:id          # Detaljer
DELETE /admin/programmes/:id          # Afslut/slet

POST   /admin/programmes/:id/sessions/:sn/send-assessment
       # Sender magic-link til klient

GET    /admin/programmes/:id/sessions/:sn/material
       # Hent genereret PDF + manus

POST   /admin/programmes/:id/sessions/:sn/send-material
       # Marker materialet som sendt til klient

POST   /admin/programmes/:id/complete # Afslut forløb, trigger slutevaluering
```

### Klient-routes (passwordless, valideres via JWT-cookie)
```
GET    /k/:token                      # Magic-link indgang → sætter cookie, redirect
GET    /client/me                     # Klientens aktuelle forløb + status
POST   /client/assessments            # Indsend Livshjulet-besvarelse
GET    /client/materials/:sessionId   # Hent PDF-URL + status
GET    /client/evaluation             # Slutevaluering med sammenligning

DELETE /client/me                     # GDPR: slet mine data
GET    /client/me/export              # GDPR: eksportér mine data (JSON)
```

---

## Frontend Commands (CommandRegistry)

```typescript
// modules/mental-klarhed/ui/src/commands.ts

export const MODULE_COMMANDS = [
    {
        id: 'mental-klarhed.admin.programmes',
        title: 'Mental Klarhed — Forløbsoversigt',
        icon: 'Brain',
        category: 'Mental Klarhed',
    },
    {
        id: 'mental-klarhed.admin.create-programme',
        title: 'Mental Klarhed — Nyt forløb',
        icon: 'Plus',
        category: 'Mental Klarhed',
    },
    {
        id: 'mental-klarhed.client.portal',
        title: 'Mental Klarhed — Klientportal',
        icon: 'LayoutDashboard',
        category: 'Mental Klarhed',
    },
];
```

---

## Integration med asgersteenholdt.com

Hjemmesiden er WordPress (wp-content/uploads stier). To integrationsmuligheder:

### Option A — Iframe-embed (anbefalet til MVP)
1. Surdej-frontenden hostes på `app.asgersteenholdt.com` (eller Cloudflare Tunnel)
2. Klientportalen er tilgængelig via magic-link URL direkte
3. Magic-link URL-format: `https://app.asgersteenholdt.com/k/{token}`
4. WordPress-siden behøver ingen ændringer — Asger sender linket manuelt/automatisk

### Option B — WordPress-plugin-bridge
1. Surdej eksponerer en webhook der kan trigges fra WordPress
2. Et simpelt WP-plugin / snippet sender POST til `/api/module/mental-klarhed/webhook/purchase`
   ved WooCommerce-køb
3. Modulet opretter automatisk forløbet og sender velkomst-mail til klienten

**MVP: Option A** — ingen WordPress-integration nødvendig for at komme i gang.
**Phase 2: Option B** — automatisér oprettelse ved køb.

---

## Implementeringsplan

### Phase 1 — Backend (ca. 2 dages arbejde)

- [ ] `modules/mental-klarhed/shared/` — Zod-skemaer
- [ ] `modules/mental-klarhed/worker/` — Fastify server
- [ ] Prisma-schema + migration
- [ ] Magic-link auth-flow
- [ ] Azure OpenAI integration (ai-generator.ts)
- [ ] PDF-renderer (PDFKit eller Puppeteer → A4 PDF)
- [ ] E-mail-service (Nodemailer + SMTP)
- [ ] GDPR-endpoints (eksport, sletning)

### Phase 2 — Admin UI (ca. 1 dags arbejde)

- [ ] `ProgrammeList.tsx` — Asgers dashboard
- [ ] `ProgrammeCreate.tsx` — invitér klient
- [ ] `ProgrammeDetail.tsx` — session-overblik + "send forberedelse"
- [ ] `MaterialReview.tsx` — preview PDF + manus, "send til klient"

### Phase 3 — Klientportal (ca. 1 dags arbejde)

- [ ] `ClientPortal.tsx` — landingsside efter magic-link
- [ ] `LivshjuletForm.tsx` — interaktiv test med SVG-hjul + sliders
- [ ] `LivshjuletChart.tsx` — radar chart (Chart.js eller Recharts)
- [ ] `EvaluationView.tsx` — slutevaluering med before/after

### Phase 4 — GDPR & Polish (ca. ½ dags arbejde)

- [ ] Samtykke-flow ved første login
- [ ] GDPR-eksport og sletning i UI
- [ ] Databehandleraftale-skabelon
- [ ] E-mail-skabeloner på dansk + engelsk
- [ ] Test: magic-link expiry, token-reuse, sletning

---

## Tekniske valg

| Komponent     | Valg                          | Begrundelse                                      |
|---------------|-------------------------------|--------------------------------------------------|
| AI            | Azure OpenAI GPT-4o           | Eksisterende integration i `core-openai`        |
| PDF           | PDFKit (Node.js)              | Let, ingen Chrome-dependency; evt. Puppeteer    |
| E-mail        | Nodemailer + Azure Communication Services | Konsistent med resten af surdej    |
| Auth (klient) | Magic-link + signed JWT cookie| GDPR-light: ingen password-hash at beskytte     |
| Charts        | Recharts                      | Allerede i frontend-deps                         |
| Sprog         | i18n via JSON-filer i `shared/`| dansk + engelsk                                 |

---

## Module-parametre

```
MODULE_SLUG    = mental-klarhed
MODULE_PATH    = modules/mental-klarhed/
PRISMA_SCHEMA  = mental_klarhed
MODULE_PORT    = 7010
NATS_SUBJECT   = module.mental-klarhed.>
```

---

## Næste skridt (efter godkendelse af plan)

1. Kør `surdej-newmodule`-workflow-scaffolding med disse parametre
2. Udfyld Prisma-schema og kør `prisma migrate dev`
3. Implementér AI-generator med Asgers tone-prompt
4. Klientportal med LivshjuletForm
5. Test fuld flow lokalt med Asger som testbruger
6. Deploy til staging, test GDPR-flow
7. Konfigurér `app.asgersteenholdt.com` (Option A)
