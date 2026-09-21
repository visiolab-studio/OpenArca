# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added
- -

### Changed
- -

### Fixed
- -

### Notes
- -

## [0.3.1] - 2026-09-21

### Added
- Production images and compose: `backend/Dockerfile.prod`, `frontend/Dockerfile.prod` and `docker-compose.prod.yml`. The repository previously had no production path — `docker-compose.yml` runs the Vite dev server and nodemon with the source bind-mounted, which is not something to put on a public hostname.

### Changed
- A production build now calls the **same origin** it was served from. Baking an absolute API URL in at build time pinned the bundle to one hostname and quietly defeated the multi-host support added in 0.3.0. The dev server still needs the explicit default because it runs on a different port than the API; `VITE_API_URL` overrides either way.

### Notes
- Production compose binds ports to `127.0.0.1` behind a reverse proxy, sets memory limits and log rotation, drops Mailpit, and keeps SQLite on a **named volume** rather than a path inside the deploy directory — a redeploy replacing that directory would otherwise take the database with it.
- `JWT_SECRET` and `APP_URL` are required rather than defaulted; a silent fallback on a secret is a security bug, not a convenience.

## [0.3.0] - 2026-09-21

### Added
- Layered extension system: `EXTENSIONS_LAYERS` loads an ordered stack of extensions instead of a single one, with a `layer.json` manifest whose `requires` field is validated against the layers below the declaring one.
- Shared layer resolver, layer-aware schema installation, chained route registrars and keyed merging of frontend slots, plus an optional `registerMiddleware` export for cross-cutting concerns.
- `ticketDetailSections` UI slot, so a layer can contribute context to the ticket page.
- Layer diagnostics in the admin readiness view: resolved stack, declared prerequisites, which seams each layer contributes and configuration warnings.
- Build-your-own-layer guide, layer contract specification and a runnable `examples/example-layer/` with its own compose override.
- Italian translation, complete and at parity with English; language switcher covers PL/EN/IT.
- Project-scoped custom ticket fields (`text`, `number`, `select`, `url`, `date`) with server-side validation, archiving instead of deletion, UI in the ticket form and detail, and list filtering.
- Multi-host support via `ALLOWED_HOSTS`, with host-aware OTP links and `docs/multi-host.md`.
- Public ticket intake, opt-in per project and off by default, with a standalone submission form in all three languages.
- `customFieldsService` and `personalDataService` exposed to layers through `getService`.
- Personal-data seam: a layer declares its export/erase surface and core aggregates across core and every layer.

### Changed
- Route registrars now run **before** core mounts its own routes, so a layer can intercept a core route and hand the request on with `next()` rather than only adding new paths.
- The i18n guard is driven by `src/i18n/languages.json` instead of a hardcoded language pair, with per-language foreign-character rules.
- Backup readiness reports a capability (`script` or `runtime`) instead of checking for a repository-relative file.
- `virtual:enterprise-frontend` renamed to `virtual:openarca-extensions`; the old specifier remains a working alias.

### Fixed
- Stored `javascript:` URLs could be rendered as links when an archived text field was revived as a `url` field. Reviving now preserves the original field type, and the ticket detail validates the scheme before using a stored value as an `href`.
- Backup and restore were reported as unavailable in every containerized deployment, because `scripts/` sits outside the backend container's mount.
- A third language was silently collapsed to Polish in six places, including the OTP email, which is the only way into the product.
- Enterprise-style layers created their tables inside a route registrar, which only worked while exactly one layer was loaded.

### Notes
- Single-host and core-only installs need no configuration change. `EXTENSIONS_DIR`, `EXTENSIONS_OVERRIDES_FILE`, `EXTENSIONS_ROUTES_FILE` and `ENTERPRISE_FRONTEND_MODULE` keep working as one implicit layer; setting them alongside `EXTENSIONS_LAYERS` warns and the latter wins.
- Relative `EXTENSIONS_LAYERS` entries resolve against the repository root. Containers mount only `backend/` and `frontend/`, so containerized deployments mount each layer and use its absolute in-container path.
- Layers may use Node built-ins and their own files only; core's `node_modules` cannot be resolved from a mounted layer.
- Multi-host deployments require `X-Forwarded-Proto` from the reverse proxy.
- Full release notes: [`docs/releases/v0.3.0.md`](docs/releases/v0.3.0.md).

## [0.2.8-rc1] - 2026-05-21

### Added
- Idempotent demo seed command for local self-hosting evaluation, including sample users, projects, tickets, Kanban states, TODO items, ticket template and telemetry events.

### Changed
- -

### Fixed
- -

### Notes
- Validated on Node `20.20.2`: backend lint/tests.

## [0.2.7-rc1] - 2026-05-20

### Added
- Open Core next-plan document for the public roadmap after `0.2.6-rc2`.
- Automated frontend i18n guard that validates translation key parity and blocks hardcoded Polish runtime copy outside the Polish dictionary.
- Self-hosting readiness endpoint and Admin tab covering app URL, access rules, email provider, SQLite data path, backup/restore scripts and current version.
- Repository-level Node version files and npm engine enforcement for Node 20 local development.

### Changed
- Frontend runtime storage access now uses a safe wrapper so tests and non-browser environments do not fail on unavailable `localStorage`.
- Backend and frontend package metadata now declare the supported Node runtime range as `>=20 <26`.
- Backend test script now targets test files explicitly for Node's test runner.
- Admin email provider test failures now return and display safe diagnostics for provider, host/region, error code and command.

### Fixed
- Frontend test setup now provides a memory-backed `localStorage` fallback when jsdom/Node does not expose one.

### Notes
- Validated on Node `20.20.2`: backend lint/tests, frontend lint/tests/build.

## [0.2.6-rc2] - 2026-05-20

### Changed
- Profile page can now render Enterprise-provided notification preference sections through the frontend extension slot.

### Fixed
- Completed English translations on the `New Ticket` screen so title guidance, good/bad examples, category descriptions and description hints no longer fall back to Polish when English is selected.

### Notes
- This release addresses GitHub issue #3: incomplete English translations.

## [0.2.6-rc1] - 2026-04-08

### Added
- User-level email notification preferences in Open Core:
  - `email_notify_ticket_status`
  - `email_notify_developer_comment`
- Profile UI section `Email notifications` / `Powiadomienia email` with independent save action.
- Backend skill documentation for this flow:
  - `docs/skills/email-notification-preferences.md`

### Changed
- `GET /api/auth/me` and `PATCH /api/auth/me` now expose and persist email preference flags.
- Notification delivery now respects per-user preferences for:
  - ticket status updates,
  - developer comments.
- Email footer notification settings link now points directly to `.../profile#notifications`.
- Email template/footer flow is now aligned with profile-based notification management.

### Notes
- OTP login remains mandatory and always enabled (no user/admin toggle).

## [0.2.5-rc1] - 2026-04-07

### Added
- Enterprise module foundation for `Support Threads / Quick Support` with isolated backend and frontend extension points.
- Lightweight support thread flow for standard users:
  - inbox,
  - create thread,
  - detail chat view,
  - attachments,
  - email notifications.
- Developer support inbox with:
  - filters,
  - summary cards,
  - reply workflow,
  - assignee and status handling.
- Conversion flow from `Support Thread` to full `Ticket`, including backlinks and history transfer.

### Changed
- `TicketDetail`, `My Tickets`, `Board` and `DevTodo` now surface tickets originating from `Quick Support`.
- Added origin filters and presets for tickets escalated from quick support threads.
- Support thread inbox and detail views now expose project context, converted state and direct ticket links more clearly.
- Public and private release streams are now aligned on version `0.2.5-rc1` for this compatibility point.

### Notes
- `OpenArca` and `OpenArca-Enterprise` are version-aligned for this release candidate.
- Public repo cleanup before release was done via named stash: `local-shelf-pre-release-2026-04-07`.

## [0.2.4-rc2] - 2026-03-21

### Added
- Saved views with local persistence for:
  - `My Tickets`
  - `Kanban / Board`
  - `DevTodo`
- Quick filter presets for daily execution flows:
  - critical
  - waiting
  - blocked
  - this week
  - developer queue filters
- Ticket templates foundation for Open Core:
  - developer CRUD API for ticket templates
  - admin management UI in `Settings -> Projects`
  - intake prefill in `New Ticket` with `project -> global` fallback
- Agent and contributor skills/docs for ticket template backend and intake prefill flows.

### Changed
- `New Ticket` now pre-fills title, description, category and reporter urgency from the selected template.
- Template checklists are appended to ticket description as a structured text block.
- Admin template modal now shows field-level validation instead of a generic validation failure.
- Accessibility/testability improved for `New Ticket` via explicit labels on core inputs.

### Notes
- Release candidate for the current Open Core intake workflow scope.
- Existing Open RC2 documents outside the tracked release scope were intentionally left untouched.

## [0.2.3-rc2] - 2026-02-24

### Added
- Official public links in `README.md`:
  - Project website: `https://openarca.com`
  - Documentation (EN): `https://docs.openarca.com/docs/overview`
  - Documentation (PL): `https://docs.openarca.com/pl/docs/overview`

### Changed
- Finalized Open RC2 documentation status tracking in `docs/PROGRESS.md`:
  - resolved pending commit hashes,
  - promoted `Needs review` checkpoints to `Done (approved by user)`,
  - added RC2 closeout checkpoint.

### Notes
- Open Core release stream is closed for RC2 scope (P5, P5.5, P6 delivered).
- Enterprise work continues separately after Open RC2 closure.

## [0.2.1-rc.2] - 2026-02-24

### Added
- `LICENSE` with AGPL-3.0-only declaration for Open Core governance baseline.
- Product telemetry events: `ticket.created`, `ticket.closed`, `board.drag`, `devtodo.reorder`, `closure_summary_added`.
- Activation and usage stats endpoints:
  - `GET /api/tickets/stats/activation`
  - `GET /api/tickets/stats/usage`
- Backup/restore scripts for SQLite and uploads:
  - `scripts/backup.sh`
  - `scripts/restore.sh`
- Governance documents:
  - `CONTRIBUTING.md`
  - `SECURITY.md`
  - `CODE_OF_CONDUCT.md`
  - public roadmap (`ROADMAP.md`)

### Changed
- Ticket closing flow now requires closure summary (`closure_summary_required`).
- Ticket details UI now supports entering closure summary before closing.
- Extended RBAC/ownership regression test coverage for write endpoints.

### Notes
- Detailed implementation timeline and checkpoints are tracked in `docs/PROGRESS.md`.
