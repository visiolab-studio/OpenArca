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
