# EdudoroIT_SupportCenter — Progress Log

## Step RC2-01
- Status: Done (approved by user)
- Commit: `pending-hash` (uzupełniany po commicie)
- Description: Rebranding OpenArca + odświeżenie UI (faza A) + branding footer/sidebar/login.

### Implementation Plan
- Zmienić runtime naming i fallbacki z `EdudoroIT_SupportCenter` na `OpenArca`.
- Dodać branding sidebar: `Powered by OpenArca`.
- Dodać branding stopki: logo OpenArca, wersja aplikacji i link do licencji.
- Dodać poprawne assety logo i flag PL/EN.
- Podmienić klasę CTA `btn-yellow` na neutralną `btn-accent`.
- Ujednolicić żółte bordery/cienie na primary teal wg `ui_book.md`.
- Dodać checklistę prac RC2 w osobnym TODO.
- Uruchomić pełne quality gates i smoke E2E.

### Files changed
- `backend/db.js`
- `backend/routes/settings.js`
- `backend/tests/api.integration.test.js`
- `backend/tests/rbac.ownership.audit.integration.test.js`
- `frontend/index.html`
- `frontend/src/components/AppShell.jsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `frontend/src/pages/Admin.jsx`
- `frontend/src/pages/Board.jsx`
- `frontend/src/pages/DevTodo.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/NewTicket.jsx`
- `frontend/src/pages/TicketDetail.jsx`
- `frontend/src/styles.css`
- `frontend/src/assets/logo-openarca.png`
- `frontend/src/assets/logo-openarca-white.png`
- `frontend/src/assets/logo-openarca-grey.png`
- `frontend/src/assets/poland.png`
- `frontend/src/assets/united-states.png`
- `docs/OPENARCA_RC2_TODO.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (157/157)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- `curl -s http://localhost:4000/health` -> PASS (`status=ok`)

### E2E run
- Repo nie zawiera Playwright/Cypress, więc użyto smoke fallback:
  - flow: OTP login user/developer, create ticket, ticket detail, developer update/comment.
- Manual UI checks (zaakceptowane przez usera):
  - login i sidebar branding OpenArca,
  - poprawne flagi PL/EN,
  - stopka z logo OpenArca, wersją i licencją.

### Result
- Produkt ma spójny rebranding na `OpenArca` (UI + backend fallbacki + komunikaty test email).
- Dodany stały podpis pod logo: `Powered by OpenArca`.
- Stopka zawiera:
  - szare logo OpenArca,
  - wersję aplikacji,
  - link `AGPL-3.0-only` do `LICENSE`.
- Login korzysta ze zaktualizowanego logo OpenArca.
- Przełącznik języka używa dostarczonych flag `poland.png` i `united-states.png`.
- Żółte akcenty border/shadow zostały przepięte na primary teal zgodnie z `ui_book.md`.
- Nazewnictwo przycisków zostało oczyszczone z legacy:
  - `btn-yellow` -> `btn-accent`.

### Skills created/updated
- none

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
- Commit: `c34d8ed`
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

## Step P6A-07
- Status: Done (approved by user)
- Commit: `a29578c`
- Description: Migracja endpointu `GET /api/tickets/workload` do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.getWorkload({ user })` z obecną logiką SQL + mapowaniem kolejek.
- Zachować kontrakt payloadu (`in_progress`, `queue`, `blocked`, `submitted`, `_stats`).
- Zachować RBAC widoczności `can_open` (developer: globalnie, user: tylko własne).
- Przepiąć route `/api/tickets/workload` na wywołanie service.
- Dodać testy unit dla `getWorkload` (podział statusów, statystyki, `can_open`).
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (61/61)
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
- Endpoint `GET /api/tickets/workload` został przeniesiony do `ticketsService.getWorkload({ user })`.
- Route `tickets` jest cieńszy i zachowuje kontrakt odpowiedzi.
- Zachowano podział kolejek:
  - `in_progress`,
  - `queue` (`verified` + `waiting`),
  - `blocked`,
  - `submitted`.
- Zachowano `_stats` oraz regułę widoczności `can_open`:
  - developer otwiera wszystkie rekordy,
  - user tylko własne.
- Dodano testy unit service dla mapowania workload i reguł `can_open`.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6C-01
- Status: Done (approved by user)
- Commit: `3dc7187`
- Description: Minimalny worker/scheduler dla `event_outbox` z retry policy, dead-letter i observability.

### Implementation Plan
- Dodać konfigurowalny worker `event_outbox` (polling + batch processing), domyślnie wyłączony.
- Wprowadzić cykl statusów: `pending -> processing -> sent` oraz retry `pending` i dead-letter `failed`.
- Zaimplementować retry policy (exponential backoff + limit prób).
- Dodać runtime metrics workera (ticki, sukcesy, retry, dead-letter, last_error).
- Dodać endpoint statystyk workera dla developerów.
- Dodać testy unit dla workera (success/retry/dead-letter/stats).
- Dodać testy integration endpointu statystyk (auth + RBAC + payload).
- Uruchomić pełne quality gates + smoke E2E fallback.

### Files changed
- `.env.example`
- `backend/.env.example`
- `backend/config.js`
- `backend/server.js`
- `backend/routes/settings.js`
- `backend/services/outbox-worker.js`
- `backend/tests/outbox.worker.service.unit.test.js`
- `backend/tests/domain.events.outbox.integration.test.js`
- `docs/AGENTS.md`
- `docs/skills/outbox-worker-lifecycle.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `curl -s http://localhost:4000/health` -> PASS (`status=ok`)
- `curl -sI http://localhost:3000/login` -> PASS (`HTTP/1.1 200 OK`)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (152/152)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- Repo nie zawiera Playwright/Cypress, więc użyto fallbacku smoke:
  - `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
  - flow: OTP login (user/developer), create ticket, ticket detail, developer update/comment.
- Route checks:
  - `GET /login` -> 200
  - `GET /health` -> 200

### Result
- Dodano serwis `createOutboxWorkerService` (`backend/services/outbox-worker.js`) z:
  - polling schedulerem,
  - lockowaniem due wpisów outbox (`pending` -> `processing`),
  - retry policy (exponential backoff),
  - dead-letter przez status `failed` po przekroczeniu `max_attempts`,
  - runtime observability (`ticks_total`, `processed_total`, `retried_total`, `dead_letter_total`, `last_error`).
- Worker jest domyślnie wyłączony przez `OUTBOX_WORKER_ENABLED=false`, więc nie narusza obecnych flow i testów.
- Dodano endpoint `GET /api/settings/events/outbox/stats` (developer-only).
- Dodano testy:
  - unit worker: success/retry/dead-letter/stats,
  - integration endpoint stats: `401`, `403`, `200` + payload contract.
- Zachowano bezpieczeństwo:
  - endpoint stats pod `authRequired + requireRole("developer")`,
  - brak zmian osłabiających RBAC/ownership w istniejących endpointach write.

### Skills created/updated
- `docs/skills/outbox-worker-lifecycle.md` (created)

## Step P6C-02
- Status: Done (approved by user)
- Commit: `3b5ad2e`
- Description: Recovery stale `processing` + manualny trigger workera (`runOnce`) dla operacyjnej kontroli.

### Implementation Plan
- Dodać timeout dla `processing` (`OUTBOX_WORKER_PROCESSING_TIMEOUT_MS`) w konfiguracji.
- Dodać recovery stale rekordów `processing` -> `pending` przed claimem ticka.
- Rozszerzyć metryki o `recovered_stuck_total` i statystyki kolejki o `stuck_processing`.
- Dodać endpoint developer-only `POST /api/settings/events/outbox/run-once`.
- Rozszerzyć testy unit workera o scenariusz recovery stale rekordów.
- Dodać testy integration endpointu `run-once` (401/403/200).
- Zaktualizować skill workera.
- Uruchomić pełne quality gates + smoke E2E fallback.

### Files changed
- `.env.example`
- `backend/.env.example`
- `backend/config.js`
- `backend/routes/settings.js`
- `backend/services/outbox-worker.js`
- `backend/tests/outbox.worker.service.unit.test.js`
- `backend/tests/domain.events.outbox.integration.test.js`
- `docs/skills/outbox-worker-lifecycle.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `curl -s http://localhost:4000/health` -> PASS (`status=ok`)
- `curl -sI http://localhost:3000/login` -> PASS (`HTTP/1.1 200 OK`)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (156/156)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- Repo nie zawiera Playwright/Cypress, więc użyto fallbacku smoke:
  - `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
  - flow: OTP login (user/developer), create ticket, ticket detail, developer update/comment.
- Route checks:
  - `GET /login` -> 200
  - `GET /health` -> 200

### Result
- Dodano konfigurację timeoutu `processing`:
  - `OUTBOX_WORKER_PROCESSING_TIMEOUT_MS` (domyślnie `300000` ms).
- Worker przed claimem odzyskuje stale rekordy:
  - `processing` starsze niż timeout wracają do `pending`,
  - są obsługiwane w tym samym ticku workera.
- Rozszerzono observability:
  - `queue.stuck_processing`,
  - `runtime.recovered_stuck_total`,
  - `config.processing_timeout_ms`.
- Dodano endpoint operacyjny:
  - `POST /api/settings/events/outbox/run-once` (developer-only),
  - zwraca `summary` i aktualne `stats`.
- Dodano testy:
  - unit: recovery stale `processing`,
  - integration: `run-once` (`401`, `403`, `200` + payload contract).
- Zachowano bezpieczeństwo:
  - brak zmian osłabiających RBAC/ownership,
  - endpoint `run-once` za `authRequired + requireRole("developer")`.

### Skills created/updated
- `docs/skills/outbox-worker-lifecycle.md` (updated)

## Step P6C-03
- Status: Done (approved by user)
- Commit: `732d126`
- Description: Observability kolejki outbox: metryka wieku najstarszego pending + testy kontraktu endpointu stats.

### Implementation Plan
- Dodać metrykę `queue.oldest_pending_age_seconds` w `outboxWorkerService.getStats()`.
- Wyliczać metrykę deterministycznie na podstawie `created_at` najstarszego `pending`.
- Zachować kompatybilność kontraktu endpointu `GET /api/settings/events/outbox/stats`.
- Rozszerzyć testy unit workera o asercję nowej metryki.
- Rozszerzyć test integracyjny endpointu stats o nową metrykę.
- Zaktualizować skill workera o pole metryki.
- Uruchomić pełne quality gates + smoke E2E fallback.

### Files changed
- `backend/services/outbox-worker.js`
- `backend/tests/outbox.worker.service.unit.test.js`
- `backend/tests/domain.events.outbox.integration.test.js`
- `docs/skills/outbox-worker-lifecycle.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `curl -s http://localhost:4000/health` -> PASS (`status=ok`)
- `curl -sI http://localhost:3000/login` -> PASS (`HTTP/1.1 200 OK`)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (156/156)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- Repo nie zawiera Playwright/Cypress, więc użyto fallbacku smoke:
  - `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
  - flow: OTP login (user/developer), create ticket, ticket detail, developer update/comment.
- Route checks:
  - `GET /login` -> 200
  - `GET /health` -> 200

### Result
- Dodano metrykę `queue.oldest_pending_age_seconds` do endpointu stats workera.
- Metryka jest liczona jako wiek (sekundy) najstarszego wpisu `pending` względem `generated_at`.
- Rozszerzono testy:
  - unit worker: deterministyczna asercja wartości metryki (`90s` w scenariuszu testowym),
  - integration endpoint stats: asercja obecności typu `number`.
- Zachowano RBAC i kontrakt endpointów write bez zmian.

### Skills created/updated
- `docs/skills/outbox-worker-lifecycle.md` (updated)

## Step P6C-04
- Status: Done (approved by user)
- Commit: `pending-hash` (uzupełniany po akceptacji i commicie)
- Description: Health flags i progi alertów dla statystyk workera outbox (`/stats`) bez zmiany RBAC i bez regresji flow.

### Implementation Plan
- Dodać konfigurowalne progi alertów `OUTBOX_WORKER_ALERT_*` dla backlogu/pending age/stuck/failed.
- Rozszerzyć `outboxWorkerService.getStats()` o sekcję `health` z flagami i listą ostrzeżeń.
- Rozszerzyć `config` w odpowiedzi stats o aktywne wartości progów alertów.
- Zachować kompatybilność endpointów (`stats` i `run-once`) oraz brak zmian w uprawnieniach.
- Dodać testy unit dla logiki progów (w tym wyłączenie alertu progiem `0`).
- Rozszerzyć testy integracyjne kontraktu endpointów outbox o nowe pola.
- Zaktualizować skill operacyjny workera.
- Uruchomić pełne quality gates + smoke E2E fallback.

### Files changed
- `.env.example`
- `backend/.env.example`
- `backend/config.js`
- `backend/services/outbox-worker.js`
- `backend/tests/outbox.worker.service.unit.test.js`
- `backend/tests/domain.events.outbox.integration.test.js`
- `docs/skills/outbox-worker-lifecycle.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `curl -s http://localhost:4000/health` -> PASS (`status=ok`)
- `curl -sI http://localhost:3000/login` -> PASS (`HTTP/1.1 200 OK`)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (157/157)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- Repo nie zawiera Playwright/Cypress, więc użyto fallbacku smoke:
  - `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
  - flow: OTP login (user/developer), create ticket, ticket detail, developer update/comment.
- Route checks:
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Dodano progi alertów workera outbox:
  - `OUTBOX_WORKER_ALERT_PENDING_THRESHOLD` (default `100`)
  - `OUTBOX_WORKER_ALERT_OLDEST_PENDING_AGE_SECONDS` (default `900`)
  - `OUTBOX_WORKER_ALERT_STUCK_PROCESSING_THRESHOLD` (default `1`)
  - `OUTBOX_WORKER_ALERT_FAILED_THRESHOLD` (default `1`)
- `GET /api/settings/events/outbox/stats` zwraca nową sekcję:
  - `health.status`
  - `health.warning_count`
  - `health.warnings[]`
  - `health.flags.{pending_backlog_high,pending_age_high,stuck_processing_high,failed_items_high}`
  - `health.thresholds.{pending,oldest_pending_age_seconds,stuck_processing,failed}`
- `config` endpointu stats zawiera aktywne wartości progów `alert_*`.
- Dodano test unit potwierdzający:
  - aktywację flag przy niskich progach,
  - wyłączenie alarmów po ustawieniu progów na `0`.
- Rozszerzono testy integracyjne kontraktu endpointów `stats` i `run-once` o nowe pola `health` i `config.alert_*`.
- Zachowano bezpieczeństwo:
  - brak zmian RBAC/ownership,
  - endpointy pozostają pod `authRequired + requireRole("developer")`.

### Skills created/updated
- `docs/skills/outbox-worker-lifecycle.md` (updated)

## Step P6A-25
- Status: Done (approved by user)
- Commit: `d66b13f`
- Description: Wydzielenie logiki synchronizacji ticket <-> dev tasks do `taskSyncService`.

### Implementation Plan
- Dodać nowy serwis `backend/services/task-sync.js`:
  - `ensureDevTaskForAcceptedTicket`,
  - `normalizeLinkedDevTasksForTicket`.
- Przenieść zależne helpery (`getNextActiveTaskOrderForUser`) do nowego serwisu.
- Uprościć `backend/routes/tickets.js`: usunąć lokalne funkcje i używać `taskSyncService`.
- Nie zmieniać kontraktu API ani event flow.
- Dodać testy unit dla `taskSyncService` (kluczowe scenariusze sync).
- Zaktualizować dokumentację skill dla splitu service layer.
- Zaktualizować `docs/AGENTS.md` o nowy skill.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/task-sync.js`
- `backend/routes/tickets.js`
- `backend/tests/task-sync.service.unit.test.js`
- `docs/skills/task-sync-service-split.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (121/121)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Manual scripted browser baseline (repo nie zawiera Playwright/Cypress):
  - `GET /health` -> 200
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Wydzielono `taskSyncService` do `backend/services/task-sync.js`.
- Przeniesiono logikę:
  - `ensureDevTaskForAcceptedTicket(...)`,
  - `normalizeLinkedDevTasksForTicket(...)`,
  - wewnętrzny helper `getNextActiveTaskOrderForUser(...)`.
- Uproszczono `backend/routes/tickets.js` przez usunięcie lokalnych helperów sync.
- Zachowano istniejący kontrakt API i flow statusów.
- Dodano testy unit `backend/tests/task-sync.service.unit.test.js` dla kluczowych scenariuszy sync.

### Skills created/updated
- `docs/skills/task-sync-service-split.md` (created)
- `docs/AGENTS.md` (updated links list)

## Step P6A-26
- Status: Done (approved by user)
- Commit: `f04f2ca`
- Description: Migracja logiki `PATCH /api/tickets/:id` do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.updateTicket({ ticketId, user, rawPayload })`.
- Przenieść do service:
  - access guard (`ticket_not_found`, `forbidden`, `ticket_locked`),
  - walidacje patch payload (developer/user),
  - reguły status transition + `closure_summary_required`,
  - update transakcyjny ticket + historia zmian.
- Wpiąć `taskSyncService` do service, tak aby sync zadań nie żył w route.
- Zwracać z service metadane side effects:
  - zmiana statusu,
  - payload telemetry,
  - dane do notyfikacji.
- Przepiąć route `PATCH /api/tickets/:id` na schemat route->service->response.
- Zachować kontrakt API i obecne eventy (`ticket.closed`, `board.drag`) + mail status update.
- Dodać/uzupełnić testy unit service dla kluczowych ścieżek błędów i success.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (126/126)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Manual scripted browser baseline (repo nie zawiera Playwright/Cypress):
  - `GET /health` -> 200
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Dodano `ticketsService.updateTicket({ ticketId, user, rawPayload })`.
- Przeniesiono do service:
  - access guard (`ticket_not_found`, `forbidden`, `ticket_locked`),
  - walidację payload (`validation_error` + details),
  - reguły lifecycle (`no_changes`, `closure_summary_required`),
  - update transakcyjny ticket + historia zmian,
  - synchronizację tasków przez `taskSyncService`.
- Route `PATCH /api/tickets/:id` działa jako cienki adapter route->service.
- Zachowano side effects w route:
  - telemetry `ticket.closed`,
  - telemetry `board.drag`,
  - notyfikacja `notifyReporterStatusChange`.
- Dodano mapowanie błędów service -> HTTP:
  - `ticket_not_found` -> 404,
  - `forbidden` -> 403,
  - `ticket_locked` -> 403,
  - `project_not_found` -> 400,
  - `assignee_not_found` -> 400,
  - `closure_summary_required` -> 400,
  - `no_changes` -> 400,
  - `validation_error` -> 400.
- Dodano testy unit service dla najważniejszych ścieżek update.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6B-01
- Status: Done (approved by user)
- Commit: `67d77b7`
- Description: Fundament event backbone + durable outbox (infra i API publish bez zmiany flow biznesowego).

### Implementation Plan
- Dodać tabele SQLite dla event backbone/outbox:
  - `domain_events`,
  - `event_outbox`.
- Dodać serwis `backend/services/domain-events.js`:
  - `publishDomainEvent(...)`,
  - zapis do `domain_events`,
  - zapis do `event_outbox` (durable).
- Dodać podstawowe testy unit serwisu (persist + walidacja danych wejściowych).
- Dodać test integracyjny endpointu diagnostycznego dla deva (read-only) do podglądu outbox.
- Nie podłączać jeszcze nowych eventów do flow ticketów (bez ryzyka regresji funkcjonalnej).
- Dodać skill operacyjny dla event backbone/outbox.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/db.js`
- `backend/services/domain-events.js`
- `backend/routes/settings.js`
- `backend/tests/domain.events.service.unit.test.js`
- `backend/tests/domain.events.outbox.integration.test.js`
- `docs/skills/domain-events-outbox.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (134/134)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Manual scripted browser baseline (repo nie zawiera Playwright/Cypress):
  - `GET /health` -> 200
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Dodano tabele i indeksy dla backbone/outbox:
  - `domain_events`,
  - `event_outbox`.
- Dodano serwis `domainEventsService`:
  - `publishDomainEvent(...)` (event + outbox atomowo),
  - `getOutboxEntries(...)` (filtry status/limit).
- Dodano dev-only endpoint diagnostyczny:
  - `GET /api/settings/events/outbox`.
- Dodano testy:
  - unit serwisu domain events,
  - integracyjne endpointu outbox (auth + RBAC + payload).
- Nie zmieniono istniejącego flow ticketów (krok infra-only pod P6B).

### Skills created/updated
- `docs/skills/domain-events-outbox.md` (created)
- `docs/AGENTS.md` (updated links list)

## Step P6B-02
- Status: Done (approved by user)
- Commit: `906f693`
- Description: Publikacja pierwszego eventu domenowego `ticket.created` do `domain_events` + `event_outbox`.

### Implementation Plan
- Dodać helper `appendDomainEventToOutbox(...)` w `domain-events` do użycia w transakcjach domenowych.
- Wpiąć publikację `ticket.created` bezpośrednio w transakcji `ticketsService.createTicket(...)` (atomowo z zapisem ticketu).
- Zachować dotychczasowe telemetry `ticket.created` (bez zmiany kontraktu API).
- Dodać testy unit dla `ticketsService.createTicket(...)` sprawdzające insert event/outbox.
- Dodać test integracyjny API: po utworzeniu ticketu outbox zawiera `ticket.created`.
- Zaktualizować skill outbox o wzorzec publish w transakcji domenowej.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/domain-events.js`
- `backend/services/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `backend/tests/domain.events.outbox.integration.test.js`
- `docs/skills/domain-events-outbox.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (137/137)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Route checks:
  - `GET /login` -> 200
  - `GET /health` -> 200

### Result
- Dodano helper `appendDomainEventToOutbox(...)` i wspólną normalizację payloadu w `domain-events`.
- `ticketsService.createTicket(...)` publikuje teraz `ticket.created` atomowo w tej samej transakcji co insert ticketu.
- Zachowano istniejące telemetry `ticket.created` i kontrakt API.
- Dodano testy:
  - unit: kontrakt eventu outbox przy `createTicket`,
  - unit: propagacja błędu publikacji eventu w flow create ticket,
  - integration: po `POST /api/tickets` istnieje wpis `ticket.created` w `domain_events/event_outbox`.
- Uzupełniono skill o wzorzec publikacji eventu wewnątrz transakcji domenowej.

### Skills created/updated
- `docs/skills/domain-events-outbox.md` (updated)

## Step P6B-03
- Status: Done (approved by user)
- Commit: `b2a77a6`
- Description: Publikacja eventu domenowego `ticket.status_changed` dla zmian statusu zgłoszeń.

### Implementation Plan
- Dodać publikację `ticket.status_changed` w `ticketsService.updateTicket(...)`.
- Zapisać event w tej samej transakcji co update ticketu i `ticket_history`.
- Emitować event tylko przy faktycznej zmianie statusu.
- Dodać payload eventu: `old_status`, `new_status`, `assignee_id`.
- Dodać test unit dla emitowania eventu przy zmianie statusu.
- Dodać test unit dla braku emitowania eventu bez zmiany statusu.
- Dodać test integracyjny API potwierdzający wpis `ticket.status_changed` w outbox.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `backend/tests/domain.events.outbox.integration.test.js`
- `docs/skills/domain-events-outbox.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (140/140)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Route checks:
  - `GET /login` -> 200
  - `GET /health` -> 200

### Result
- `ticketsService.updateTicket(...)` publikuje event `ticket.status_changed` atomowo w transakcji update ticketu.
- Event emitowany jest tylko przy realnej zmianie statusu.
- Payload eventu zawiera: `old_status`, `new_status`, `assignee_id`.
- Dodano testy:
  - unit: event jest emitowany przy zmianie statusu,
  - unit: event nie jest emitowany bez zmiany statusu,
  - integration: po `PATCH /api/tickets/:id` outbox zawiera `ticket.status_changed`.
- Nie zmieniono kontraktów API ani istniejącego RBAC.

### Skills created/updated
- `docs/skills/domain-events-outbox.md` (updated)

## Step P6B-04
- Status: Done (approved by user)
- Commit: `4819226`
- Description: Publikacja eventu domenowego `ticket.closed` dla zamykania zgłoszeń.

### Implementation Plan
- Dodać publikację `ticket.closed` w `ticketsService.updateTicket(...)`.
- Zapisać event w tej samej transakcji co update ticketu i `ticket_history`.
- Emitować event tylko przy przejściu statusu do `closed`.
- Dodać payload eventu: `old_status`, `new_status`, `assignee_id`.
- Dodać test unit dla emitowania `ticket.closed` przy zamykaniu.
- Dodać test unit potwierdzający brak `ticket.closed` przy reopen.
- Dodać test integracyjny API potwierdzający wpis `ticket.closed` w outbox.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `backend/tests/domain.events.outbox.integration.test.js`
- `docs/skills/domain-events-outbox.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (143/143)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Route checks:
  - `GET /login` -> 200
  - `GET /health` -> 200

### Result
- `ticketsService.updateTicket(...)` publikuje event `ticket.closed` atomowo w transakcji zmiany statusu.
- Event emitowany jest tylko przy przejściu statusu do `closed`.
- Payload eventu zawiera: `old_status`, `new_status`, `assignee_id`.
- Dodano testy:
  - unit: emitowanie `ticket.closed` przy zamknięciu,
  - unit: brak `ticket.closed` przy reopen,
  - integration: po closure summary i zamknięciu ticketu outbox zawiera `ticket.closed`.
- Usunięto flakiness testu outbox (`limit=5` -> `limit=50`) dla stabilnego asserta event names.

### Skills created/updated
- `docs/skills/domain-events-outbox.md` (updated)

## Step P6B-05
- Status: Done (approved by user)
- Commit: `b19755f`
- Description: Publikacja eventu domenowego `task.synced` przy synchronizacji ticketów z DevTodo.

### Implementation Plan
- Dodać publikację `task.synced` w `ticketsService.updateTicket(...)` przy wywołaniu sync tasków.
- Zapisać event w tej samej transakcji co update ticketu i sync operacje.
- Dodać payload eventu: `ticket_status`, `assignee_id`, `normalized`, `ensured`.
- Dodać test unit: event `task.synced` przy zmianie statusu.
- Dodać test unit: event `task.synced` przy samej zmianie assignee.
- Dodać test integration API: po patchu ticketu outbox zawiera `task.synced`.
- Ustabilizować asercje testów event names w outbox.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `backend/tests/domain.events.outbox.integration.test.js`
- `docs/skills/domain-events-outbox.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
- `curl -s http://localhost:4000/health` -> PASS (`status=ok`)
- `curl -sI http://localhost:3000/login` -> PASS (`HTTP/1.1 200 OK`)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (145/145)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- Repo nie zawiera Playwright/Cypress (`backend/package.json` i `frontend/package.json` bez skryptów E2E), więc użyto fallbacku:
  - `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
  - smoke flow obejmuje: OTP login (user/developer), create ticket, ticket detail, developer update/comment.
- Route checks:
  - `GET /login` -> 200
  - `GET /health` -> 200

### Result
- `ticketsService.updateTicket(...)` publikuje event `task.synced` atomowo w tej samej transakcji co update ticketu i sync tasków.
- Event emitowany jest przy działaniach synchronizacji (`normalize` lub `ensure`) i zawiera payload:
  - `ticket_status`
  - `assignee_id`
  - `normalized`
  - `ensured`
- Dodano testy:
  - unit: `task.synced` przy zmianie statusu (współistnienie z `ticket.status_changed`),
  - unit: `task.synced` przy samej zmianie `assignee_id`,
  - integration: po planowaniu/assign outbox zawiera `task.synced`.
- Zachowano istniejące reguły RBAC/ownership i kontrakty API bez zmian.

### Skills created/updated
- `docs/skills/domain-events-outbox.md` (updated)

## Step P6A-08
- Status: Done (approved by user)
- Commit: `4a18980`
- Description: Migracja endpointu `GET /api/tickets/stats/overview` do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.getOverviewStats()` z aktualną logiką agregacji statusów + `closed_today`.
- Przepiąć route `/api/tickets/stats/overview` na wywołanie service i zachować kontrakt JSON.
- Dodać testy unit service dla agregacji i domyślnych zer.
- Utrzymać RBAC bez zmian (endpoint nadal dostępny dla authenticated user).
- Zaktualizować skill/checklistę migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (63/63)
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
- Endpoint `GET /api/tickets/stats/overview` został przeniesiony do `ticketsService.getOverviewStats()`.
- Route zachowuje ten sam kontrakt JSON (statusy + `closed_today`).
- Dodano testy unit dla:
  - poprawnej agregacji z `GROUP BY status`,
  - poprawnego wyliczenia `closed_today`,
  - fallbacku zer dla brakujących danych.
- Endpoint nadal wymaga `authRequired` i nie zmienia reguł dostępu.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-09
- Status: Done (approved by user)
- Commit: `253dc41`
- Description: Migracja endpointu `GET /api/tickets/stats/activation` do warstwy `ticketsService`.

### Implementation Plan
- Przenieść `buildActivationStats` i zależne helpery dat/czasu do `backend/services/tickets.js`.
- Dodać `ticketsService.getActivationStats()` i zachować kontrakt odpowiedzi 1:1.
- Przepiąć route `/api/tickets/stats/activation` na service.
- Dodać testy unit dla `getActivationStats` (deterministyczny scenariusz + brak danych).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (65/65)
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
- Endpoint `GET /api/tickets/stats/activation` został przeniesiony do `ticketsService.getActivationStats()`.
- Usunięto duplikację logiki wyliczeń activation stats z route.
- Zachowano kontrakt odpowiedzi i RBAC (`developer-only` przez middleware route).
- Dodano testy unit dla metody service:
  - scenariusz deterministyczny,
  - brak próbek i fallback `null/0`.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-10
- Status: Done (approved by user)
- Commit: `d6f7df8`
- Description: Migracja endpointu `GET /api/tickets/stats/usage` do warstwy `ticketsService`.

### Implementation Plan
- Przenieść `buildFeatureUsageStats` i helpery timeline do `backend/services/tickets.js`.
- Dodać `ticketsService.getUsageStats()` z zachowaniem obecnego kontraktu odpowiedzi.
- Przepiąć route `/api/tickets/stats/usage` na wywołanie service.
- Dodać testy unit dla `getUsageStats` (agregacja eventów + coverage + timeline 14d).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (67/67)
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
- Endpoint `GET /api/tickets/stats/usage` został przeniesiony do `ticketsService.getUsageStats()`.
- Helpery usage (event map + timeline 14d + coverage 30d) zostały przeniesione do service.
- Route `tickets` została odchudzona i utrzymuje ten sam kontrakt odpowiedzi.
- Dodano testy unit dla:
  - agregacji usage i coverage,
  - fallbacku coverage=100 przy pustym oknie telemetry.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-11
- Status: Done (approved by user)
- Commit: `f2446fa`
- Description: Migracja endpointu `GET /api/tickets/closure-summaries/index-feed` do warstwy `ticketsService`.

### Implementation Plan
- Przenieść `buildClosureSummaryIndexFeed` do `backend/services/tickets.js`.
- Dodać metodę `ticketsService.getClosureSummaryIndexFeed({ limit, updatedSince })`.
- Przepiąć route `/api/tickets/closure-summaries/index-feed` na wywołanie service.
- Dodać testy unit metody feed (mapowanie elementów + filtr `updated_since`).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (69/69)
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
- Endpoint `GET /api/tickets/closure-summaries/index-feed` został przeniesiony do `ticketsService.getClosureSummaryIndexFeed(...)`.
- Logika mapowania feedu i filtra `updated_since` została usunięta z route i przeniesiona do service.
- Zachowano kontrakt odpowiedzi (`generated_at`, `count`, `items`).
- Dodano testy unit dla:
  - mapowania pojedynczego rekordu feedu,
  - poprawnego użycia filtra `updatedSince`.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-12
- Status: Done (approved by user)
- Commit: `09cd75e`
- Description: Migracja endpointu `GET /api/tickets/board` do warstwy `ticketsService`.

### Implementation Plan
- Przenieść logikę pobierania i grupowania Kanban board do `ticketsService.getBoard()`.
- Zachować kontrakt payloadu: status buckets + `_stats`.
- Przepiąć route `/api/tickets/board` na wywołanie service.
- Dodać testy unit dla metody board (grupowanie po statusie + `_stats`).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (70/70)
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
- Endpoint `GET /api/tickets/board` został przeniesiony do `ticketsService.getBoard()`.
- Zachowano strukturę odpowiedzi Kanban:
  - buckety statusów,
  - `_stats` liczone per status.
- Route Kanban została odchudzona do adaptera HTTP.
- Dodano test unit dla grupowania board i poprawności `_stats`.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-13
- Status: Done (approved by user)
- Commit: `53cedb7`
- Description: Migracja endpointu `GET /api/tickets/:id/external-references` do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.getExternalReferences({ ticketId })` i przenieść SQL z helpera route.
- Dodać `ticketsService.getTicketById({ ticketId })` jako bezpieczny accessor dla read endpointów.
- Przepiąć route `GET /api/tickets/:id/external-references` na service layer.
- Dodać testy unit metody `getExternalReferences`.
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (72/72)
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
- Dla flow `external-references` dodano service methods:
  - `ticketsService.getTicketById({ ticketId })`
  - `ticketsService.getExternalReferences({ ticketId })`
- Endpoint `GET /api/tickets/:id/external-references` działa przez service layer.
- Zredukowano SQL w route (helpery route delegują do service).
- Dodano testy unit dla metod service: ticket by id + external references.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-14
- Status: Done (approved by user)
- Commit: `e188d64`
- Description: Migracja endpointu `GET /api/tickets/:id/related` do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.getRelatedTickets({ ticketId, user })` z zachowaniem RBAC visibility filter.
- Przepiąć route `GET /api/tickets/:id/related` na service layer.
- Dodać testy unit metody `getRelatedTickets` (developer vs user, filtr reporter_id).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (74/74)
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
- Dodano `ticketsService.getRelatedTickets({ ticketId, user })` z regułą widoczności:
  - developer bez filtra reporter,
  - user z filtrem `reporter_id = user.id`.
- Endpoint `GET /api/tickets/:id/related` działa przez service layer.
- Dodano testy unit dla scenariusza developer i user (SQL filter + params).
- Zmiana nie narusza kontraktu odpowiedzi endpointu.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-15
- Status: Done (approved by user)
- Commit: `f42cf2c`
- Description: Migracja endpointu `GET /api/tickets/:id` (ticket detail) do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.getTicketDetail({ ticketId, user })` z pełnym payloadem detail.
- W service zachować regułę widoczności komentarzy: developer widzi wszystkie, user tylko publiczne.
- Przepiąć route `GET /api/tickets/:id` na service layer + mapowanie błędów (`ticket_not_found`, `forbidden`).
- Dodać testy unit dla `getTicketDetail` (developer/user, brak ticketu, forbidden).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (78/78)
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
- Dodano `ticketsService.getTicketDetail({ ticketId, user })` z pełnym payloadem detail.
- Zachowano RBAC/ownership:
  - `ticket_not_found` -> 404,
  - `forbidden` -> 403.
- Zachowano widoczność komentarzy:
  - developer widzi wszystkie komentarze,
  - user widzi tylko komentarze publiczne (`is_internal = 0`).
- Endpoint `GET /api/tickets/:id` został odchudzony do adaptera HTTP (`auth + validate + service + response mapping`).
- Dodano testy unit dla scenariuszy success/failure i reguł widoczności.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-16
- Status: Done (approved by user)
- Commit: `9fdf548`
- Description: Migracja endpointu `GET /api/tickets/:id/external-references` do warstwy `ticketsService` z pełnym ownership guard w service.

### Implementation Plan
- Dodać `ticketsService.getTicketExternalReferences({ ticketId, user })`.
- Przenieść do service walidację odczytu ticketu (`ticket_not_found`, `forbidden`) dla external references.
- Przepiąć route `GET /api/tickets/:id/external-references` do schematu `auth + validate + service + response mapping`.
- Zachować kontrakt payloadu endpointu (lista referencji bez zmian).
- Dodać testy unit service (developer success, owner success, 404, 403).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (82/82)
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
- Dodano `ticketsService.getTicketExternalReferences({ ticketId, user })` z centralnym ownership guard.
- `GET /api/tickets/:id/external-references` działa jako cienki adapter HTTP z mapowaniem błędów:
  - `ticket_not_found` -> 404,
  - `forbidden` -> 403.
- Zachowano kontrakt odpowiedzi endpointu (lista referencji z tym samym payloadem).
- Dodano testy unit service dla scenariuszy:
  - developer success,
  - owner-user success,
  - 404 dla brakującego ticketu,
  - 403 dla nieuprawnionego usera.
- Zrefaktorowano powtarzalny guard odczytu ticketu do helpera service (`getReadableTicketOrThrow`).

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-17
- Status: Done (approved by user)
- Commit: `2a13a78`
- Description: Migracja endpointu `POST /api/tickets/:id/external-references` do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.createTicketExternalReference({ ticketId, user, payload })`.
- Przenieść insert external reference i normalizację pól (`url`, `title`) do service.
- Zachować zabezpieczenia: walidacja kontekstu usera, rola `developer`, `ticket_not_found`.
- Przepiąć route `POST /api/tickets/:id/external-references` do schematu route->service->response.
- Zachować kontrakt endpointu (`201` + lista external references).
- Dodać testy unit service (success, `ticket_not_found`, `forbidden`).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (85/85)
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
- Dodano `ticketsService.createTicketExternalReference({ ticketId, user, payload })`.
- Przeniesiono insert external reference do service wraz z normalizacją:
  - `url` jest trimowane,
  - `title` jest trimowane lub `null`.
- Dodano zabezpieczenia w service:
  - tylko `developer` może wykonać write (`forbidden` 403),
  - brak ticketu zwraca `ticket_not_found` 404.
- Endpoint `POST /api/tickets/:id/external-references` działa jako cienki adapter route->service.
- Kontrakt endpointu zachowany: `201` + lista external references.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-18
- Status: Done (approved by user)
- Commit: `1095ae5`
- Description: Migracja endpointu `DELETE /api/tickets/:id/external-references/:refId` do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.deleteTicketExternalReference({ ticketId, refId, user })`.
- Przenieść logikę DELETE external reference do service wraz z kontrolą roli `developer`.
- Zachować semantykę błędów: `ticket_not_found`, `forbidden`, `external_reference_not_found`.
- Przepiąć route `DELETE /api/tickets/:id/external-references/:refId` na schemat route->service->response.
- Zachować kontrakt endpointu (`204` przy sukcesie).
- Dodać testy unit service (success, `ticket_not_found`, `forbidden`, `external_reference_not_found`).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (89/89)
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
- Dodano `ticketsService.deleteTicketExternalReference({ ticketId, refId, user })`.
- Przeniesiono logikę DELETE external reference do service.
- Zachowano semantykę błędów:
  - `ticket_not_found` -> 404,
  - `forbidden` -> 403,
  - `external_reference_not_found` -> 404.
- Endpoint `DELETE /api/tickets/:id/external-references/:refId` działa jako cienki adapter route->service.
- Kontrakt endpointu zachowany: `204` przy sukcesie.
- Dodano testy unit dla scenariuszy success + wszystkie ścieżki błędów.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-19
- Status: Done (approved by user)
- Commit: `93ec49a`
- Description: Migracja endpointu `POST /api/tickets/:id/related` do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.createTicketRelation({ ticketId, user, payload })`.
- Przenieść do service rozpoznanie ticketu powiązanego (`related_ticket_id` lub `related_ticket_number`).
- Zachować istniejącą semantykę błędów:
  - `ticket_not_found`,
  - `related_ticket_not_found`,
  - `ticket_relation_self_ref`,
  - `forbidden`.
- Przenieść logikę insert/fallback existing relation do service i zwracać listę related tickets.
- Przepiąć route `POST /api/tickets/:id/related` do schematu route->service->response.
- Dodać testy unit service (success + wszystkie ścieżki błędów).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (95/95)
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
- Dodano `ticketsService.createTicketRelation({ ticketId, user, payload })`.
- Przeniesiono do service:
  - rozpoznanie powiązanego ticketu po `related_ticket_id` lub `related_ticket_number`,
  - walidację błędów (`ticket_not_found`, `related_ticket_not_found`, `ticket_relation_self_ref`, `forbidden`),
  - insert relacji z idempotencją (duplikat zwraca istniejący stan bez nowego wpisu).
- Endpoint `POST /api/tickets/:id/related` działa przez route->service i zachowuje kontrakt:
  - `201` przy nowej relacji,
  - `200` przy istniejącej relacji.
- Dodano testy unit service dla scenariuszy success + wszystkie ścieżki błędów.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-20
- Status: Done (approved by user)
- Commit: `527ec1f`
- Description: Migracja endpointu `DELETE /api/tickets/:id/related/:relatedId` do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.deleteTicketRelation({ ticketId, relatedTicketId, user })`.
- Przenieść logikę usuwania relacji do service z kontrolą roli `developer`.
- Zachować semantykę błędów:
  - `ticket_not_found`,
  - `related_ticket_not_found`,
  - `ticket_relation_not_found`,
  - `forbidden`.
- Przepiąć route `DELETE /api/tickets/:id/related/:relatedId` do schematu route->service->response.
- Zachować kontrakt endpointu (`204` przy sukcesie).
- Dodać testy unit service (success + wszystkie ścieżki błędów).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (100/100)
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
- Dodano `ticketsService.deleteTicketRelation({ ticketId, relatedTicketId, user })`.
- Przeniesiono logikę usuwania relacji do service.
- Zachowano semantykę błędów:
  - `ticket_not_found` -> 404,
  - `related_ticket_not_found` -> 404,
  - `ticket_relation_not_found` -> 404,
  - `forbidden` -> 403.
- Endpoint `DELETE /api/tickets/:id/related/:relatedId` działa jako cienki adapter route->service.
- Kontrakt endpointu zachowany: `204` przy sukcesie.
- Dodano testy unit service dla scenariuszy success + wszystkie ścieżki błędów.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-21
- Status: Done (approved by user)
- Commit: `2598a52`
- Description: Migracja endpointu `GET /api/tickets/:id/related` do warstwy `ticketsService` z ownership guard w service.

### Implementation Plan
- Dodać `ticketsService.getTicketRelatedList({ ticketId, user })`.
- Przenieść do service ownership guard (`ticket_not_found`, `forbidden`) dla odczytu related list.
- Przepiąć route `GET /api/tickets/:id/related` do schematu route->service->response.
- Zachować kontrakt odpowiedzi endpointu (lista related tickets bez zmian).
- Dodać testy unit service dla scenariuszy:
  - success (developer / owner user),
  - `ticket_not_found`,
  - `forbidden`.
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (104/104)
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
- Dodano `ticketsService.getTicketRelatedList({ ticketId, user })`.
- Przeniesiono do service ownership guard dla endpointu related read:
  - `ticket_not_found` -> 404,
  - `forbidden` -> 403.
- Endpoint `GET /api/tickets/:id/related` działa jako cienki adapter route->service.
- Zachowano kontrakt odpowiedzi endpointu (lista related tickets bez zmian).
- Dodano testy unit service dla:
  - success developer/user owner,
  - `ticket_not_found`,
  - `forbidden`.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-22
- Status: Done (approved by user)
- Commit: `26f804d`
- Description: Migracja endpointu `POST /api/tickets/:id/attachments` do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.createTicketAttachments({ ticketId, user, files, maxUploadBytesTotal })`.
- Przenieść do service:
  - ownership guard (`ticket_not_found`, `forbidden`),
  - walidację `attachments_required`,
  - limit sumy rozmiaru uploadu (`attachments_too_large`).
- Przenieść insert + odczyt utworzonych attachmentów do service i zwracać listę attachmentów.
- Przepiąć route `POST /api/tickets/:id/attachments` do schematu route->service->response.
- Zachować kontrakt endpointu (`201` + lista attachmentów).
- Dodać testy unit service (success + ścieżki błędów).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (109/109)
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
- Dodano `ticketsService.createTicketAttachments({ ticketId, user, files, maxUploadBytesTotal })`.
- Przeniesiono do service:
  - ownership guard (`ticket_not_found`, `forbidden`),
  - walidację `attachments_required`,
  - limit sumy uploadu `attachments_too_large`.
- Przeniesiono insert + odczyt utworzonych attachmentów do service.
- Endpoint `POST /api/tickets/:id/attachments` działa jako cienki adapter route->service.
- Zachowano kontrakt endpointu: `201` + lista attachmentów.
- Dodano testy unit service dla success i wszystkich ścieżek błędów.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-23
- Status: Done (approved by user)
- Commit: `d9904e9`
- Description: Migracja endpointu `POST /api/tickets/:id/comments` do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.createTicketComment({ ticketId, user, payload })`.
- Przenieść do service:
  - ownership guard (`ticket_not_found`, `forbidden`),
  - walidacje domenowe komentarza (`invalid_closure_summary_visibility`, `invalid_parent_comment`),
  - insert komentarza i odczyt utworzonego wpisu.
- Zwracać z service metadane do side effects (powiadomienia i telemetry) bez zmiany kontraktu API.
- Przepiąć route `POST /api/tickets/:id/comments` do schematu route->service->response.
- Zachować obecne RBAC dla `is_internal` i `is_closure_summary`.
- Dodać testy unit service (success + ścieżki błędów).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (115/115)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Manual scripted browser baseline (repo nie zawiera Playwright/Cypress):
  - `GET /health` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Dodano `ticketsService.createTicketComment({ ticketId, user, payload })`.
- Przeniesiono do service:
  - ownership guard (`ticket_not_found`, `forbidden`),
  - walidacje komentarza (`invalid_closure_summary_visibility`, `invalid_parent_comment`),
  - insert komentarza + odczyt utworzonego wpisu.
- Endpoint `POST /api/tickets/:id/comments` działa jako cienki adapter route->service.
- Zachowano side effects w route:
  - powiadomienie reportera o komentarzu deva (tylko publiczny komentarz),
  - telemetry `closure_summary_added`.
- Dodano mapowanie błędów service -> HTTP:
  - `ticket_not_found` -> 404,
  - `forbidden` -> 403,
  - `invalid_closure_summary_visibility` -> 400,
  - `invalid_parent_comment` -> 400.
- Dodano testy unit service dla success i ścieżek błędów.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)

## Step P6A-24
- Status: Done (approved by user)
- Commit: `fc531d9`
- Description: Migracja endpointu `POST /api/tickets` do warstwy `ticketsService`.

### Implementation Plan
- Dodać `ticketsService.createTicket({ user, payload, files })`.
- Przenieść do service:
  - walidację referencji (`project_not_found`),
  - inkrementację licznika ticketów,
  - insert ticketu i attachmentów w jednej transakcji.
- Zwracać z service metadane side effects:
  - `ticketId`,
  - `shouldTrackTicketCreated`,
  - `telemetry` payload.
- Przepiąć route `POST /api/tickets` do schematu route->service->response.
- Zachować kontrakt API (`201` + pełny ticket payload).
- Dodać testy unit service (success + `project_not_found`).
- Zaktualizować skill migracji route->service.
- Uruchomić pełne quality gates + smoke E2E baseline.

### Files changed
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/skills/tickets-route-to-service.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (117/117)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Manual scripted browser baseline (repo nie zawiera Playwright/Cypress):
  - `GET /health` -> 200
  - `GET /` -> 200
  - `GET /login` -> 200
  - `GET /my-tickets` -> 200
  - `GET /overview` -> 200
  - `GET /board` -> 200
  - `GET /dev-todo` -> 200

### Result
- Dodano `ticketsService.createTicket({ user, payload, files })`.
- Przeniesiono do service:
  - walidację referencji `project_id` (`project_not_found`),
  - inkrementację `ticket_counter`,
  - insert ticketu i attachmentów w jednej transakcji.
- Endpoint `POST /api/tickets` działa jako cienki adapter route->service.
- Zachowano kontrakt API (`201` + payload nowo utworzonego ticketu).
- Zachowano telemetry `ticket.created` (event dispatch z route na podstawie metadanych z service).
- Dodano mapowanie błędu service `project_not_found` -> HTTP 400.
- Dodano testy unit service dla success i `project_not_found`.

### Skills created/updated
- `docs/skills/tickets-route-to-service.md` (updated)
