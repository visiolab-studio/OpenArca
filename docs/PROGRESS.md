# EdudoroIT_SupportCenter — Progress Log

## Step P5-telemetry-01
- Status: Done (approved by user)
- Commit: `aa9bca1`
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

## Step P5-telemetry-02
- Status: Done (approved by user)
- Commit: `2585898`
- Description: Telemetria `devtodo.reorder` po udanym reorderze listy TODO developera.

### Scope
- emit event `devtodo.reorder` w backendzie
- test integracyjny telemetry dla reorder
- walidacja E2E z akcją reorder

### Files changed
- `backend/routes/devTasks.js`
- `backend/tests/api.integration.test.js`
- `docs/skills/telemetry-events.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (17/17)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS
- RBAC check (manual script):
  - non-developer na `/api/dev-tasks/reorder` -> `403 forbidden` (PASS)
  - drugi developer reordering cudzych tasków -> `400 invalid_task_order` (PASS)

### E2E run
- Manual scripted E2E baseline + reorder:
  - OTP login user -> PASS
  - create ticket + attachment -> PASS
  - my tickets + ticket detail -> PASS
  - OTP login developer -> PASS
  - overview + board -> PASS
  - move ticket status -> PASS
  - DevTodo sync -> PASS
  - reorder w DevTodo -> PASS
  - telemetry `devtodo.reorder` persisted -> PASS
  - route checks (`/login`, `/my-tickets`, `/ticket/:id`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)

### Result
- Event `devtodo.reorder` emitowany po udanym reorderze.
- Payload eventu zawiera `items_count` i `active_count_after`.
- Dodany test integracyjny backend potwierdzający zapis eventu.
- Brak regresji backend/frontend i brak regresji RBAC dla endpointu reorder.

### Skills created/updated
- `docs/skills/telemetry-events.md` (updated)

## Step P5-telemetry-03
- Status: Done (approved by user)
- Description: Telemetria `board.drag` przy zmianie statusu ticketa w przepływie Kanban.

### Scope
- emit event `board.drag` dla przejść statusów (drag workflow)
- test integracyjny telemetry dla board move
- walidacja E2E baseline + move statusu z perspektywy developera

### Files changed
- `backend/routes/tickets.js`
- `backend/tests/api.integration.test.js`
- `docs/skills/telemetry-events.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (18/18)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS
- RBAC check (manual script):
  - obcy user patch statusu cudzego ticketu -> `403 forbidden` (PASS)
  - developer patch statusu ticketu -> `200` (PASS)

### E2E run
- Manual scripted E2E baseline + board move:
  - OTP login user -> PASS
  - create ticket + attachment -> PASS
  - my tickets + ticket detail -> PASS
  - OTP login developer -> PASS
  - overview + board -> PASS
  - move ticket status (`verified` -> `in_progress`) -> PASS
  - DevTodo sync -> PASS
  - telemetry `board.drag` persisted with payload (`old_status`, `new_status`) -> PASS
  - route checks (`/login`, `/my-tickets`, `/ticket/:id`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)

### Result
- Event `board.drag` emitowany przy przejściu statusu (bez `submitted` -> `...` bootstrap transition).
- Payload eventu zawiera `old_status` i `new_status`.
- Dodany test integracyjny backend potwierdzający zapis eventu.
- Brak regresji backend/frontend i brak regresji RBAC dla endpointu `PATCH /api/tickets/:id`.

### Skills created/updated
- `docs/skills/telemetry-events.md` (updated)
