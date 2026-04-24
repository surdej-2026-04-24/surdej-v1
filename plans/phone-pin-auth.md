# Phone + PIN Code Authentication

## Phase 1 — Schema & API (backend)
- [x] Add `phone` field to `User` model (optional, unique)
- [x] Add `pinHash` field to `User` model (bcrypt-hashed PIN)
- [x] Create Prisma migration
- [x] Add `POST /api/auth/login/phone-pin` route (phone + PIN → session token)
- [x] Hash PINs with bcrypt, never store plaintext

## Phase 2 — Frontend
- [x] Add "phone+pin" LoginStep to LoginPage
- [x] Add phone number + PIN input form
- [x] Wire up to new API endpoint
- [x] Add navigation link from main login screen

## Phase 3 — Seed data
- [x] Add demo users with phone numbers and PINs in seed script

## Security Notes
- PINs are bcrypt-hashed before storage
- Rate limiting recommended for production (not in scope for this MVP)
- PIN minimum 4 digits
