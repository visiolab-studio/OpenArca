---
name: edudoroit-backend-secure-express
description: Secure backend implementation for EdudoroIT_SupportCenter with Node.js, Express, SQLite, JWT, OTP authentication, RBAC, file uploads, and email notifications. Use when building or modifying backend schema, middleware, routes, validation, permission checks, or audit history logic.
---

# EdudoroIT Backend Secure Express

## Goal
Implement backend features from `AGENT.md` with production-grade correctness, permission enforcement, and defensive coding.

## Implementation Order
1. Create `db.js` and schema initialization with idempotent migrations.
2. Implement auth middleware and JWT verification.
3. Implement OTP flow:
   - `POST /api/auth/request-otp`
   - `POST /api/auth/verify-otp`
   - `GET/PATCH /api/auth/me`
4. Implement ticket routes, comments, attachments, and history writes.
5. Implement developer modules: `dev-tasks`, `projects`, `users`, `settings`.
6. Implement email service using SMTP settings from DB with safe fallback logging.

## Security Rules
- Use prepared statements only (`better-sqlite3`).
- Validate and normalize all input (body, query, params, files).
- Enforce RBAC on every route server-side.
- Enforce OTP TTL, one-time use, and rate limiting (max 3 per 10 min per email).
- Restrict upload MIME/types, count, and size (max 10 files, max 20MB total).
- Serve uploads only through authenticated endpoint and ownership checks.
- Record sensitive state changes in `ticket_history`.
- Avoid leaking internal fields (`is_internal`, OTP codes, SMTP secrets).

## Coding Standards
- Keep route handlers thin; move business logic to services.
- Use shared error model and consistent HTTP status mapping.
- Add explicit transaction boundaries for multi-step updates.
- Add integration tests for auth, RBAC, and ticket lifecycle.

## Definition of Done
- All endpoints from `AGENT.md` implemented.
- Role matrix enforced and tested.
- History and notification triggers behave exactly per spec.
- No SQL string interpolation from request input.

## Reference
Read `references/schema-and-endpoints.md` before implementing each module.
