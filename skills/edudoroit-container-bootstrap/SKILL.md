---
name: edudoroit-container-bootstrap
description: Containerized local development bootstrap and maintenance for EdudoroIT_SupportCenter using Docker Compose. Use when creating or updating Dockerfiles, docker-compose services, environment wiring, SQLite/uploads volumes, healthchecks, startup scripts, or local mail testing for OTP and notifications.
---

# EdudoroIT Container Bootstrap

## Goal
Create and maintain a reproducible local environment for `EdudoroIT_SupportCenter` with minimal setup and secure defaults.

## Workflow
1. Create project layout with `backend/`, `frontend/`, and persistent data folders.
2. Define `docker-compose.yml` services:
   - `backend` (Node + Express + SQLite)
   - `frontend` (Vite dev server)
   - `mailpit` (SMTP + web UI for OTP and notifications)
3. Add `.env.example` and service-specific env templates.
4. Mount volumes for `backend/data.sqlite` and `backend/uploads/`.
5. Add healthchecks and startup dependency order.
6. Verify local run with `docker compose up --build` and smoke checks.

## Security Defaults
- Run Node processes as non-root user inside containers.
- Expose only required ports.
- Keep secrets outside images; pass via `.env`.
- Enforce upload size limits and writable path allowlist.
- Keep database and upload volumes persistent and isolated.

## Required Output
- `docker-compose.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `.env.example`
- `Makefile` or scripts for common commands (`up`, `down`, `logs`, `test`).

## Validation
- Containers start cleanly.
- Frontend can reach backend via configured API URL.
- OTP and status emails are visible in Mailpit.
- Restart preserves SQLite data and uploads.

## Reference
Read `references/service-contracts.md` before implementation.
