# OpenArca — Progress Log

## Step E-ST1-SupportThreads-EnterpriseBootstrap-01
- Status: Done (approved by user)
- Description: Fundament modułu Enterprise `Support Threads`: nowy capability contract, loader prywatnych tras oraz bootstrap pustego repo `OpenArca-Enterprise`.

### Implementation Plan
- Dodać capability `enterprise_support_threads` do backendu i frontendu OpenArca.
- Dodać `EXTENSIONS_ROUTES_FILE` oraz loader prywatnych tras Enterprise.
- Przekazać do route module bezpieczny kontekst (`express`, middleware, `db`, `getService`).
- Dodać testy backendu dla loadera i endpointu Enterprise feature-gated.
- Zaktualizować env examples i dokumentację agenta.
- Przygotować minimalny skeleton `Support Threads` w prywatnym repo Enterprise.

### Files changed
- `backend/constants.js`
- `backend/services/capabilities.js`
- `backend/config.js`
- `backend/app.js`
- `backend/core/routes-extension-loader.js`
- `.env.example`
- `backend/.env.example`
- `docker-compose.enterprise.override.yml`
- `frontend/src/contexts/CapabilitiesContext.jsx`
- `backend/tests/routes.extension-loader.unit.test.js`
- `backend/tests/enterprise.support-threads.feature.integration.test.js`
- `docs/skills/enterprise-route-modules.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/README.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/extensions/service-overrides.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/extensions/routes.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/docs/support-threads.md`

### Tests run
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (166/166)
- `docker compose exec -T frontend npm test` -> PASS (26/26)
- `docker compose exec -T frontend npm run build` -> PASS
  - ostrzeżenie Vite o dużym chunku `>500 kB`, bez regresji builda

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml up --build -d` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml ps` -> PASS (`backend`, `frontend`, `mailpit`)
- `curl -sI http://localhost:3330` -> PASS (`200 OK`)
- `curl -sI http://localhost:4000/health` -> PASS (`200 OK`)
- `docker compose ... exec -T backend ls /opt/openarca-enterprise/backend/extensions` -> PASS
- live OTP login + feature-gated endpoint check inside backend container -> PASS
  - `POST /api/auth/request-otp` -> `200`
  - `POST /api/auth/verify-otp` -> `200`
  - `GET /api/enterprise/support-threads/health` -> `200`

### Result
- OpenArca ma nowy capability contract `enterprise_support_threads`.
- Publiczny backend potrafi bezpiecznie montować prywatne trasy z osobnego repo przez `EXTENSIONS_ROUTES_FILE`.
- Prywatne route module dostaje kontrolowany kontekst: `express`, `db`, `getService`, `authRequired`, `requireRole`, `requireFeature`.
- Powstał pierwszy działający punkt wejścia modułu Enterprise `Support Threads`.
- Puste repo `OpenArca-Enterprise` zostało zbootstrapowane minimalnym szkieletem pod dalsze etapy implementacji.

### Skills created/updated
- `docs/skills/enterprise-route-modules.md` (created)

## Step E-ST2A-SupportThreads-BackendFoundation-01
- Status: Done (approved by user)
- Description: Pierwszy realny backend modułu `Support Threads` w repo Enterprise: schema SQLite, serwis domenowy, endpointy list/detail/create/message/update oraz testy modułu.

### Implementation Plan
- Dodać minimalny pakiet Node w repo Enterprise pod testy modułu.
- Zaimplementować schema `support_threads` i `support_thread_messages`.
- Zbudować serwis domenowy: `listThreads`, `getThreadDetail`, `createThread`, `addMessage`, `updateThread`.
- Wymusić ownership i RBAC: user tylko własne wątki, developer globalny inbox i status/przypisanie.
- Dodać regułę reopen: nowa wiadomość usera otwiera zamknięty wątek.
- Podpiąć endpointy modułu do `backend/extensions/routes.js`.
- Dodać testy modułu w repo Enterprise oraz skill dla dalszych kroków.
- Uruchomić quality gates OpenArca i smoke flow `Support Threads` przez stack Enterprise.

### Files changed
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/package.json`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/package-lock.json`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/.gitignore`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/support-threads/schema.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/support-threads/service.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/extensions/routes.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/tests/support-threads.service.test.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/docs/AGENTS.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/docs/skills/support-threads-backend.md`
- `docs/PROGRESS.md`

### Tests run
- `npm test --prefix /Users/piotrektomczak/dev/OpenArca-Enterprise` -> PASS (4/4)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (166/166)
- `docker compose exec -T frontend npm run lint` -> PASS
- `docker compose exec -T frontend npm test` -> PASS (26/26)
- `docker compose exec -T frontend npm run build` -> PASS
  - ostrzeżenie Vite o chunku `>500 kB`, bez regresji builda

### E2E run
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml restart backend` -> PASS
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- live smoke `Support Threads` inside backend container -> PASS
  - user OTP login -> PASS
  - developer OTP login -> PASS
  - `POST /api/enterprise/support-threads` -> `201`
  - `GET /api/enterprise/support-threads` -> `200`
  - `PATCH /api/enterprise/support-threads/:id` -> `200`
  - `POST /api/enterprise/support-threads/:id/messages` (developer) -> `201`
  - `POST /api/enterprise/support-threads/:id/messages` (user reopen) -> `201`
  - final status after user reply -> `open`

### Result
- Repo Enterprise ma własny backend foundation dla `Support Threads`.
- Moduł tworzy własne tabele i działa niezależnie od pełnych ticketów.
- User może utworzyć wątek, odczytać własny detail i dopisać wiadomość.
- Developer ma inbox, może zmienić status oraz przypisanie.
- Zamknięty wątek otwiera się ponownie po nowej wiadomości usera.

### Skills created/updated
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/docs/skills/support-threads-backend.md` (created)

## Step E-ST2B1-SupportThreads-Attachments-01
- Status: Done (approved by user)
- Enterprise commit: `3bf6418`
- Description: Dodanie załączników do `Support Threads` na poziomie wiadomości, z bezpiecznym pobieraniem plików i integracją z publicznym backendem OpenArca.

### Implementation Plan
- Przekazać do prywatnych route modules bezpieczny kontekst uploadów z OpenArca (`uploadsDir`, `writeLimiter`, `upload`).
- Rozszerzyć schema Enterprise o tabelę `support_thread_attachments`.
- Zapisać attachmenty przy tworzeniu wątku i przy odpowiedzi, zawsze powiązane z konkretną wiadomością.
- Zwracać metadata attachmentów w detailu wątku i po create/reply.
- Dodać endpoint pobrania attachmentu z ownership/RBAC.
- Ograniczyć payload załączników limitem łącznego rozmiaru oraz walidacją nazw.
- Dodać testy modułu Enterprise dla create/reply/download/oversize.
- Uruchomić quality gates OpenArca i live smoke flow na stacku Enterprise.

### Files changed
- `backend/app.js`
- `docs/PROGRESS.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/support-threads/schema.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/support-threads/service.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/extensions/routes.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/tests/support-threads.service.test.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/docs/skills/support-threads-backend.md`

### Tests run
- `npm test --prefix /Users/piotrektomczak/dev/OpenArca-Enterprise` -> PASS (6/6)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (166/166)
- `docker compose exec -T frontend npm run lint` -> PASS
- `docker compose exec -T frontend npm test` -> PASS (26/26)
- `docker compose exec -T frontend npm run build` -> PASS
  - ostrzeżenie Vite o chunku `>500 kB`, bez regresji builda

### E2E run
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml up --build -d` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml ps` -> PASS
- live smoke `Support Threads attachments` -> PASS
  - user OTP login -> PASS
  - developer OTP login -> PASS
  - `POST /api/enterprise/support-threads` z multipart attachment -> `201`
  - `GET /api/enterprise/support-threads?status=open` -> `200`
  - `POST /api/enterprise/support-threads/:id/messages` z multipart attachment -> `201`
  - `PATCH /api/enterprise/support-threads/:id` -> `200`
  - `GET /api/enterprise/support-threads/:id` -> `200`
  - `GET /api/enterprise/support-thread-attachments/:filename` dla attachmentu usera -> `200`
  - `GET /api/enterprise/support-thread-attachments/:filename` dla attachmentu odpowiedzi developera -> `200`

### Result
- `Support Threads` obsługuje już załączniki przy tworzeniu wątku i przy odpowiedziach.
- Attachmenty są przypięte do wiadomości, a nie tylko do całego wątku.
- Requester i developer mogą pobrać pliki przez dedykowany endpoint Enterprise z ownership checkiem.
- Publiczny backend OpenArca przekazuje do prywatnych route modules tylko potrzebny kontekst uploadów, bez wycieku szerszej logiki.
- Limit łącznego rozmiaru attachmentów jest egzekwowany po stronie modułu.

### Skills created/updated
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/docs/skills/support-threads-backend.md` (updated)

## Step E-ST2B2-SupportThreads-NotificationsAndInbox-01
- Status: Done (approved by user)
- Enterprise commit: `4d5efed`
- Description: Dodanie prostych powiadomień mailowych `create/reply/status change` oraz rozszerzenie inbox summary/query modelu dla `Support Threads`.

### Implementation Plan
- Rozszerzyć publiczny extension context OpenArca o `sendEmail` i `appUrl`.
- Dodać w repo Enterprise notifier mailowy dla `Support Threads`.
- Wysyłać powiadomienia dla:
  - nowego wątku do developerów,
  - odpowiedzi developera do requestera,
  - odpowiedzi usera do assignee lub inboxu developerów,
  - zmiany statusu do requestera.
- Traktować email jako side effect, który nie blokuje głównego requestu.
- Rozszerzyć summary listy wątków o pola potrzebne pod przyszłe UI.
- Dodać filtrowanie `q` i `assignee_id` do inboxu developera.
- Pokryć notifier i query model testami modułu Enterprise.
- Uruchomić quality gates OpenArca oraz live smoke z realnym SMTP na Mailpit.

### Files changed
- `backend/app.js`
- `docs/PROGRESS.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/support-threads/service.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/support-threads/notifier.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/extensions/routes.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/tests/support-threads.service.test.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/tests/support-threads.notifier.test.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/docs/skills/support-threads-backend.md`

### Tests run
- `npm test --prefix /Users/piotrektomczak/dev/OpenArca-Enterprise` -> PASS (10/10)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (166/166)
- `docker compose exec -T frontend npm run lint` -> PASS
- `docker compose exec -T frontend npm test` -> PASS (26/26)
- `docker compose exec -T frontend npm run build` -> PASS
  - ostrzeżenie Vite o chunku `>500 kB`, bez regresji builda

### E2E run
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml up --build -d backend` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml ps` -> PASS
- live smoke `Support Threads notifications + inbox query` -> PASS
  - developer patch settings -> SMTP `mailpit:1025`
  - user OTP login -> PASS
  - developer OTP login -> PASS
  - `POST /api/enterprise/support-threads` -> `201`
  - `GET /api/enterprise/support-threads?q=author%20profile&status=open` -> `200`
  - `POST /api/enterprise/support-threads/:id/messages` -> `201`
  - `PATCH /api/enterprise/support-threads/:id` -> `200`
  - Mailpit subjects potwierdzone:
    - `New support thread: ...` / `Nowy wątek supportowy: ...`
    - `New message: ...` / `Nowa wiadomość: ...`
    - `Support thread status updated: ...` / `Zmieniono status wątku: ...`

### Result
- `Support Threads` wysyła maile dla nowego wątku, odpowiedzi i zmiany statusu.
- Powiadomienia działają na istniejącym providerze OpenArca i nie blokują requestu.
- Inbox summary zwraca pola pod przyszłe UI:
  - `message_count`
  - `latest_message_preview`
  - `latest_message_author_role`
  - `has_attachments`
- Inbox developera wspiera już filtrowanie po `q` i `assignee_id`.

### Skills created/updated
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/docs/skills/support-threads-backend.md` (updated)

## Step E-ST3A-SupportThreads-FrontendInbox-01
- Status: Done (approved by user)
- Enterprise commit: `e3fe275`
- Description: Pierwszy frontend modułu `Support Threads`: publiczny extension point dla prywatnych ekranów Enterprise oraz read-only inbox developera w osobnym repo.

### Implementation Plan
- Dodać frontendowy stub i alias `virtual:enterprise-frontend` w OpenArca.
- Dodać `FeatureRoute` i render prywatnych tras w `App.jsx`.
- Rozszerzyć `AppShell` o sekcje menu Enterprise filtrowane po capability.
- Zbudować w repo Enterprise pierwszy ekran `Support Threads Inbox` z podstawowymi filtrami i podsumowaniem.
- Dodać testy publicznego routingu oraz test prywatnego widoku przez alias.
- Udokumentować wzorzec frontendowych modułów Enterprise.
- Uruchomić quality gates i live smoke `http://localhost:3330/support-threads`.

### Files changed
- `frontend/src/App.jsx`
- `frontend/src/components/AppShell.jsx`
- `frontend/src/components/FeatureRoute.jsx`
- `frontend/src/components/__tests__/AppShell.test.jsx`
- `frontend/src/components/__tests__/routes.test.jsx`
- `frontend/src/pages/__tests__/SupportThreadsInbox.enterprise.test.jsx`
- `frontend/src/enterprise/extensions.stub.jsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `frontend/vite.config.js`
- `docker-compose.enterprise.override.yml`
- `docs/skills/enterprise-frontend-modules.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/extensions/index.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/api.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/DetailPage.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/InboxPage.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/styles.css`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/docs/AGENTS.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/docs/skills/support-threads-frontend.md`

### Tests run
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (166/166)
- `npm test` in `/Users/piotrektomczak/dev/OpenArca-Enterprise` -> PASS (10/10)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run lint` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm test` -> PASS (31/31)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run build` -> PASS
  - ostrzeżenie Vite o chunku `>500 kB`, bez regresji builda

### E2E run
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml up --build -d` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml ps` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- `curl -sI http://localhost:3330/` -> PASS (`200 OK`)
- `curl -sI http://localhost:3330/support-threads` -> PASS (`200 OK`)
- `curl -sI http://localhost:4000/health` -> PASS (`200 OK`)
- frontend smoke fallback:
  - stack z override montuje prywatny frontend z `/opt/openarca-enterprise`
  - build publicznego frontendu przeszedł z aktywnym modułem Enterprise
  - inbox page render jest pokryty testem `SupportThreadsInbox.enterprise.test.jsx`

### Result
- OpenArca ma już frontendowy extension point dla prywatnych modułów Enterprise.
- Sidebar potrafi renderować sekcje Enterprise tylko dla aktywnych capability.
- Prywatny moduł `Support Threads` wnosi własne trasy `/support-threads` oraz `/support-threads/:id`.
- Inbox pokazuje podsumowanie, filtrowanie `q/status/scope`, stany `loading/error/empty` i podstawowe metadata wątków.
- Tytuł wątku prowadzi do read-only detailu z historią wiadomości i załącznikami.
- Vite jest przygotowany na współdzielone zależności z prywatnego repo przez aliasy do publicznego `node_modules`.

### Skills created/updated
- `docs/skills/enterprise-frontend-modules.md` (created)
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/docs/skills/support-threads-frontend.md` (created)

## Step E-ST3B-SupportThreads-DeveloperActions-01
- Status: Done (approved by user)
- Enterprise commit: `d498a76`
- Description: Rozszerzenie detailu `Support Threads` o akcje developera: odpowiedź z UI, zmiana statusu i przypisanie osoby odpowiedzialnej.

### Implementation Plan
- Rozszerzyć prywatne API frontendu o listę developerów, `PATCH` wątku i `POST` odpowiedzi.
- Przebudować detail wątku na układ `conversation + action panel`.
- Dodać formularz workflow z polami `assignee` i `status`.
- Dodać formularz odpowiedzi developera z walidacją pustej wiadomości.
- Po zapisie odświeżać lokalny stan detailu bez pełnego przeładowania aplikacji.
- Zachować read-only listę i routing z poprzedniego kroku.
- Rozszerzyć testy aliasu Enterprise o scenariusz `save workflow + reply`.
- Uruchomić pełne quality gates i smoke dla stacku Enterprise.

### Files changed
- `frontend/src/pages/__tests__/SupportThreadsInbox.enterprise.test.jsx`
- `docs/PROGRESS.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/api.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/DetailPage.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/styles.css`

### Tests run
- `docker compose exec -T backend npm test` -> PASS (166/166)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm test` -> PASS (32/32)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run lint` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run build` -> PASS
- `npm test` in `/Users/piotrektomczak/dev/OpenArca-Enterprise` -> PASS (10/10)
  - ostrzeżenie React Router o future flags, bez wpływu na wynik testów
  - ostrzeżenie Vite o chunku `>500 kB`, bez regresji builda

### E2E run
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- `curl -sI http://localhost:3330/support-threads` -> PASS (`200 OK`)
- `curl -sI http://localhost:3330/support-threads/14f8fcc4-25a3-46ef-a5df-3ab0b1cd98cb` -> PASS (`200 OK`)
- frontend fallback:
  - detail otwiera się z klikalnego tytułu wątku,
  - test `SupportThreadsInbox.enterprise.test.jsx` pokrywa `save workflow + send reply`,
  - routing detailu działa pod aktywnym module Enterprise.

### Result
- Developer może wejść w detail wątku z listy przez klikalny tytuł.
- Detail ma teraz panel workflow z możliwością zmiany `statusu` i `assignee`.
- Developer może wysłać odpowiedź bezpośrednio z poziomu detailu.
- Po zapisie formularza i po odpowiedzi detail odświeża dane lokalnie i pokazuje komunikat sukcesu/błędu.
- Toolbar listy został dopracowany pod desktop: jedna linia filtrów i wyraźny odstęp od listy.

### Skills created/updated
- none

## Step E-ST5B-SupportThreads-ConvertUI-01
- Status: Done (approved by user)
- Description: Frontend developera dla konwersji `Support Thread -> Ticket`: formularz eskalacji w detailu wątku, stan po sukcesie z linkiem do ticketu oraz blokada dalszych akcji na przekonwertowanym wątku.

### Implementation Plan
- Dodać klient API dla akcji `convertSupportThreadToTicket`.
- Rozszerzyć detail developera o sekcję konwersji z formularzem brakujących pól ticketu.
- Pokazywać po sukcesie link do nowego ticketu oraz status read-only dla wątku.
- Zablokować reply i workflow edit po konwersji.
- Zachować istniejące akcje developera bez regresji dla wątków nieprzekonwertowanych.
- Dodać test frontendu dla submitu konwersji i stanu po sukcesie.
- Uruchomić pełne quality gates OpenArca oraz smoke stacku Enterprise.

### Files changed
- `frontend/src/pages/__tests__/SupportThreadsInbox.enterprise.test.jsx`
- `docs/PROGRESS.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/api.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/DetailPage.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/styles.css`

### Tests run
- `npm test --prefix /Users/piotrektomczak/dev/OpenArca-Enterprise` -> PASS (`12/12`)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (`167/167`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run lint` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm test` -> PASS (`38/38`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run build` -> PASS
  - ostrzeżenie Vite o chunku `>500 kB`, bez regresji builda

### E2E run
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Repo nadal nie zawiera Playwright/Cypress; utrzymany fallback smoke/manual baseline.

### Result
- Detail developera dla `Support Threads` ma nową sekcję `Konwertuj do zgłoszenia / Convert to ticket`.
- Developer może uzupełnić brakujące pola ticketu: kategorię, priorytet, assignee, planowaną datę, estymację oraz notatkę wewnętrzną.
- Po udanej konwersji detail przechodzi w stan read-only i pokazuje link do utworzonego ticketu.
- Po konwersji nie są już renderowane formularze reply i workflow edit, co wizualnie domyka workflow eskalacji.
- Test frontendowy sprawdza submit konwersji i oczekiwany stan po sukcesie.

### Skills created/updated
- none

## Step E-ST4-SupportThreads-UserFlow-01
- Status: Done (approved by user)
- Enterprise commit: `ea28fa1`
- Description: Pierwszy pełny user flow modułu `Support Threads`: osobne menu `Szybkie wsparcie`, lista własnych wątków, formularz nowego wątku oraz detail z odpowiedzią i załącznikiem.

### Implementation Plan
- Dodać osobny extension slot w głównym menu dla tras Enterprise widocznych zwykłemu użytkownikowi.
- Dodać publiczny guard `StandardUserRoute` dla tras user-only.
- Zarejestrować w prywatnym module trasy `/quick-support`, `/quick-support/new` i `/quick-support/:id`.
- Rozszerzyć prywatne API o create/reply z `FormData` oraz listę projektów.
- Zbudować user inbox z filtrami `q/status` i podsumowaniem statusów.
- Zbudować formularz nowego wątku z polami `title`, `content`, `project`, `priority`, `attachment`.
- Zbudować detail usera z historią wiadomości, odpowiedzią i attachmentem oraz reopen po nowej wiadomości.
- Dodać testy publicznego frontendu dla menu, guardów, listy usera, create flow i reply flow.

### Files changed
- `frontend/src/components/StandardUserRoute.jsx`
- `frontend/src/enterprise/extensions.stub.jsx`
- `frontend/src/App.jsx`
- `frontend/src/components/AppShell.jsx`
- `frontend/src/components/__tests__/AppShell.test.jsx`
- `frontend/src/components/__tests__/routes.test.jsx`
- `frontend/src/pages/__tests__/SupportThreadsInbox.enterprise.test.jsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `docs/PROGRESS.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/extensions/index.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/api.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/UserInboxPage.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/UserNewPage.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/UserDetailPage.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/styles.css`

### Tests run
- `npm test` in `/Users/piotrektomczak/dev/OpenArca-Enterprise` -> PASS (10/10)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run lint` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm test` -> PASS (37/37)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run build` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- backend test `166/166` pozostaje zielony z poprzedniego kroku i nie został naruszony przez ten zakres frontendowy
  - ostrzeżenia React Router o future flags, bez wpływu na wynik testów
  - ostrzeżenie Vite o chunku `>500 kB`, bez regresji builda

### E2E run
- `curl -sI http://localhost:3330/quick-support` -> PASS (`200 OK`)
- `curl -sI http://localhost:3330/quick-support/new` -> PASS (`200 OK`)
- frontend test coverage obejmuje:
  - render user inbox,
  - filtrowanie statusu,
  - create flow `new -> detail`,
  - reply flow w detailu usera,
  - menu i guard `StandardUserRoute`.

### Result
- Zwykły użytkownik widzi w sidebarze pozycję `Szybkie wsparcie` tylko przy aktywnym capability `enterprise_support_threads`.
- Powstały osobne trasy user-only:
  - `/quick-support`
  - `/quick-support/new`
  - `/quick-support/:id`
- User może utworzyć nowy wątek z projektem, priorytetem i opcjonalnym załącznikiem.
- User widzi własną listę wątków, może filtrować ją po statusie i szybko przejść do detailu.
- Detail działa w formie chatu i pozwala dodać kolejną wiadomość z opcjonalnym attachmentem.
- Developer inbox `Support Threads` oraz jego detail pozostały bez regresji.

### Skills created/updated
- none

## Step OPEN-O1-SavedViews-MyTickets-01
- Status: Done (approved by user)
- Description: Saved views i szybkie presety filtrów dla `My Tickets` jako pierwszy etap odświeżenia Open Core UX.

### Implementation Plan
- Dodać lokalny model filtrów i saved views dla `My Tickets`.
- Dodać szybkie presety: `My critical`, `Waiting`, `Blocked`, `This week`.
- Rozszerzyć sam widok o filtr priorytetu, potrzebny dla presetów i zapisanych widoków.
- Zapisywać aktywne filtry oraz listę widoków w `localStorage`.
- Dodać UX: wybór widoku, zapis aktualnego widoku, usuwanie widoku, reset filtrów.
- Wydzielić helper `savedViews` pod kolejne kroki dla `Board` i `DevTodo`.
- Dodać test frontendowy dla presetów i zapisu/przywracania widoku.
- Dodać skill opisujący wzorzec `saved views`.

### Files changed
- `frontend/src/pages/MyTickets.jsx`
- `frontend/src/utils/savedViews.js`
- `frontend/src/pages/__tests__/MyTickets.savedViews.test.jsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `frontend/src/styles.css`
- `docs/AGENTS.md`
- `docs/skills/saved-views-and-filter-presets.md`
- `docs/PROGRESS.md`

### Tests run
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose up --build -d` -> PASS
  - backend uruchomiony na `4000`,
  - frontend uruchomiony na `3330`,
  - mailpit uruchomiony lokalnie na `1026/8026`.
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (158/158)
- `docker compose exec -T frontend npm run lint` -> PASS
- `docker compose exec -T frontend npm test` -> PASS (19/19)
- `docker compose exec -T frontend npm run build` -> PASS

### E2E run
- `docker compose ps` -> PASS dla `backend`, `frontend`, `mailpit`
- `curl -s http://localhost:4000/health` -> PASS
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- `docker compose exec -T frontend node -e "fetch('http://127.0.0.1:3330')..."` -> PASS
- Host `curl` na `3330` był ograniczony przez sandbox CLI, więc dostępność frontendu potwierdzono przez logi Vite i fetch z wnętrza kontenera.

### Result
- `My Tickets` ma szybkie presety filtrów do codziennej pracy.
- Użytkownik może zapisać własny widok filtrów lokalnie i przywrócić go po resecie lub odświeżeniu strony.
- Dodany został filtr priorytetu, potrzebny do presetów i saved views.
- Logika saved views została wydzielona do reużywalnego helpera pod kolejne kroki dla `Board` i `DevTodo`.

### Skills created/updated
- `docs/skills/saved-views-and-filter-presets.md` (created)

## Step RC2-Docs-Cleanup-01
- Status: Done
- Description: Synchronizacja dokumentów statusowych po zamknięciu Open RC2, tak aby backlog Open, roadmapa strategiczna i checklisty release nie wprowadzały w błąd.

### Files changed
- `docs/OPENARCA_RC2_TODO.md`
- `docs/fonder-road.md`
- `docs/release-checklist.md`
- `docs/PROGRESS.md`

### Tests run
- Nie uruchamiano quality gates, ponieważ zakres obejmuje wyłącznie porządkowanie dokumentacji i nie zmienia kodu aplikacji.

### E2E run
- Nie dotyczy (brak zmian runtime/UI/API).

### Result
- `docs/OPENARCA_RC2_TODO.md` przestał udawać aktywne TODO i stał się dokumentem closeout + future open backlog.
- `docs/fonder-road.md` został przestawiony z planu wykonawczego RC1/RC2 na roadmapę strategiczną po zamknięciu Open RC2.
- `docs/release-checklist.md` używa aktualnej nazwy produktu `OpenArca`.

### Skills created/updated
- none

## Step RC2-Projects-UX-Color-Reset-01
- Status: Done (approved by user)
- Commit: `19d7376`
- Description: Poprawa UX wyboru koloru projektu (czytelny picker + wartość HEX) oraz reset koloru do wartości domyślnej.

### Files changed
- `frontend/src/pages/Admin.jsx`
- `frontend/src/styles.css`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `docs/PROGRESS.md`

### Tests run
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (158/158)
- `docker compose exec -T frontend npm test` -> PASS (17/17)
- `docker compose exec -T frontend npm run build` -> PASS

### E2E run
- Stack działa poprawnie (backend/frontend uruchomione w compose).
- Zastosowano smoke fallback zgodny z procesem (brak Playwright/Cypress w repo).

### Skills created/updated
- none

## Step RC2-Projects-Visibility-01
- Status: Done (approved by user)
- Commit: `5897800`
- Description: Widoczność projektu we wszystkich kluczowych widokach + osobne filtry projektu w TODO + ustawienia projektu w popupie z uploadem ikony.

### Implementation Plan
- Rozszerzyć model projektu o ikonę (`icon_filename`, `icon_updated_at`) z migracją.
- Dodać endpointy upload/get/delete ikony projektu z walidacją MIME i cleanup plików.
- Propagować `project_icon_url` do payloadów ticketów (`list`, `detail`, `board`).
- Dodać wspólny komponent `ProjectBadge` z domyślną ikoną.
- Wyświetlić badge projektu w `TicketDetail`, `Board`, `DevTodo`, `MyTickets`.
- Rozdzielić filtry projektu w `DevTodo` na listę TODO i kolejkę.
- Przebudować zakładkę projektów w Admin na listę + popup ustawień.
- Dodać testy backend RBAC/integracyjne i test komponentu frontend.

### Files changed
- `backend/db.js`
- `backend/routes/projects.js`
- `backend/services/tickets.js`
- `backend/tests/api.integration.test.js`
- `backend/tests/rbac.ownership.audit.integration.test.js`
- `backend/tests/tickets.service.unit.test.js`
- `backend/tests/outbox.worker.service.unit.test.js`
- `frontend/src/api/projects.js`
- `frontend/src/assets/project-default.svg`
- `frontend/src/components/ProjectBadge.jsx`
- `frontend/src/components/__tests__/ProjectBadge.test.jsx`
- `frontend/src/pages/Admin.jsx`
- `frontend/src/pages/Board.jsx`
- `frontend/src/pages/DevTodo.jsx`
- `frontend/src/pages/MyTickets.jsx`
- `frontend/src/pages/TicketDetail.jsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `frontend/src/styles.css`
- `docs/AGENTS.md`
- `docs/skills/project-badges-and-icons.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend npm run lint` -> PASS
- `docker compose exec -T frontend npm test` -> PASS (17/17)
- `docker compose exec -T backend npm test` -> PASS (158/158)
- `docker compose exec -T frontend npm run build` -> PASS

### E2E run
- Stack smoke:
  - `docker compose ps` -> PASS (backend/frontend/mailpit healthy)
  - `curl -s http://localhost:4000/health` -> PASS (`status=ok`)
  - route checks: `/`, `/login`, `/new-ticket`, `/my-tickets`, `/board`, `/dev-todo`, `/admin` -> PASS (200)
- Browser flow fallback (repo bez Playwright/Cypress):
  - `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
  - obejmuje: OTP login user, create ticket, ticket detail, OTP login developer, status update + comment.

### Risks / follow-ups
- Brak automatycznego testu Playwright/Cypress dla nowego UI popupu projektu; potrzebna ręczna walidacja UX.
- Zmiana w `backend/tests/outbox.worker.service.unit.test.js` stabilizuje istniejący test czasu (`updatedAt` ustawiony deterministycznie).

### Skills created/updated
- `docs/skills/project-badges-and-icons.md` (created)

## Step RC2-01
- Status: Done (approved by user)
- Commit: `e6a9c57`
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
- Commit: `08bdcf8`
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

## Step RC2-README-02
- Status: Done (approved by user)
- Commit: `20c5822`
- Description: Szybkie poprawki pozycjonowania OSS w `README.md` (badge, hook, core idea, target persona, HTTPS clone).

### Implementation Plan
- Dodać 2 badge (`License`, `Status`) na górze README.
- Zmienić zdanie otwierające zgodnie z nowym pozycjonowaniem.
- Dodać hook pozycjonujący „between support desks and developer workflows”.
- Dodać sekcję `The core idea` pomiędzy `Why` i `What it is / isn't`.
- Dodać sekcję `Who OpenArca is for`.
- Zmienić `git clone` z SSH na HTTPS (EN/PL).
- Zachować spójność wersji PL (odpowiedniki nowych sekcji).
- Uruchomić quality gates i smoke.

### Files changed
- `README.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (157/157)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Uwaga: repo nadal nie ma Playwright/Cypress; utrzymany fallback smoke zgodnie z dotychczasowym procesem.

### Result
- Dodano 2 badge na górze README (`AGPL-3.0`, `early open release`).
- Zmieniono pierwsze zdanie otwarcia README.
- Dodano jednozdaniowy hook pozycjonujący produkt.
- Dodano sekcję `The core idea` (EN) i `Kluczowa idea` (PL).
- Dodano sekcję `Who OpenArca is for` (EN) i `Dla kogo jest OpenArca` (PL).
- Zmieniono Quickstart clone na HTTPS w sekcji EN i PL.
- Zaktualizowano numerację sekcji po obu wersjach językowych.

### Skills created/updated
- Brak zmian w skills.

## Step RC2-CONTRIBUTING-01
- Status: Done (approved by user)
- Commit: `f635b9c`
- Description: Przebudowa `CONTRIBUTING.md` do wersji publicznej OpenArca (EN + PL), z realnym workflow, quality gates i baseline bezpieczeństwa.

### Implementation Plan
- Przepisać `CONTRIBUTING.md` do formatu dwujęzycznego (EN/PL) w jednym pliku.
- Zaktualizować nazwę projektu do OpenArca i scope Open Core.
- Dodać jasne zasady bezpieczeństwa (RBAC/ownership/walidacja/limity).
- Dodać szybki start kontrybutora oparty o Docker Compose.
- Dodać wymagane quality gates zgodne z istniejącymi skryptami repo.
- Dodać baseline E2E browser flow (manual smoke fallback).
- Ujednolicić standard commitów i checklistę PR.
- Zweryfikować pełnym zestawem testów i smoke.

### Files changed
- `CONTRIBUTING.md`
- `docs/PROGRESS.md`

### Tests run
- `docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T frontend yarn lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (157/157)
- `docker compose exec -T frontend yarn test` -> PASS (15/15)
- `docker compose exec -T frontend yarn build` -> PASS

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Repo nadal nie zawiera Playwright/Cypress, więc utrzymany fallback smoke/manual baseline.

### Result
- `CONTRIBUTING.md` ma teraz sekcje EN + PL z language switch.
- Usunięto starą nazwę projektu i zaktualizowano dokument pod OpenArca.
- Dodano jasny onboarding kontrybutora (Docker quickstart + URL-e usług).
- Dodano wymagane quality gates dokładnie na komendach obecnych w repo.
- Dodano bazowy flow E2E (manual smoke fallback) oraz zasady architektoniczne Open Core.
- Uporządkowano standard commitów i checklistę PR.

### Skills created/updated
- Brak zmian w skills.

## Step RC2-CLOSEOUT-01
- Status: Done (approved by user)
- Commit: `e0ac513`
- Description: Formalne zamknięcie Open RC2 po publikacji OpenArca Docs i finalnych linkach README.

### Scope
- Potwierdzić domknięcie etapów P5/P5.5/P6 w praktyce release RC2.
- Uzupełnić README o publiczne linki produktu i dokumentacji.
- Potwierdzić gotowość Open Core do publikacji z oddzielonym torem Enterprise.

### Result
- P5 (stabilizacja + telemetry), P5.5 (product gravity) i P6 (A/B/C) zostały zamknięte i zaakceptowane.
- README zawiera oficjalne linki:
  - `https://openarca.com`
  - `https://docs.openarca.com/docs/overview`
  - `https://docs.openarca.com/pl/docs/overview`
- Open Core został domknięty jako RC2 z gotową dokumentacją i publicznym repo docs.

### Skills created/updated
- Brak zmian w skills.

## Step OPEN-O2-SavedViews-Board-01
- Status: Done (approved by user)
- Description: Dodanie `saved views` i szybkich presetów do widoku `Board / Kanban`, z lokalną persystencją filtrów bez zmian backendu.

### Implementation Plan
- Dodać lokalny stan filtrów i zapisanych widoków dla `Board`.
- Wprowadzić szybkie presety dopasowane do Kanban: `Critical`, `Waiting`, `Blocked`, `This week`.
- Zapisywać i przywracać kombinacje filtrów `project/category/priority` oraz zakresów presetów.
- Dodać UI: zapis, wybór, usuwanie i reset widoków.
- Nie zmieniać logiki DnD ani popupu edycji zgłoszenia.
- Dodać pojedynczy test frontendu dla presetów i persystencji.
- Zaktualizować skill i playbook agenta do faktycznych komend repo.
- Uruchomić pełne quality gates oraz smoke.

### Files changed
- `frontend/src/pages/Board.jsx`
- `frontend/src/pages/__tests__/Board.savedViews.test.jsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `docs/skills/saved-views-and-filter-presets.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (`158/158`)
- `docker compose exec -T frontend npm run lint` -> PASS
- `docker compose exec -T frontend npm test` -> PASS (`21/21`)
- `docker compose exec -T frontend npm run build` -> PASS
- `curl -sI http://localhost:3330/` -> PASS (`200 OK`)

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Repo nadal nie zawiera Playwright/Cypress; utrzymany fallback smoke/manual baseline.

### Result
- `Board` zapamiętuje aktywne filtry po odświeżeniu strony.
- Dodano szybkie presety dla Kanban: `Critical`, `Waiting`, `Blocked`, `This week`.
- Użytkownik może zapisać własny widok, ponownie go wybrać, usunąć i zresetować filtry.
- Preset `This week` działa na `planned_date`, bez rozbudowy formularza o dodatkowy filtr.
- Zmiana nie narusza DnD ani popupu podglądu/edycji zgłoszenia.
- `docs/AGENTS.md` został zsynchronizowany z faktycznymi komendami `npm` używanymi w repo.

### Skills created/updated
- `docs/skills/saved-views-and-filter-presets.md` (updated)

## Step OPEN-O3-SavedViews-DevTodo-01
- Status: Done (approved by user)
- Description: Dodanie `saved views` do `DevTodo`, wraz z filtrem statusu ticketu dla listy aktywnej i kolejki zaakceptowanych.

### Implementation Plan
- Dodać lokalny stan zapisanych widoków dla `DevTodo`.
- Objąć nim filtry aktywnych zadań i kolejki zaakceptowanych.
- Dodać brakujący filtr statusu ticketu, aby obsłużyć presety `Waiting` i `Blocked`.
- Przygotować szybkie presety deweloperskie bez ruszania sekcji `Do weryfikacji`.
- Zachować obecny workflow zadań, claim/accept oraz modale.
- Dodać test frontendu dla presetów i przywracania zapisanego widoku.
- Zweryfikować krok pełnym pakietem lint/test/build/smoke.
- Zaktualizować skill z nowym pokryciem widoków.

### Files changed
- `frontend/src/pages/DevTodo.jsx`
- `frontend/src/pages/__tests__/DevTodo.savedViews.test.jsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `docs/skills/saved-views-and-filter-presets.md`
- `docs/PROGRESS.md`

### Tests run
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (`158/158`)
- `docker compose exec -T frontend npm run lint` -> PASS
- `docker compose exec -T frontend npm test` -> PASS (`23/23`)
- `docker compose exec -T frontend npm run build` -> PASS
- `curl -sI http://localhost:3330/` -> PASS (`200 OK`)

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Repo nadal nie zawiera Playwright/Cypress; utrzymany fallback smoke/manual baseline.

### Result
- `DevTodo` zapamiętuje aktywne filtry po odświeżeniu strony.
- Dodano szybkie presety: `Critical`, `In progress`, `Waiting`, `Blocked`.
- Dodano zapis, wybór, usuwanie i reset zapisanych widoków bez backendu.
- Dodano nowy filtr `statusu zgłoszenia`, działający dla aktywnych zadań i kolejki zaakceptowanych.
- Sekcja `Do weryfikacji` pozostaje poza zakresem filtrów, zgodnie z dotychczasowym flow produktu.
- Reorder aktywnych zadań jest blokowany, gdy aktywna lista jest przefiltrowana, aby nie zapisywać kolejności dla podzbioru.
- Toolbar filtry w `DevTodo` dostały etykiety dostępności (`aria-label`).

### Skills created/updated
- `docs/skills/saved-views-and-filter-presets.md` (updated)

## Step OPEN-O4A-TicketTemplates-01
- Status: Done (approved by user)
- Description: Backendowy fundament dla `ticket templates`: migracja SQLite, API CRUD, RBAC, fallback globalny/projektowy i testy integracyjne.

### Implementation Plan
- Dodać tabelę `ticket_templates` i migrację w `backend/db.js`.
- Zdefiniować kontrakt templatek: nazwa, projekt/global, kategoria, ważność, tytuł, opis, checklista, aktywność.
- Dodać router z endpointami listy, szczegółu, tworzenia, edycji i usuwania.
- Utrzymać RBAC: odczyt dla zalogowanego użytkownika, zapis tylko dla developera.
- Dodać filtrowanie po `project_id` z fallbackiem projektowym + globalnym.
- Zweryfikować walidację brakującego projektu.
- Dodać testy integracyjne CRUD/RBAC/listowania.
- Udokumentować wzorzec jako skill backendowy.

### Files changed
- `backend/db.js`
- `backend/routes/ticketTemplates.js`
- `backend/app.js`
- `backend/tests/api.integration.test.js`
- `docs/skills/ticket-templates-backend.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (`161/161`)
- `docker compose exec -T frontend npm run lint` -> PASS
- `docker compose exec -T frontend npm test` -> PASS (`23/23`)
- `docker compose exec -T frontend npm run build` -> PASS
- `curl -sI http://localhost:3330/` -> PASS (`200 OK`)

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Repo nadal nie zawiera Playwright/Cypress; utrzymany fallback smoke/manual baseline.

### Result
- Dodano tabelę `ticket_templates` do SQLite wraz z migracją dla istniejących baz.
- Dodano endpointy:
  - `GET /api/ticket-templates`
  - `GET /api/ticket-templates/:id`
  - `POST /api/ticket-templates`
  - `PATCH /api/ticket-templates/:id`
  - `DELETE /api/ticket-templates/:id`
- `GET ?project_id=...` zwraca najpierw template projektowe, potem globalne.
- Zwykły użytkownik widzi tylko aktywne template; developer może pobrać także nieaktywne przez `include_inactive=1`.
- Walidacja odrzuca nieistniejący `project_id`.
- Checklista jest przechowywana jako JSON i mapowana do `checklist_items` w API.

### Skills created/updated
- `docs/skills/ticket-templates-backend.md` (new)

## Step OPEN-O4B-TicketTemplatesAdmin-01
- Status: Done (approved by user)
- Description: Panel admina dla `ticket templates` w zakładce `Projects`: lista presetów, modal create/edit oraz usuwanie bez zmian istniejącego workflow projektów.

### Implementation Plan
- Dodać frontendowy klient API dla `ticket templates`.
- Rozszerzyć `Admin.jsx` o stan, ładowanie i sortowanie templatek.
- Osadzić sekcję templatek w zakładce `Projects`, bez rozbijania obecnego układu panelu.
- Pokazać listę presetów z rozróżnieniem `global/project`, `active/inactive`, kategoria i priorytet.
- Dodać modal create/edit z checklistą wpisywaną liniami.
- Dodać bezpieczne usuwanie templatek z odświeżeniem lokalnego stanu.
- Pokryć UI testem frontendu dla create flow.
- Zweryfikować krok pełnym pakietem lint/test/build/smoke.

### Files changed
- `frontend/src/api/ticketTemplates.js`
- `frontend/src/pages/Admin.jsx`
- `frontend/src/pages/__tests__/Admin.ticketTemplates.test.jsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `frontend/src/styles.css`
- `docs/PROGRESS.md`

### Tests run
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (`161/161`)
- `docker compose exec -T frontend npm run lint` -> PASS
- `docker compose exec -T frontend npm test` -> PASS (`24/24`)
- `docker compose exec -T frontend npm run build` -> PASS
- `curl -sI http://localhost:3330/` -> PASS (`200 OK`)

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Repo nadal nie zawiera Playwright/Cypress; utrzymany fallback smoke/manual baseline.

### Result
- Zakładka `Projects` w panelu admina pokazuje teraz sekcję `ticket templates`.
- Developer może utworzyć nowy preset jako globalny albo przypisany do projektu.
- Dla każdego presetu widoczne są badge: projekt/global, kategoria, priorytet i status aktywności.
- Modal create/edit obsługuje nazwę, projekt, kategorię, priorytet zgłaszającego, aktywność, tytuł, opis i checklistę.
- Checklista jest wpisywana jako tekst linia-po-linii i normalizowana do `checklist_items`.
- Usunięcie presetu aktualizuje listę lokalnie bez przeładowania całego panelu.
- Istniejący workflow ustawień aplikacji, SMTP/SES, projektów i użytkowników pozostaje bez zmian.

### Skills created/updated
- `docs/skills/ticket-templates-backend.md` (referenced, no change)

## Step OPEN-O4C-TicketTemplatesIntake-01
- Status: Done (approved by user)
- Description: Podłączenie aktywnych `ticket templates` do formularza `New Ticket`, z fallbackiem `project -> global`, prefillem pól bazowych i checklistą w opisie.

### Implementation Plan
- Przejrzeć formularz `New Ticket` i osadzić selector templatek w kroku podstawowym.
- Pobierać aktywne template z fallbackiem projektowym opartym o backend O4A.
- Dla braku projektu pokazywać wyłącznie template globalne.
- Po wyborze template uzupełniać `title`, `description`, `category` i `urgency_reporter`.
- Checklistę templateki dopisywać do `description` jako blok tekstu.
- Czyścić pola specyficzne dla kategorii, których template nie uzupełnia.
- Dodać test frontendu dla fallbacku i prefilla.
- Zweryfikować krok pełnym pakietem lint/test/build/smoke.

### Files changed
- `frontend/src/pages/Admin.jsx`
- `frontend/src/pages/__tests__/Admin.ticketTemplates.test.jsx`
- `frontend/src/pages/NewTicket.jsx`
- `frontend/src/pages/__tests__/NewTicket.templates.test.jsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `docs/skills/ticket-templates-intake-prefill.md`
- `docs/AGENTS.md`
- `docs/PROGRESS.md`

### Tests run
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose up --build -d` -> PASS
- `docker compose ps` -> PASS
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (`161/161`)
- `docker compose exec -T frontend npm run lint` -> PASS
- `docker compose exec -T frontend npm test` -> PASS (`26/26`)
- `docker compose exec -T frontend npm run build` -> PASS
- `curl -sI http://localhost:3330/` -> PASS (`200 OK`)

### E2E run
- `docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Repo nadal nie zawiera Playwright/Cypress; utrzymany fallback smoke/manual baseline.

### Result
- Formularz `New Ticket` pokazuje selector `Szablon zgłoszenia / Ticket template`.
- Bez wybranego projektu widoczne są tylko template globalne.
- Po wyborze projektu formularz pobiera template projektowe z fallbackiem globalnym.
- Wybór template uzupełnia pola bazowe: tytuł, opis, kategorię i ważność zgłaszającego.
- Checklista jest dopisywana do opisu jako czytelny blok tekstu.
- Pola specyficzne dla kategorii są resetowane przy zmianie template, żeby nie zostawiać ukrytych, niespójnych wartości.
- Dodano jawne `aria-label` dla kluczowych pól formularza (`template`, `title`, `description`, `urgency`), co poprawia dostępność i testowalność.
- Panel admina templatek dostał lokalną walidację i błędy per pole, dzięki czemu zapis nie kończy się już ślepym komunikatem `validation_error`.

### Skills created/updated
- `docs/skills/ticket-templates-intake-prefill.md` (new)

## Step E-ST5A-SupportThreads-ConvertBackend-01
- Status: Done (approved by user)
- Description: Backendowa konwersja `Support Thread -> Ticket` w Enterprise, z kopiowaniem historii wiadomości i załączników do pełnego zgłoszenia.

### Implementation Plan
- Rozszerzyć model `tickets` o backlink do źródłowego `support_thread`.
- Udostępnić w OpenArca realny `ticketService` dla modułów Enterprise zamiast pustego stubu.
- Dodać w repo Enterprise operację `convertThreadToTicket`.
- Tworzyć ticket z reporterem requestera i aktorem będącym developerem konwertującym wątek.
- Przepisać wiadomości wątku do `comments` ticketu i załączniki do `attachments`.
- Zamknąć wątek po konwersji i zapisać `converted_ticket_id`.
- Zablokować kolejne wiadomości i ponowną konwersję po eskalacji.
- Pokryć całość testami unitowymi/integracyjnymi i zweryfikować na świeżym stacku po `up --build`.

### Files changed
- `backend/db.js`
- `backend/services/tickets.js`
- `backend/core/services/ticketService.js`
- `backend/tests/extension.registry.unit.test.js`
- `backend/tests/tickets.service.unit.test.js`
- `docs/PROGRESS.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/support-threads/service.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/backend/extensions/routes.js`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/tests/support-threads.service.test.js`

### Tests run
- `npm test --prefix /Users/piotrektomczak/dev/OpenArca-Enterprise` -> PASS (`12/12`)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (`167/167`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run lint` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm test` -> PASS (`37/37`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run build` -> PASS
  - ostrzeżenie Vite o chunku `>500 kB`, bez regresji builda

### E2E run
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml up --build -d` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml ps` -> PASS
- `curl -sI http://localhost:3330` -> PASS (`200 OK`)
- `curl -sI http://localhost:4000/health` -> PASS (`200 OK`)
- `curl -sI http://localhost:8026` -> PASS (`405 Method Not Allowed`, endpoint reachable)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Repo nadal nie zawiera Playwright/Cypress; utrzymany fallback smoke/manual baseline.

### Result
- Publiczny backend OpenArca przekazuje modułom Enterprise rzeczywisty `ticketService`, dzięki czemu prywatne moduły mogą bezpiecznie tworzyć i aktualizować pełne zgłoszenia bez duplikowania logiki ticketów.
- `tickets` mają nowe pole `source_support_thread_id`, które pozwala śledzić pochodzenie zgłoszenia z lekkiego wątku supportowego.
- Repo Enterprise ma nową operację `convertThreadToTicket`, która:
  - tworzy ticket na requestera wątku,
  - ustawia developera konwertującego jako aktora,
  - zamyka wątek i zapisuje `converted_ticket_id`,
  - kopiuje wiadomości jako komentarze ticketu,
  - kopiuje załączniki do ticketu.
- Po konwersji nie da się ponownie konwertować tego samego wątku ani dopisywać do niego nowych wiadomości.
- Endpoint `POST /api/enterprise/support-threads/:id/convert` jest gotowy pod kolejny krok UI.

### Skills created/updated
- none

## Step E-ST5C-SupportThreads-Backlinks-01
- Status: Done (approved by user)
- Description: Domknięcie backlinków po eskalacji `Support Thread -> Ticket`: link w `TicketDetail` do źródłowego wątku oraz read-only state z linkiem do ticketu w detailu użytkownika `Quick Support`.

### Implementation Plan
- Dodać brakujące tłumaczenia publicznego `TicketDetail` dla linku do źródłowego wątku supportowego.
- Dodać test publicznego `TicketDetail` sprawdzający render linku do `/support-threads/:id`.
- Rozszerzyć detail użytkownika w repo Enterprise o read-only stan po konwersji i link do nowego ticketu.
- Ukryć formularz odpowiedzi użytkownika po eskalacji, aby zachować spójność z blokadami backendu.
- Rozszerzyć istniejący test Enterprise o scenariusz przekonwertowanego wątku użytkownika.
- Uruchomić pełne quality gates OpenArca i testy modułu Enterprise.
- Zweryfikować live flow `ticket -> support thread -> linked ticket`.

### Files changed
- `frontend/src/pages/TicketDetail.jsx`
- `frontend/src/styles.css`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `frontend/src/pages/__tests__/TicketDetail.supportThreadLink.test.jsx`
- `frontend/src/pages/__tests__/SupportThreadsInbox.enterprise.test.jsx`
- `docs/PROGRESS.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/UserDetailPage.jsx`

### Tests run
- `npm test --prefix /Users/piotrektomczak/dev/OpenArca-Enterprise` -> PASS (`12/12`)
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (`167/167`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run lint` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm test` -> PASS (`40/40`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run build` -> PASS
  - ostrzeżenie Vite o chunku `>500 kB`, bez regresji builda

### E2E run
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml up --build -d` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml ps` -> PASS
- `curl -sI http://localhost:3330` -> PASS (`200 OK`)
- `curl -sI http://localhost:4000/health` -> PASS (`200 OK`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Repo nadal nie zawiera Playwright/Cypress; utrzymany fallback smoke/manual baseline.

### Result
- `TicketDetail` pokazuje teraz jawny link do źródłowego wątku supportowego, jeśli zgłoszenie powstało z eskalacji `Support Thread -> Ticket`.
- Publiczny frontend ma test zabezpieczający render tego backlinku i trasę `/support-threads/:id`.
- Detail użytkownika `Quick Support` rozpoznaje przekonwertowany wątek i przechodzi w stan tylko do odczytu.
- Użytkownik widzi link do pełnego zgłoszenia i nie może już wysyłać kolejnych wiadomości do przekonwertowanego wątku.
- Linkowanie działa teraz w obu kierunkach: `thread -> ticket` oraz `ticket -> source thread`.

### Skills created/updated
- none

## Step E-ST6A-SupportThreads-OriginSurfacing-01
- Status: Done (approved by user)
- Description: Ujednolicenie linków do `Support Threads` względem roli użytkownika oraz pokazanie pochodzenia `Quick Support` w głównych widokach ticketów (`My Tickets`, `Board`, `DevTodo`).

### Implementation Plan
- Uzupełnić payloady ticketów w backendzie o `source_support_thread_id` tam, gdzie brakuje go w listach i boardzie.
- Dodać współdzielony komponent badge dla pochodzenia `Quick Support`.
- Naprawić `TicketDetail`, aby link do źródłowego wątku był zależny od roli (`/quick-support` dla usera, `/support-threads` dla developera).
- Pokazać badge pochodzenia na listach `My Tickets`, `Board` i `DevTodo` bez naruszania istniejącego flow DnD i preview.
- Dodać testy backendu dla nowych pól w payloadach.
- Dodać testy frontendu dla badge i linków zależnych od roli.
- Uruchomić pełne quality gates oraz smoke flow po zmianach.

### Files changed
- `backend/services/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
- `frontend/src/components/SupportThreadOriginBadge.jsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `frontend/src/pages/TicketDetail.jsx`
- `frontend/src/pages/MyTickets.jsx`
- `frontend/src/pages/Board.jsx`
- `frontend/src/pages/DevTodo.jsx`
- `frontend/src/pages/__tests__/TicketDetail.supportThreadLink.test.jsx`
- `frontend/src/pages/__tests__/MyTickets.savedViews.test.jsx`
- `frontend/src/pages/__tests__/Board.savedViews.test.jsx`
- `frontend/src/pages/__tests__/DevTodo.savedViews.test.jsx`
- `frontend/src/styles.css`
- `docs/PROGRESS.md`

### Tests run
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (`168/168`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run lint` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm test` -> PASS (`41/41`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run build` -> PASS
  - ostrzeżenie Vite o chunku `>500 kB`, bez regresji builda

### E2E run
- `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml up --build -d` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml ps` -> PASS
- `curl -sI http://localhost:3330` -> PASS (`200 OK`)
- `curl -sI http://localhost:4000/health` -> PASS (`200 OK`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Repo nadal nie zawiera Playwright/Cypress; utrzymany fallback smoke/manual baseline.

### Result
- Główne payloady ticketów (`list`, `board`, `workload`) przenoszą teraz `source_support_thread_id`, więc publiczny frontend może rozpoznać zgłoszenia pochodzące z `Quick Support`.
- `TicketDetail` nie linkuje już w ciemno do `/support-threads/:id`; ścieżka jest dobierana poprawnie do roli użytkownika.
- `My Tickets`, `Board` i `DevTodo` pokazują badge `Szybkie wsparcie / Quick Support` dla ticketów pochodzących z lekkich wątków supportowych.
- Preview ticketu na boardzie i detail tasku w `DevTodo` pokazują już spójne linki do źródłowego wątku.
- Testy zabezpieczają zarówno payload backendu, jak i zachowanie UI zależne od roli użytkownika.

### Skills created/updated
- none

## Step E-ST6B-SupportThreads-OriginFilters-01
- Status: Done (approved by user)
- Description: Dodanie filtrowania ticketów po pochodzeniu `Quick Support` w `My Tickets`, `Board` i `DevTodo`, razem z szybkim presetem i persystencją w zapisanych widokach.

### Implementation Plan
- Dodać wspólny helper do rozpoznawania pochodzenia `support_thread` vs standardowy ticket.
- Rozszerzyć domyślne filtry i saved views w `My Tickets`, `Board` i `DevTodo` o pole `origin`.
- Dodać preset `Szybkie wsparcie / Quick Support` w trzech widokach.
- Dodać select `Pochodzenie / Origin` do formularzy filtrów bez naruszania obecnego UX.
- Upewnić się, że `DevTodo` nie filtruje sekcji `Do weryfikacji` nowym polem.
- Zablokować reorder aktywnej listy `DevTodo`, gdy filtr pochodzenia jest aktywny.
- Dodać testy frontendu dla presetów i przywracania zapisanych widoków z filtrem `origin`.
- Uruchomić pełne quality gates oraz smoke flow.

### Files changed
- `frontend/src/components/SupportThreadOriginBadge.jsx`
- `frontend/src/pages/MyTickets.jsx`
- `frontend/src/pages/Board.jsx`
- `frontend/src/pages/DevTodo.jsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
- `frontend/src/pages/__tests__/MyTickets.savedViews.test.jsx`
- `frontend/src/pages/__tests__/Board.savedViews.test.jsx`
- `frontend/src/pages/__tests__/DevTodo.savedViews.test.jsx`
- `docs/PROGRESS.md`

### Tests run
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (`168/168`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run lint` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm test` -> PASS (`44/44`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run build` -> PASS
  - ostrzeżenie Vite o chunku `>500 kB`, bez regresji builda

### E2E run
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml ps` -> PASS
- `curl -sI http://localhost:3330` -> PASS (`200 OK`)
- `curl -sI http://localhost:4000/health` -> PASS (`200 OK`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Repo nadal nie zawiera Playwright/Cypress; utrzymany fallback smoke/manual baseline.

### Result
- `My Tickets`, `Board` i `DevTodo` mają nowy filtr `Pochodzenie / Origin`, który rozróżnia zgłoszenia pochodzące z `Quick Support` od zwykłych ticketów.
- Każdy z tych ekranów ma szybki preset `Szybkie wsparcie / Quick Support` i poprawnie zapisuje ten stan w `saved views`.
- `DevTodo` filtruje pochodzenie tylko na aktywnej liście i kolejce, bez naruszania sekcji `Do weryfikacji`.
- Aktywna lista `DevTodo` blokuje reorder także wtedy, gdy aktywny jest filtr pochodzenia, co utrzymuje spójność UX z wcześniejszym kontraktem.
- Helper pochodzenia jest współdzielony z istniejącym badge, więc UI opiera się na jednej definicji źródła ticketu.

### Skills created/updated
- none

## Step E-ST6C-SupportThreads-UIPolish-01
- Status: Done (approved by user)
- Enterprise Commit: `0663df9`
- Description: Ostatni polish UI modułu `Support Threads` przed domknięciem tematu: mocniejsze oznaczenie przekonwertowanych wątków, projektów i bezpośrednich przejść do ticketu oraz czytelniejsze rozróżnienie wiadomości user/support.

### Implementation Plan
- Dodać badge i link do ticketu już na listach inboxu developera i użytkownika dla przekonwertowanych wątków.
- Pokazać projekt w wierszu wątku bez wchodzenia w detail.
- W detailu dodać mocniejszy banner stanu po konwersji.
- Rozróżnić wizualnie wiadomości requestera i supportu w widoku chatu.
- Rozszerzyć testy Enterprise o nowy kontrakt UI listy i detailu.
- Uruchomić pełne quality gates frontendu i smoke stacku Enterprise.

### Files changed
- `frontend/src/pages/__tests__/SupportThreadsInbox.enterprise.test.jsx`
- `docs/PROGRESS.md`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/InboxPage.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/UserInboxPage.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/DetailPage.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/UserDetailPage.jsx`
- `/Users/piotrektomczak/dev/OpenArca-Enterprise/frontend/support-threads/styles.css`

### Tests run
- `docker compose exec -T backend npm run lint` -> PASS
- `docker compose exec -T backend npm test` -> PASS (`168/168`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run lint` -> PASS
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm test` -> PASS (`44/44`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T frontend npm run build` -> PASS
  - ostrzeżenie Vite o chunku `>500 kB`, bez regresji builda

### E2E run
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml ps` -> PASS
- `curl -sI http://localhost:3330` -> PASS (`200 OK`)
- `curl -sI http://localhost:4000/health` -> PASS (`200 OK`)
- `docker compose -f docker-compose.yml -f docker-compose.enterprise.override.yml exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js` -> PASS
- Repo nadal nie zawiera Playwright/Cypress; utrzymany fallback smoke/manual baseline.

### Result
- Inbox developera i użytkownika pokazuje teraz od razu projekt, stan przekonwertowania oraz bezpośredni link `Otwórz zgłoszenie` dla wątków eskalowanych do ticketu.
- Detail przekonwertowanego wątku ma mocniejszy banner informacyjny jeszcze przed sekcją konwersacji.
- Karty wiadomości w chacie są wizualnie rozdzielone na requestera i support, co poprawia czytelność historii bez zmiany modelu danych.
- Testy zabezpieczają nowy kontrakt UI zarówno dla inboxu, jak i detailu użytkownika.

### Skills created/updated
- none
