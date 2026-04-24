# MFA / TOTP Multi-Factor Authentication

## Phase 1: Backend — COMPLETE

- [x] Add TOTP fields to Prisma schema (`totpSecret`, `totpEnabled`, `totpBackupCodes`)
- [x] Install dependencies: `otpauth`, `qrcode`, `@types/qrcode`
- [x] Create `totp.ts` utility (generateTotpSetup, verifyTotp, generateBackupCodes, verifyBackupCode)
- [x] Run Prisma migration
- [x] Add MFA API routes:
  - `GET /auth/mfa/status` — check MFA status (authenticated)
  - `POST /auth/mfa/setup` — generate TOTP secret + QR code (authenticated)
  - `POST /auth/mfa/verify-setup` — verify initial token, enable TOTP, return backup codes (authenticated)
  - `POST /auth/mfa/disable` — disable TOTP with verification (authenticated)
  - `POST /auth/mfa/verify` — verify TOTP/backup code during login challenge (with mfaToken)
- [x] Add MFA challenge to login endpoints (phone-pin, demo, microsoft-spa)
  - Returns `{ mfa_required: true, mfaToken: '...' }` instead of session when user has TOTP enabled
  - Short-lived JWT (5 min) for MFA challenge

## Phase 2: Frontend — COMPLETE

- [x] Add `MfaRequiredError` class to AuthContext
- [x] Add `verifyMfa(mfaToken, code)` function to AuthContext
- [x] Update login functions to detect `mfa_required` responses
- [x] Add `totp-verify` step to LoginPage with 6-digit code input
- [x] Create `MfaSetup.tsx` component on Profile page:
  - QR code scanning
  - Verification code input
  - Backup codes display with copy button
  - Disable MFA with confirmation
- [x] Integrate MfaSetup into ProfilePage

## Architecture

- TOTP secret stored in DB (base32)
- QR code generated server-side using `qrcode` library
- Verification uses ±1 window tolerance (30-second periods)
- 8 backup codes generated (hashed with bcrypt)
- MFA challenge token is a short-lived JWT (5 min)
- Configurable per user — each user can enable/disable independently
