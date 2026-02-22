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

## Step P5-telemetry-04
- Status: Done (approved by user)
- Commit: `d1cabb6`
- Description: Telemetria `closure_summary_added` przy finalizacji ticketu z komentarzem podsumowującym.

### Scope
- komentarz closure summary (`is_closure_summary`) w backend + DB
- emit event `closure_summary_added`
- podpięcie frontendu DevTodo finalization do flagi closure summary
- testy telemetry + RBAC dla nowej flagi

### Files changed
- `backend/db.js`
- `backend/routes/tickets.js`
- `backend/tests/api.integration.test.js`
- `frontend/src/pages/DevTodo.jsx`
- `docs/AGENTS.md`
- `docs/skills/closure-summary-flow.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (20/20)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS
- RBAC check (manual script):
  - user comment z `is_closure_summary=true` -> `403 forbidden` (PASS)
  - developer comment z `is_closure_summary=true` -> `201` + `is_closure_summary=1` (PASS)

### E2E run
- Manual scripted E2E baseline + closure summary:
  - OTP login user -> PASS
  - create ticket + attachment -> PASS
  - my tickets + ticket detail -> PASS
  - OTP login developer -> PASS
  - board + status move -> PASS
  - add closure summary comment (`is_closure_summary=true`) -> PASS
  - close ticket -> PASS
  - DevTodo sync to done -> PASS
  - telemetry `closure_summary_added` persisted (`comment_id`) -> PASS
  - route checks (`/login`, `/my-tickets`, `/ticket/:id`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)

### Result
- Dodana flaga komentarza `is_closure_summary` (DB + walidacja + zapis).
- Event `closure_summary_added` emitowany dla komentarza closure summary od developera.
- Frontend DevTodo finalization wysyła closure summary flagę.
- Dodane testy integracyjne telemetry i RBAC dla closure summary.
- Brak regresji backend/frontend i brak regresji bezpieczeństwa endpointów write.

### Skills created/updated
- `docs/skills/closure-summary-flow.md` (created)

## Step P5-telemetry-03
- Status: Done (approved by user)
- Commit: `1ceada9`
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

## Step P5-analytics-01
- Status: Done (approved by user)
- Commit: `1cd5750`
- Description: Metryki aktywacji produktu (`time to first ticket`, `time to first dev assignment`) jako nowy endpoint backendowy z ochroną RBAC.

### Implementation Plan
- Dodać endpoint `GET /api/tickets/stats/activation` (developer-only).
- Zliczać metryki na podstawie realnych danych (`users`, `tickets`, `ticket_history`).
- Zabezpieczyć obliczenia null-safe i odporne na brak danych.
- Dodać test integracyjny RBAC + kształt odpowiedzi + wartości deterministyczne.
- Uzupełnić docs: skill operacyjny i playbook agentów.
- Uruchomić pełne quality gates backend/frontend + smoke E2E.

### Files changed
- `backend/routes/tickets.js`
- `backend/tests/activation.stats.integration.test.js`
- `docs/AGENTS.md`
- `docs/skills/activation-metrics.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (22/22)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS
- RBAC check (integracyjny):
  - `GET /api/tickets/stats/activation` jako `user` -> `403 forbidden` (PASS)
  - `GET /api/tickets/stats/activation` jako `developer` -> `200` (PASS)

### E2E run
- Manual scripted E2E baseline (API + React routes):
  - OTP login user -> PASS
  - create ticket (+ attachment) -> PASS
  - my tickets -> PASS
  - ticket detail -> PASS
  - OTP login developer -> PASS
  - overview + board -> PASS
  - move ticket status (`verified` -> `in_progress`) -> PASS
  - DevTodo sync -> PASS
  - closure summary + close ticket -> PASS
  - `GET /api/tickets/stats/activation` (developer) -> PASS
  - route checks (`/`, `/login`, `/my-tickets`, `/ticket/:id`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)

### Result
- Dodany endpoint `GET /api/tickets/stats/activation` (developer-only).
- Metryki liczone z danych produkcyjnych:
  - `time_to_first_ticket_minutes`
  - `time_to_first_dev_assignment_minutes`
  - `first_dev_assignment_under_30m`
- Dodany test integracyjny z deterministycznymi timestampami.
- Brak regresji testowej backend/frontend oraz brak regresji RBAC.

### Skills created/updated
- `docs/skills/activation-metrics.md` (created)

## Step P5-analytics-02
- Status: Done (approved by user)
- Commit: `f4fc422`
- Description: Metryki użycia funkcji na telemetry events (`GET /api/tickets/stats/usage`) z agregacją 30d + daily breakdown 14d.

### Implementation Plan
- Dodać endpoint `GET /api/tickets/stats/usage` jako developer-only.
- Zmapować stabilny kontrakt eventów i kluczy odpowiedzi.
- Zwracać metryki per event (count, unique users, last event) dla okna 30 dni.
- Dodać agregaty globalne (`events_30d`, `unique_users_30d`, `active_days_30d`).
- Dodać timeline 14 dni (`daily_breakdown_14d`) z kompletnymi zerami.
- Dodać coverage znanych eventów telemetrycznych względem wszystkich eventów 30d.
- Dodać test integracyjny RBAC + poprawność agregacji i zakresu czasowego.
- Uzupełnić skills/dokumentację agentową.

### Files changed
- `backend/routes/tickets.js`
- `backend/tests/usage.stats.integration.test.js`
- `docs/skills/feature-usage-metrics.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (24/24)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS
- RBAC check:
  - `GET /api/tickets/stats/usage` jako `user` -> `403 forbidden` (PASS)
  - `GET /api/tickets/stats/usage` jako `developer` -> `200` (PASS)

### E2E run
- Manual scripted E2E baseline (API + React routes):
  - OTP login user -> PASS
  - create ticket (+ attachment) -> PASS
  - my tickets -> PASS
  - ticket detail -> PASS
  - OTP login developer -> PASS
  - overview + board -> PASS
  - move ticket status (`verified` -> `in_progress`) -> PASS
  - DevTodo sync -> PASS
  - closure summary + close ticket -> PASS
  - `GET /api/tickets/stats/usage` (developer) -> PASS
  - `GET /api/tickets/stats/usage` (user) -> PASS (403)
  - route checks (`/`, `/login`, `/my-tickets`, `/ticket/:id`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)

### Result
- Dodany endpoint `GET /api/tickets/stats/usage` (developer-only).
- Metryki usage obejmują wszystkie kluczowe eventy telemetry:
  - `ticket.created`
  - `ticket.closed`
  - `board.drag`
  - `devtodo.reorder`
  - `closure_summary_added`
- Dodane agregaty:
  - 30d per event (`count_30d`, `unique_users_30d`, `last_event_at`)
  - 30d totals (`events_30d`, `unique_users_30d`, `active_days_30d`)
  - `daily_breakdown_14d`
  - `known_events_coverage_30d`
- Dodany test integracyjny potwierdzający RBAC i poprawność agregacji.
- Brak regresji backend/frontend i brak regresji bezpieczeństwa.

### Skills created/updated
- `docs/skills/feature-usage-metrics.md` (created)

## Step P5-stabilization-01
- Status: Done (approved by user)
- Commit: `pending-hash` (uzupełniany po commicie)
- Description: Wymuszenie reguły domknięcia: status `closed` wymaga wcześniejszego `closure summary`.

### Implementation Plan
- Dodać backend guard dla transition `* -> closed`.
- Sprawdzać istnienie publicznego komentarza `is_closure_summary = 1`.
- Zwracać jednoznaczny błąd `closure_summary_required` przy braku summary.
- Uzupełnić i naprawić testy lifecycle zamknięcia ticketów.
- Dodać test integracyjny dla reguły close guard (negative + positive path).
- Dodać skill operacyjny dla tej reguły i checklisty regresji.
- Uruchomić pełne quality gates i smoke E2E baseline.

### Files changed
- `backend/routes/tickets.js`
- `backend/tests/api.integration.test.js`
- `frontend/src/pages/TicketDetail.jsx`
- `frontend/src/styles.css`
- `frontend/src/i18n/pl.json`
- `frontend/src/i18n/en.json`
- `docs/skills/ticket-closure-guard.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (25/25)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS
- RBAC/ownership check (test + flow):
  - zamknięcie ticketu bez closure summary -> `400 closure_summary_required` (PASS)
  - zamknięcie po closure summary -> `200` (PASS)

### E2E run
- Manual scripted E2E baseline (API + React routes):
  - OTP login user -> PASS
  - create ticket (+ attachment) -> PASS
  - my tickets -> PASS
  - ticket detail -> PASS
  - OTP login developer -> PASS
  - overview + board -> PASS
  - move ticket status (`verified` -> `in_progress`) -> PASS
  - DevTodo sync -> PASS
  - close ticket without closure summary -> PASS (`400 closure_summary_required`)
  - add closure summary -> PASS
  - close ticket with closure summary -> PASS (`200`)
  - route checks (`/`, `/login`, `/my-tickets`, `/ticket/:id`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)

### Result
- Backend blokuje transition do `closed` bez publicznego closure summary.
- Dodany kod błędu `closure_summary_required` dla jednoznacznej obsługi po stronie UI/API.
- W `TicketDetail` dodane pole `Podsumowanie zamknięcia` widoczne przy wyborze statusu `Zamknięte`.
- Zapis z `TicketDetail` automatycznie dodaje komentarz closure summary przed zmianą statusu na `closed`.
- Dodane tłumaczenia komunikatu `closure_summary_required` w PL/EN.
- Testy lifecycle zostały dopasowane do nowej reguły, bez regresji pozostałych flow.
- Dodany skill operacyjny dla reguły zamykania i checklisty regresji.

### Skills created/updated
- `docs/skills/ticket-closure-guard.md` (created)
