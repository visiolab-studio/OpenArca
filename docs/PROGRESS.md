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
- Commit: `c424c1f`
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

## Step P5-security-01
- Status: Done (approved by user)
- Commit: `17dc7db`
- Description: Backup/restore SQLite + uploads jako bezpieczny proces operacyjny dla lokalnego Docker Compose.

### Implementation Plan
- Dodać skrypty `scripts/backup.sh` i `scripts/restore.sh`.
- Wymusić bezpieczne zachowanie skryptów (`set -euo pipefail`, walidacja wejścia, potwierdzenie `--yes` dla restore).
- Domyślnie wykonywać backup w trybie spójnym (krótkie zatrzymanie backend/frontend), z opcją `--hot`.
- Dodać cele `make backup` i `make restore BACKUP=...`.
- Uzupełnić README o instrukcję backup/restore.
- Dodać skill operacyjny dla agentów (`sqlite-backup-restore`).
- Uruchomić pełne testy i smoke E2E po restore.

### Files changed
- `scripts/backup.sh`
- `scripts/restore.sh`
- `Makefile`
- `README.md`
- `docs/skills/sqlite-backup-restore.md`
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
- Backup/restore scripts:
  - `./scripts/backup.sh --output backups/edudoroit-step-p5-security-01.tar.gz --force` -> PASS
  - `./scripts/restore.sh --input backups/edudoroit-step-p5-security-01.tar.gz --yes` -> PASS

### E2E run
- Manual scripted E2E baseline po restore (API + React routes):
  - OTP login user -> PASS
  - create ticket (+ attachment) -> PASS
  - my tickets -> PASS
  - ticket detail -> PASS
  - OTP login developer -> PASS
  - overview + board -> PASS
  - move ticket status (`verified` -> `in_progress`) -> PASS
  - close guard (`closed` bez summary -> `400`, po summary -> `200`) -> PASS
  - DevTodo sync -> PASS
  - route checks (`/`, `/login`, `/my-tickets`, `/ticket/:id`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)

### Result
- Dodane skrypty backup/restore działające na tych samych wolumenach co aplikacja.
- Restore jest operacją świadomie destrukcyjną (wymaga `--yes`).
- Backup domyślnie robi snapshot spójny (krótkie zatrzymanie usług), z opcją `--hot` dla szybkiego backupu.
- Dokumentacja operacyjna i skill dla agentów zostały dodane.
- Brak regresji funkcjonalnej po restore (potwierdzone smoke E2E).

### Skills created/updated
- `docs/skills/sqlite-backup-restore.md` (created)

## Step P5-security-02
- Status: Done (approved by user)
- Commit: `a2f2c5a`
- Description: Audyt RBAC i ownership checks dla krytycznych endpointów write.

### Implementation Plan
- Dodać dedykowany test integracyjny audytu RBAC/ownership.
- Pokryć endpointy developer-only: `projects`, `settings`, `users`.
- Pokryć ownership dla ticketów i komentarzy internal.
- Potwierdzić pozytywne ścieżki dla roli developer.
- Dodać skill operacyjny i aktualizację playbooka agentów.
- Uruchomić pełne quality gates + smoke E2E.

### Files changed
- `backend/tests/rbac.ownership.audit.integration.test.js`
- `docs/skills/rbac-ownership-checks.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (28/28)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- Manual scripted E2E baseline (API + React routes):
  - OTP login user -> PASS
  - create ticket (+ attachment) -> PASS
  - my tickets -> PASS
  - ticket detail -> PASS
  - OTP login developer -> PASS
  - overview + board -> PASS
  - move ticket status (`verified` -> `in_progress`) -> PASS
  - close guard flow (`closed` bez summary -> 400, po summary -> 200) -> PASS
  - DevTodo sync -> PASS
  - route checks (`/`, `/login`, `/my-tickets`, `/ticket/:id`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)

### Result
- Dodany test regresyjny RBAC/ownership obejmujący krytyczne endpointy write.
- Potwierdzony brak dostępu usera do akcji developer-only.
- Potwierdzona ochrona ownership dla cudzych ticketów i komentarzy internal.
- Potwierdzone dozwolone ścieżki mutacji dla developera.

### Skills created/updated
- `docs/skills/rbac-ownership-checks.md` (created)

## Step P5-governance-01
- Status: Done (approved by user)
- Commit: `3f6b882`
- Description: Dodać pakiet governance Open Source (CONTRIBUTING/SECURITY/CODE_OF_CONDUCT/CHANGELOG/ROADMAP) i podlinkować go w README.

### Implementation Plan
- Dodać dokument `CONTRIBUTING.md` z workflow PR i quality gates.
- Dodać `SECURITY.md` z kanałami responsible disclosure i SLA odpowiedzi.
- Dodać `CODE_OF_CONDUCT.md`.
- Dodać `CHANGELOG.md` z sekcją `Unreleased` dla bieżących zmian P5.
- Dodać `ROADMAP.md` jako publiczny widok kierunku produktu.
- Zaktualizować `README.md` o sekcję governance links.
- Dodać skill operacyjny dla utrzymania governance docs.
- Uruchomić pełne quality gates i smoke E2E baseline.

### Files changed
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `CHANGELOG.md`
- `ROADMAP.md`
- `README.md`
- `docs/skills/oss-governance-docs.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (28/28)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- Manual scripted E2E baseline (API + React routes):
  - OTP login user -> PASS (backend smoke test)
  - create ticket (+ attachment) -> PASS (backend smoke test)
  - my tickets -> PASS (backend smoke test)
  - ticket detail -> PASS (backend smoke test)
  - OTP login developer -> PASS (backend smoke test)
  - overview + board -> PASS (backend smoke test)
  - move ticket status (`verified` -> `in_progress`) -> PASS (backend smoke test)
  - DevTodo sync -> PASS (backend smoke test)
  - route checks (`/`, `/login`, `/my-tickets`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)

### Result
- Dodano bazowy pakiet governance dla publicznego Open Core.
- README zawiera sekcję z odnośnikami do dokumentów governance.
- Utrzymano zielone quality gates backend/frontend oraz smoke E2E baseline.
- Brak regresji funkcjonalnych w kluczowych flow.

### Skills created/updated
- `docs/skills/oss-governance-docs.md` (created)

## Step P5-governance-02
- Status: Done (approved by user)
- Commit: `dcae561`
- Description: Dodać `LICENSE` (AGPL-3.0-only) i domknąć checklistę governance w dokumentacji.

### Implementation Plan
- Dodać plik `LICENSE` ze wskazaniem licencji AGPL-3.0-only i identyfikatorem SPDX.
- Uzupełnić `README.md` o link do `LICENSE` w sekcji governance.
- Uzupełnić `CHANGELOG.md` o wpis dotyczący licencji.
- Zaktualizować skill governance, aby obejmował krok licencyjny.
- Uruchomić pełne quality gates backend/frontend.
- Wykonać smoke E2E baseline i route checks.

### Files changed
- `LICENSE`
- `README.md`
- `CHANGELOG.md`
- `docs/skills/oss-governance-docs.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (28/28)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- Manual scripted E2E baseline:
  - `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
  - route checks (`/`, `/login`, `/my-tickets`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)

### Result
- Governance Open Source rozszerzone o jednoznaczny plik `LICENSE` dla wybranego modelu `AGPL-3.0-only`.
- README i changelog wskazują nowy artefakt licencyjny.
- Skill governance obejmuje teraz obowiązkowy krok licencji.
- Brak regresji w testach automatycznych i smoke E2E.

### Skills created/updated
- `docs/skills/oss-governance-docs.md` (updated)

## Step P5-stabilization-02
- Status: Done (approved by user)
- Commit: `7349a3d`
- Description: Stabilizacja sync statusów Ticket <-> Kanban <-> DevTodo przy reassign/unassign assignee.

### Implementation Plan
- Dodać test regresyjny na scenariusz: accept -> reassign -> unassign.
- Wprowadzić normalizację linked tasków podczas zmiany statusu/przypisania ticketu.
- Wymusić zasadę: maksymalnie jeden aktywny linked task na ticket.
- Usuwać aktywne linked taski po `assignee_id = null`.
- Przy reassign zostawić/przenieść tylko jeden aktywny linked task do nowego assignee.
- Zachować istniejące mapowanie statusów ticket -> dev task.
- Dodać skill operacyjny dla sync ticket/devtodo.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/routes/tickets.js`
- `backend/tests/api.integration.test.js`
- `docs/skills/devtodo-ticket-sync.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (29/29)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- Manual scripted E2E baseline:
  - `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
  - route checks (`/`, `/login`, `/my-tickets`, `/ticket/non-existing`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)
- Dodatkowa walidacja flow sync:
  - test integracyjny `reassigning or unassigning accepted ticket keeps a single active linked dev task in sync` -> PASS

### Result
- Reassign ticketu nie zostawia już aktywnego linked taska u poprzedniego developera.
- Unassign ticketu usuwa aktywne linked taski powiązane z tym ticketem.
- Dla ticketu utrzymywany jest pojedynczy aktywny linked task w TODO.
- Dodany regresyjny test backendowy chroniący sync flow przed nawrotem błędu.

### Skills created/updated
- `docs/skills/devtodo-ticket-sync.md` (created)

## Step P5-stabilization-03
- Status: Done (approved by user)
- Commit: `5dd62e0`
- Description: Ujednolicenie finalizacji `closed` vs `waiting` tak, aby zadanie deva trafiało do zakończonych również przy `waiting`.

### Implementation Plan
- Dostosować mapowanie statusu ticket -> status linked dev task dla `waiting`.
- Zapewnić, że `waiting` nie zostawia linked taska w aktywnych (`todo`/`in_progress`).
- Dodać test regresyjny dla flow `verified -> in_progress -> waiting`.
- Potwierdzić, że reopen z `waiting` do aktywnego statusu przywraca task do aktywnych.
- Zaktualizować skill sync o regułę finalizacji `waiting`.
- Uruchomić pełne quality gates backend/frontend.
- Wykonać smoke E2E baseline.

### Files changed
- `backend/routes/tickets.js`
- `backend/tests/api.integration.test.js`
- `docs/skills/devtodo-ticket-sync.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (30/30)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- Manual scripted E2E baseline:
  - `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
  - route checks (`/`, `/login`, `/my-tickets`, `/ticket/non-existing`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)
- Dodatkowa walidacja finalizacji:
  - test integracyjny `waiting status finalization moves linked dev task to done and supports reopen` -> PASS

### Result
- Status `waiting` działa jak stan finalizacji po stronie deva: linked task przechodzi do `done`.
- Reopen z `waiting` do `verified` przywraca linked task do aktywnych (`todo`).
- Ujednolicono zachowanie `closed` i `waiting` dla sync z DevTodo.
- Dodany test regresyjny zabezpiecza flow przed powrotem błędu.

### Skills created/updated
- `docs/skills/devtodo-ticket-sync.md` (updated)

## Step P5.5-01
- Status: Done (approved by user)
- Commit: `b802062`
- Description: Related tickets linking (MVP) w TicketDetail.

### Implementation Plan
- Dodać model relacji ticketów w DB (`ticket_relations`) z ochroną przed duplikatami i self-link.
- Dodać endpointy backend:
  - `GET /api/tickets/:id/related`
  - `POST /api/tickets/:id/related` (developer-only)
  - `DELETE /api/tickets/:id/related/:relatedId` (developer-only)
- Rozszerzyć `GET /api/tickets/:id` o `related_tickets`.
- Dodać testy integracyjne RBAC/ownership i flow create/list/delete relacji.
- Dodać API frontend i prostą sekcję „Powiązane zgłoszenia” w `TicketDetail`.
- Dodać i18n PL/EN dla nowych komunikatów.
- Dodać skill operacyjny dla wzorca `related tickets linking`.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/db.js`
- `backend/routes/tickets.js`
- `backend/tests/api.integration.test.js`
- `frontend/src/api/tickets.js`
- `frontend/src/pages/TicketDetail.jsx`
- `frontend/src/styles.css`
- `frontend/src/i18n/pl.json`
- `frontend/src/i18n/en.json`
- `docs/skills/related-tickets-linking.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (32/32)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- Manual scripted E2E baseline:
  - `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
  - route checks (`/`, `/login`, `/my-tickets`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)
- Dodatkowa walidacja flow relacji:
  - test integracyjny `developer can create, list and remove related ticket links` -> PASS
  - test integracyjny `related ticket links keep RBAC on write and visibility filter on read` -> PASS

### Result
- Dodano model relacji ticketów (`ticket_relations`) z unikalną parą i ochroną przed self-link.
- Dodano endpointy `GET/POST/DELETE` dla relacji oraz wpięcie `related_tickets` do `GET /api/tickets/:id`.
- Dodano prosty panel relacji w `TicketDetail` (lista + add/remove po numerze dla developera).
- Poprawiono UX/CSS panelu relacji: cały wiersz jest kartą (tytuł + statusy + akcje), bez wąskiej ramki na sam tytuł.
- Poprawiono globalne style formularzy: checkbox w `check-row` ma rozmiar natywny i nie rozciąga się do `100%` szerokości.
- Zabezpieczono RBAC/ownership:
  - user nie może mutować relacji,
  - user widzi tylko relacje do ticketów, do których ma dostęp.

### Skills created/updated
- `docs/skills/related-tickets-linking.md` (created)

## Step P5.5-02
- Status: Done (approved by user)
- Commit: `ab284e6`
- Description: External references (Git PR, deployment, monitoring) dla ticketów.

### Implementation Plan
- Dodać model danych `ticket_external_references` z typem referencji i URL.
- Dodać endpointy:
  - `GET /api/tickets/:id/external-references`
  - `POST /api/tickets/:id/external-references` (developer-only)
  - `DELETE /api/tickets/:id/external-references/:refId` (developer-only)
- Rozszerzyć `GET /api/tickets/:id` o `external_references`.
- Dodać walidację URL (`http/https`) i dozwolone typy (`git_pr`, `deployment`, `monitoring`, `other`).
- Dodać testy integracyjne: create/list/delete + RBAC/ownership.
- Dodać prostą sekcję UI w `TicketDetail` (lista + add/remove dla developera).
- Dodać i18n PL/EN dla nowych etykiet i błędów.
- Dodać skill operacyjny dla external references i uruchomić pełne quality gates + smoke E2E.

### Files changed
- `backend/db.js`
- `backend/routes/tickets.js`
- `backend/tests/api.integration.test.js`
- `frontend/src/api/tickets.js`
- `frontend/src/pages/TicketDetail.jsx`
- `frontend/src/styles.css`
- `frontend/src/i18n/pl.json`
- `frontend/src/i18n/en.json`
- `docs/skills/external-references.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (34/34)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- Manual scripted E2E baseline:
  - `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
  - route checks (`/`, `/login`, `/my-tickets`, `/overview`, `/board`, `/dev-todo`) -> PASS (HTTP 200)
- Dodatkowa walidacja external references:
  - test integracyjny `developer can create, list and remove external references` -> PASS
  - test integracyjny `external references keep RBAC and ownership constraints` -> PASS

### Result
- Dodano model `ticket_external_references` dla linków operacyjnych powiązanych z ticketem.
- Dodano endpointy `GET/POST/DELETE` dla external references i rozszerzono `GET /api/tickets/:id` o `external_references`.
- Dodano sekcję UI w `TicketDetail` do podglądu i zarządzania referencjami (`git_pr`, `deployment`, `monitoring`, `other`).
- Zabezpieczono RBAC/ownership i walidację URL (`http/https`).

### Skills created/updated
- `docs/skills/external-references.md` (created)

## Step P5.5-03
- Status: Done
- Commit: `c2b675e`
- Description: Closure summaries gotowe pod indexing AI (export/feed endpoint).

### Implementation Plan
- Dodać endpoint feedu: `GET /api/tickets/closure-summaries/index-feed` (developer-only).
- Zwracać najnowsze publiczne closure summary per ticket (bez internal).
- Dodać query parametry feedu: `limit`, `updated_since`.
- Dodać metadane potrzebne pod indexowanie (`index_key`, status, priority, category, timestamps).
- Dodać testy integracyjne RBAC + poprawność payloadu + filtr `updated_since`.
- Dodać skill operacyjny dla integracji indeksowania closure summary.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/routes/tickets.js`
- `backend/tests/closure.summary.feed.integration.test.js`
- `docs/skills/closure-summary-index-feed.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (37/37)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (10/10)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Route checks:
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Dodano endpoint `GET /api/tickets/closure-summaries/index-feed` (developer-only).
- Feed zwraca najnowsze publiczne closure summary per ticket (bez komentarzy `internal`).
- Dodano query params: `limit` (1..500), `updated_since` (datetime).
- Dodano metadane indeksacyjne (`index_key`, status, priorytet, kategoria, timestampy, autor).
- Dodano testy RBAC, latest-per-ticket oraz filtrowania `updated_since`.

### Skills created/updated
- `docs/skills/closure-summary-index-feed.md` (created)

## Step P6A-01
- Status: Done (approved by user)
- Commit: `43307a0`
- Description: Capabilities foundation (`edition`, `feature_flags`, endpoint `/api/settings/capabilities`, frontend `useCapabilities`).

### Implementation Plan
- Dodać model ustawień `edition` + `feature_flags` w backend settings/defaults.
- Dodać serwis capabilities z bezpiecznymi domyślnymi flagami Open Core.
- Dodać endpoint `GET /api/settings/capabilities` (authRequired) dla user/developer.
- Dodać testy integracyjne backendu dla auth i poprawności payloadu capabilities.
- Dodać frontend API `getCapabilities`.
- Dodać `CapabilitiesProvider` oraz hook `useCapabilities` z helperem `hasFeature`.
- Dodać testy frontend dla providera/hooka (sukces, fallback, brak auth).
- Dodać skill dokumentujący obsługę capabilities i zaktualizować listę w `docs/AGENTS.md`.

### Files changed
- `backend/constants.js`
- `backend/db.js`
- `backend/routes/settings.js`
- `backend/services/capabilities.js`
- `backend/tests/capabilities.integration.test.js`
- `frontend/src/api/settings.js`
- `frontend/src/contexts/CapabilitiesContext.jsx`
- `frontend/src/contexts/__tests__/CapabilitiesContext.test.jsx`
- `frontend/src/pages/Profile.jsx`
- `frontend/src/pages/__tests__/Profile.capabilities.test.jsx`
- `frontend/src/styles.css`
- `frontend/src/i18n/pl.json`
- `frontend/src/i18n/en.json`
- `frontend/src/main.jsx`
- `docs/skills/capabilities-foundation.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (40/40)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (14/14)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Route checks:
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Dodano fundament edition model: nowe settings `edition` i `feature_flags`.
- Dodano serwis capabilities z normalizacją i bezpiecznymi domyślnymi flagami Open Core.
- Dodano endpoint `GET /api/settings/capabilities` wymagający autoryzacji.
- Dodano frontendowy `CapabilitiesProvider` i hook `useCapabilities()` z helperem `hasFeature`.
- Dodano testy backend + frontend dla nowego flow capabilities.
- Naprawiono regresję layoutu OTP na loginie (pola wróciły do układu poziomego, stała szerokość slotów).
- Dodano popup capabilities w profilu, aby sprawdzić edition/feature flags bez używania konsoli przeglądarki.

### Skills created/updated
- `docs/skills/capabilities-foundation.md` (created)

## Step P6A-02
- Status: Done (approved by user)
- Commit: `3a422c9`
- Description: Middleware `requireFeature` + pierwszy endpoint enterprise-gated.

### Implementation Plan
- Dodać middleware `requireFeature(featureKey)` z deny-by-default.
- Podpiąć `requireFeature("enterprise_automation")` do endpointu kontrolnego dla developera.
- Zachować kolejność zabezpieczeń: `authRequired` + `requireRole` + `requireFeature`.
- Dodać testy backend dla scenariuszy auth/RBAC/feature-on/feature-off.
- Dodać prosty check endpointu w popupie capabilities (bez ingerencji w główne flow appki).
- Dodać tłumaczenie błędu `feature_not_enabled` (PL/EN).
- Dodać skill operacyjny dla `requireFeature`.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/middleware/features.js`
- `backend/routes/settings.js`
- `backend/tests/feature.middleware.integration.test.js`
- `frontend/src/api/settings.js`
- `frontend/src/pages/Profile.jsx`
- `frontend/src/pages/__tests__/Profile.capabilities.test.jsx`
- `frontend/src/i18n/pl.json`
- `frontend/src/i18n/en.json`
- `docs/skills/require-feature-middleware.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (45/45)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Route checks:
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Dodano middleware `requireFeature(featureKey)` i spójny błąd `feature_not_enabled`.
- Dodano endpoint kontrolny `GET /api/settings/enterprise-check`:
  - wymaga auth,
  - wymaga roli `developer`,
  - wymaga aktywnej flagi `enterprise_automation`.
- Dodano testy backend:
  - `401` bez tokena,
  - `403 forbidden` dla usera,
  - `403 feature_not_enabled` przy wyłączonej fladze,
  - `200` po włączeniu (edition `enterprise`),
  - `403` przy ręcznym override flagi na `false`.
- Dodano check endpointu w popupie capabilities na profilu.
- Dodano tłumaczenia `feature_not_enabled` w PL/EN.

### Skills created/updated
- `docs/skills/require-feature-middleware.md` (created)

## Step P6A-03
- Status: Done (approved by user)
- Commit: `6bfe826`
- Description: Modularny szkielet splitu Open/Enterprise (extension registry + service contracts).

### Implementation Plan
- Dodać registry usług domenowych z mechanizmem override (core -> extensions).
- Dodać bazowe kontrakty serwisów: `ticketService`, `workflowService`, `taskSyncService`.
- Dodać bezpieczny loader opcjonalnych override z `backend/extensions/`.
- Przepiąć pierwszy endpoint (`/api/settings/enterprise-check`) na warstwę service przez registry.
- Dodać testy jednostkowe registry (fallback core + override).
- Dodać dokumentację operacyjną dla integracji prywatnego repo Enterprise.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/core/extension-registry.js`
- `backend/core/services/ticketService.js`
- `backend/core/services/workflowService.js`
- `backend/core/services/taskSyncService.js`
- `backend/extensions/README.md`
- `backend/routes/settings.js`
- `backend/tests/extension.registry.unit.test.js`
- `docs/skills/open-enterprise-engine-split.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (50/50)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Route checks:
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Dodano warstwę `backend/core/services/*` jako bazę kontraktów usług domenowych.
- Dodano registry `backend/core/extension-registry.js` z kolejnością:
  - core fallback,
  - opcjonalny override z `backend/extensions/service-overrides.js`.
- Dodano dokumentację override w `backend/extensions/README.md`.
- Przepięto endpoint `GET /api/settings/enterprise-check` na warstwę `workflowService` przez registry.
- Dodano testy unit registry:
  - lista usług,
  - fallback core,
  - override function/object,
  - walidacja błędnego override.

### Skills created/updated
- `docs/skills/open-enterprise-engine-split.md` (created)

## Step P6A-04
- Status: Done (approved by user)
- Commit: `631957c`
- Description: Przeniesienie logiki endpointu enterprise-check do dedykowanej warstwy service + response mapping.

### Implementation Plan
- Dodać dedykowany moduł service dla `settings/enterprise-check`.
- W route `settings` zostawić tylko: middleware + wywołanie service + response.
- Przygotować mechanizm łatwego podmiany service przez registry/override.
- Dodać testy jednostkowe service.
- Utrzymać istniejące testy integracyjne endpointu bez zmian kontraktu.
- Dodać skill/checklistę dla patternu route->service->response.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/enterpriseCheck.js`
- `backend/routes/settings.js`
- `backend/tests/enterprise.check.service.unit.test.js`
- `docs/skills/route-service-response-mapping.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (53/53)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Route checks:
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Dodano dedykowaną warstwę `enterpriseCheckService` (`backend/services/enterpriseCheck.js`).
- Handler `/api/settings/enterprise-check` został uproszczony do wywołania service i mapowania odpowiedzi.
- Dodano testy unit service:
  - poprawny payload przez DI workflowService,
  - walidacja brakującego `featureKey`,
  - walidacja kontraktu zależności.
- Utrzymano istniejący kontrakt endpointu i testy integracyjne bez regresji.

### Skills created/updated
- `docs/skills/route-service-response-mapping.md` (created)

## Step P6A-05
- Status: Done (approved by user)
- Commit: `110a5e6`
- Description: Konfigurowalne podpięcie prywatnego repo Enterprise przez zewnętrzny plik override.

### Implementation Plan
- Dodać ustawienia środowiskowe dla ścieżki override (`EXTENSIONS_DIR`, `EXTENSIONS_OVERRIDES_FILE`).
- Przepiąć registry, aby domyślnie ładował override z konfiguracji (a nie hardcoded path).
- Zachować bezpieczny fallback, gdy plik override nie istnieje.
- Dodać testy unit dla ładowania override z zewnętrznej ścieżki pliku.
- Uzupełnić `.env.example` i dokumentację pod rozdział Open vs Enterprise repo.
- Dodać skill operacyjny „jak podłączyć OpenArca-Enterprise do OpenArca lokalnie”.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/config.js`
- `backend/core/extension-registry.js`
- `backend/extensions/README.md`
- `backend/tests/extension.registry.external-path.unit.test.js`
- `.env.example`
- `docs/skills/enterprise-repo-wiring.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (55/55)
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Route checks:
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Dodano konfigurację ENV dla external override:
  - `EXTENSIONS_DIR`
  - `EXTENSIONS_OVERRIDES_FILE`
- Registry ładuje override z konfiguracji backendu zamiast hardcoded ścieżki.
- Zachowano bezpieczny fallback do core, gdy plik override nie istnieje.
- Dodano testy unit dla zewnętrznej ścieżki override (plik istnieje / brak pliku).
- Uzupełniono `.env.example` i dokumentację pod rozdział Open repo + Enterprise repo.

### Skills created/updated
- `docs/skills/enterprise-repo-wiring.md` (created)

## Step P6A-06
- Status: Done (approved by user)
- Commit: `pending-hash` (uzupełniany po akceptacji i commicie)
- Description: Pierwsza migracja realnego flow ticketowego do service layer (route -> service -> response).

### Implementation Plan
- Wyodrębnić logikę listowania ticketów (`GET /api/tickets`) do dedykowanego service.
- Zostawić w route tylko: walidacja query + auth + wywołanie service + response mapping.
- Zapewnić kompatybilność payloadu i brak regresji RBAC/ownership.
- Dodać testy unit nowego service (scenariusze user/developer, filtry bazowe).
- Uzupełnić skill o pattern migracji endpointu ticketowego.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (59/59)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Route checks:
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Endpoint `GET /api/tickets` działa przez nowy service layer (`ticketsService.listTickets`) bez zmiany kontraktu odpowiedzi.
- RBAC/ownership zostały zachowane:
  - rola `user` widzi tylko własne zgłoszenia,
  - rola `developer` widzi globalną listę, a `my=1` zawęża do przypisanych.
- Zachowano wszystkie filtry query (`status`, `priority`, `category`, `project_id`) i kolejność parametrów SQL.
- Dodano testy unit service, aby kolejne migracje route -> service miały wzorzec regresyjny.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (created)
