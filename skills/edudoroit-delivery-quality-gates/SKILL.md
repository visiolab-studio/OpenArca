---
name: edudoroit-delivery-quality-gates
description: Delivery governance, testing, and security hardening for EdudoroIT_SupportCenter. Use when defining or enforcing coding standards, test strategy, CI gates, threat-focused checks, release readiness, and regression controls across backend and frontend.
---

# EdudoroIT Delivery Quality Gates

## Goal
Keep delivery safe and predictable with explicit quality gates, security checks, and release criteria.

## Mandatory Gates
1. Static checks:
   - Lint
   - Type checks
   - Formatting consistency
2. Backend tests:
   - Auth OTP happy path and invalid path
   - RBAC enforcement per role
   - Ticket lifecycle and history writes
   - Upload constraints and access control
3. Frontend tests:
   - Route guards
   - New ticket validation by category
   - Ticket detail visibility rules for internal comments
4. End-to-end smoke:
   - Login -> create ticket -> developer update -> reporter sees status/comment

## Security Checklist
- No secrets in repository.
- JWT secret rotated per environment.
- Input validation and output encoding verified.
- Rate limits for auth and write-heavy endpoints.
- Centralized audit logging for key updates.

## Release Criteria
- All gates pass on clean environment.
- Migration/init scripts are repeatable.
- Rollback path documented for schema and deployment changes.
- Critical known issues explicitly tracked.

## Reference
Read `references/test-matrix.md` when creating or updating test suites.
