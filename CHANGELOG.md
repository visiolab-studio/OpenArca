# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added
- -

### Changed
- -

### Notes
- -

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
