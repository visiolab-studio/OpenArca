# Public Roadmap

## Current focus (P5: Open Core 1.0 GA stabilization)
- Stabilize ticket lifecycle consistency across Ticket Detail, Kanban, and DevTodo.
- Keep security baseline intact (RBAC, ownership checks, validation, limits).
- Build product telemetry and activation/usage metrics for product decisions.
- Provide operational safeguards (backup/restore).

## Near-term (P5.5)
- Related tickets linking.
- External references (PRs, deployments, monitoring links).
- Closure summaries prepared for future AI indexing.

## Mid-term (P6)
- Open Core + Enterprise capability model and feature flags.
- Service-layer split for cleaner architecture and testability.
- Domain event backbone and durable outbox.
- Worker/automation engine with retries and DLQ.

## Enterprise path (P7+)
- Automation pack (SLA, escalation, auto-assignment, reminders).
- Identity pack (Google/Microsoft SSO, LDAP/SAML).
- Compliance pack (audit trail, export, retention).

## Decision principles
- Adoption over architecture perfection.
- No major feature additions before telemetry review.
- Every new module should increase product gravity.

## Tracking
- Internal execution plan: `TODO_v2_founder_rewrite.md`
- Founder strategy context: `docs/fonder-road.md`
- Step-by-step implementation status: `docs/PROGRESS.md`
