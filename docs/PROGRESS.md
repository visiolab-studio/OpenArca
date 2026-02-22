# EdudoroIT_SupportCenter — Progress Log

## Step P5-telemetry-01
- Status: Done (approved by user)
- Description: Minimalna telemetria produktowa w backendzie (`ticket.created`, `ticket.closed`) + fundament dokumentacji agentowej.

### Scope
- telemetry storage + service
- event emit on ticket create/close
- backend integration tests for telemetry
- agent docs and skills baseline

### Files changed
- `backend/db.js`
- `backend/routes/tickets.js`
- `backend/tests/api.integration.test.js`
- `backend/services/telemetry.js`
- `docs/AGENTS.md`
- `docs/skills/telemetry-events.md`
- `docs/skills/e2e-browser-baseline.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (16/16)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS
- `docker compose up --build -d` -> PASS (stack healthy)
- RBAC ownership check (manual script): `PATCH /api/tickets/:id` by non-owner user -> PASS (403 `forbidden`)

### E2E run
- Manual scripted E2E baseline (HTTP + React routes):
  - OTP login user -> PASS
  - create ticket (+ attachment) -> PASS
  - my tickets -> PASS
  - ticket detail -> PASS
  - OTP login developer -> PASS
  - overview + board -> PASS
  - status move to `in_progress` -> PASS
  - DevTodo linked task sync -> PASS
  - route checks (`/`, `/login`, `/my-tickets`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)

### Result
- Telemetry storage wdrożone (`telemetry_events` + indeksy).
- Event `ticket.created` emitowany przy utworzeniu zgłoszenia.
- Event `ticket.closed` emitowany przy zmianie statusu na `closed`.
- Dodany test integracyjny potwierdzający oba eventy.
- Dodana dokumentacja agentowa + skills do telemetrii i baseline E2E.
- Brak regresji testowych i brak naruszeń RBAC/ownership.

### Skills created/updated
- `docs/skills/telemetry-events.md` (created)
- `docs/skills/e2e-browser-baseline.md` (created)
