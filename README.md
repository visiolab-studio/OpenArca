# OpenArca

![License](https://img.shields.io/badge/license-AGPL--3.0-green)
![Status](https://img.shields.io/badge/status-early%20open%20release-blue)

OpenArca is an Open Core execution workspace for teams that want to keep context while they ship.
OpenArca sits between support desks and developer workflows.

**Language:** [EN](#english) | [PL](#polski)

---

## English

**Language:** [EN](#english) | [PL](#polski)

### 1) Project in one sentence
OpenArca helps teams move from incoming requests to structured execution without losing context.

### 2) Why OpenArca exists
Teams often lose context between tickets, comments, and implementation work.
Most tools are either too heavy for day-to-day execution or too shallow for operational clarity.
OpenArca exists to keep work, decisions, and outcomes connected in one place.

### 3) The core idea
Most tools organize work.

OpenArca preserves execution context.

That means:
- tickets stay connected to decisions
- ownership survives handoffs
- teams keep momentum without extra process

### 4) Who OpenArca is for
- Internal IT teams
- Software agencies
- Product teams tired of heavy PM tools
- Developers who prefer flow over process

### 5) What it is / What it isn't
**What it is**
- An Open Core execution workspace for internal IT and dev operations.
- A ticket + Kanban + developer TODO flow with role-based access.
- A practical base for teams that want to self-host and extend safely.

**What it isn't**
- A generic helpdesk template.
- A PM suite replacing strategic planning tools.
- A closed SaaS black box.

### 6) Key features
**Users**
- Passwordless OTP login.
- Multi-step ticket submission with attachments.
- "My tickets" list and ticket detail with status/history/comments.

**Developers**
- Workload overview (`/overview`) with queue grouping.
- Kanban board (`/board`) with status flow.
- Developer TODO (`/dev-todo`) synchronized with ticket lifecycle.
- Closure summary flow before closing tickets.

**Admin**
- Allowed domains and developer emails.
- App branding (name, logo, URL).
- Mail providers: SMTP or AWS SES.
- Projects and user/role management.

### Screenshots
Add screenshots to `docs/assets/` and reference them from README, for example:

```md
![Dashboard](docs/assets/dashboard.png)
![Kanban](docs/assets/kanban.png)
```

Current state: screenshot files are not included yet.

### 7) Run in 5 minutes (Docker Compose)
Prerequisites:
- Docker + Docker Compose

```bash
git clone https://github.com/visiolab-studio/OpenArca.git
cd OpenArca
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build -d
```

Open:
- App: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- Mailpit (OTP/email inbox): `http://localhost:8025`

First boot note:
- Default settings allow only `example.com` and no developer accounts.
- Set your domain and first developer email:

```bash
docker compose exec -T backend node -e "const db=require('./db'); db.prepare(\"UPDATE settings SET value=? WHERE key='allowed_domains'\").run(JSON.stringify(['example.com','yourcompany.com'])); db.prepare(\"UPDATE settings SET value=? WHERE key='developer_emails'\").run(JSON.stringify(['dev@yourcompany.com'])); console.log('settings updated');"
```

### 8) Configuration (minimal)
Main runtime files:
- Root env: [`.env.example`](.env.example)
- Backend env: [`backend/.env.example`](backend/.env.example)
- Frontend env: [`frontend/.env.example`](frontend/.env.example)
- Compose services and ports: [`docker-compose.yml`](docker-compose.yml)

Default local ports:
- Frontend: `3000`
- Backend: `4000`
- Mailpit SMTP/UI: `1025` / `8025`

Mail delivery:
- Configure in app settings (`/admin`) via `SMTP` or `AWS SES`.

Useful docs:
- Release/rollback checklist: [`docs/release-checklist.md`](docs/release-checklist.md)

### 9) License (AGPL-3.0) and what it means for companies
OpenArca is licensed under **AGPL-3.0-only**. See [`LICENSE`](LICENSE).

For companies (short version):
- You can self-host and use OpenArca internally.
- If you modify OpenArca and make it available to users over a network, you must provide source code of that modified version under AGPL.
- If you need proprietary distribution terms, keep Open Core unmodified or use a separate commercial agreement for enterprise extensions.

### 10) Contributing
Start here:
- Read [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Pick an issue (look for `good first issue` label, or open a new issue describing what you want to work on).
- Keep PRs focused: one feature/fix per branch.

Minimum PR quality gates:

```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm test
docker compose exec -T frontend yarn lint
docker compose exec -T frontend yarn test
docker compose exec -T frontend yarn build
```

### 11) Security
Do not report vulnerabilities publicly.
Use the coordinated disclosure process from [`SECURITY.md`](SECURITY.md).
Preferred channel: GitHub Security Advisories.

### 12) Roadmap
- Public roadmap: [`ROADMAP.md`](ROADMAP.md)
- Work items: [GitHub Issues](https://github.com/visiolab-studio/OpenArca/issues)

### 13) Maintainer / Author
- **Piotr Tomczak** — Founder / Maintainer
- **Visio Lab Sp. z o.o.**
- GitHub: [@<maintainer-github>](https://github.com/<maintainer-github>)

### 14) FAQ (mini)
**Can I self-host OpenArca?**
- Yes. Docker Compose setup is included.

**Do we need to open source our internal usage?**
- Internal usage itself does not force publication. AGPL obligations apply when you provide a modified network-accessible version to users.

**What is Open Core vs Enterprise here?**
- This repository is Open Core. Enterprise-only capabilities are handled separately.

**Where do OTP codes go in local development?**
- To Mailpit (`http://localhost:8025`).

---

## Polski

**Language:** [EN](#english) | [PL](#polski)

### 1) Projekt w jednym zdaniu
OpenArca pomaga zespołom przejść od zgłoszenia do wykonania pracy bez utraty kontekstu.

### 2) Dlaczego OpenArca istnieje
Zespoły regularnie tracą kontekst między zgłoszeniami, komentarzami i wdrożeniem.
Wiele narzędzi jest albo zbyt ciężkich do codziennej pracy, albo zbyt płytkich operacyjnie.
OpenArca powstała, żeby spiąć pracę, decyzje i wynik w jednym miejscu.

### 3) Kluczowa idea
Większość narzędzi organizuje pracę.

OpenArca zachowuje kontekst wykonania.

To znaczy:
- zgłoszenia pozostają połączone z decyzjami
- odpowiedzialność nie ginie przy przekazaniach
- zespół utrzymuje tempo bez dokładania procesu

### 4) Dla kogo jest OpenArca
- Wewnętrzne zespoły IT
- Software house'y
- Zespoły produktowe zmęczone ciężkimi narzędziami PM
- Developerzy, którzy wolą flow niż proces

### 5) Czym jest / Czym nie jest
**Czym jest**
- Open Core workspace do operacyjnej pracy IT i dev.
- Flow ticket + Kanban + TODO developera z kontrolą dostępu.
- Praktyczna baza pod self-hosting i bezpieczne rozszerzenia.

**Czym nie jest**
- Generycznym helpdeskiem.
- Suitem do planowania strategicznego.
- Zamkniętym narzędziem SaaS.

### 6) Kluczowe funkcje
**Użytkownicy**
- Logowanie OTP bez hasła.
- Wieloetapowe zgłoszenia z załącznikami.
- "Moje zgłoszenia" i szczegóły zgłoszenia (status/historia/komentarze).

**Developerzy**
- Widok obłożenia (`/overview`) z kolejkami statusów.
- Kanban (`/board`) do pracy na statusach.
- Lista TODO (`/dev-todo`) zsynchronizowana z cyklem życia zgłoszenia.
- Wymuszenie podsumowania zamknięcia przed statusem `closed`.

**Admin**
- Domeny do logowania i lista emaili developerów.
- Branding aplikacji (nazwa, logo, URL).
- Dostawcy maili: SMTP lub AWS SES.
- Zarządzanie projektami i użytkownikami.

### Screenshots
Dodaj zrzuty do `docs/assets/` i podlinkuj je w README, np.:

```md
![Dashboard](docs/assets/dashboard.png)
![Kanban](docs/assets/kanban.png)
```

Aktualnie: pliki screenshotów nie są jeszcze dodane.

### 7) Uruchom w 5 minut (Docker Compose)
Wymagania:
- Docker + Docker Compose

```bash
git clone https://github.com/visiolab-studio/OpenArca.git
cd OpenArca
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build -d
```

Adresy:
- Aplikacja: `http://localhost:3000`
- Health API: `http://localhost:4000/health`
- Mailpit (OTP/skrzynka): `http://localhost:8025`

Uwaga przy pierwszym starcie:
- Domyślnie dozwolona jest tylko domena `example.com`, a lista developerów jest pusta.
- Ustaw własną domenę i pierwszego developera:

```bash
docker compose exec -T backend node -e "const db=require('./db'); db.prepare(\"UPDATE settings SET value=? WHERE key='allowed_domains'\").run(JSON.stringify(['example.com','twojafirma.pl'])); db.prepare(\"UPDATE settings SET value=? WHERE key='developer_emails'\").run(JSON.stringify(['dev@twojafirma.pl'])); console.log('settings updated');"
```

### 8) Konfiguracja (minimum)
Główne pliki runtime:
- Root env: [`.env.example`](.env.example)
- Backend env: [`backend/.env.example`](backend/.env.example)
- Frontend env: [`frontend/.env.example`](frontend/.env.example)
- Serwisy i porty: [`docker-compose.yml`](docker-compose.yml)

Domyślne porty lokalne:
- Frontend: `3000`
- Backend: `4000`
- Mailpit SMTP/UI: `1025` / `8025`

Wysyłka maili:
- Konfiguracja w panelu `/admin` przez `SMTP` lub `AWS SES`.

Przydatna dokumentacja:
- Checklista release/rollback: [`docs/release-checklist.md`](docs/release-checklist.md)

### 9) Licencja (AGPL-3.0) i co to znaczy dla firm
OpenArca jest na licencji **AGPL-3.0-only**. Zobacz [`LICENSE`](LICENSE).

Dla firm, w skrócie:
- Możesz self-hostować i używać OpenArca wewnętrznie.
- Jeśli modyfikujesz OpenArca i udostępniasz taką wersję użytkownikom przez sieć, musisz udostępnić kod źródłowy tej wersji na AGPL.
- Jeśli potrzebujesz modelu zamkniętego dla rozszerzeń, rozdziel Open Core i warstwę komercyjną.

### 10) Contributing
Start:
- Przeczytaj [`CONTRIBUTING.md`](CONTRIBUTING.md).
- Wybierz issue (najlepiej z etykietą `good first issue`; jeśli jej brak, otwórz issue z propozycją zakresu).
- Rób małe, jednoznaczne PR-y.

Minimalne quality gates dla PR:

```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm test
docker compose exec -T frontend yarn lint
docker compose exec -T frontend yarn test
docker compose exec -T frontend yarn build
```

### 11) Security
Nie zgłaszaj podatności publicznie.
Stosuj procedurę coordinated disclosure z [`SECURITY.md`](SECURITY.md).
Preferowany kanał: GitHub Security Advisories.

### 12) Roadmapa
- Publiczna roadmapa: [`ROADMAP.md`](ROADMAP.md)
- Lista prac: [GitHub Issues](https://github.com/visiolab-studio/OpenArca/issues)

### 13) Maintainer / Author
- **Piotr Tomczak** — Founder / Maintainer
- **Visio Lab Sp. z o.o.**
- GitHub: [@<maintainer-github>](https://github.com/<maintainer-github>)

### 14) FAQ (mini)
**Czy mogę hostować OpenArca samodzielnie?**
- Tak. W repo jest gotowy stack Docker Compose.

**Czy muszę publikować kod przy użyciu wewnętrznym?**
- Samo użycie wewnętrzne nie wymaga publikacji. Obowiązki AGPL pojawiają się przy udostępnianiu zmodyfikowanej wersji przez sieć użytkownikom.

**Jak rozumieć Open Core vs Enterprise?**
- To repo to Open Core. Funkcje Enterprise są utrzymywane osobno.

**Gdzie znajdę kody OTP lokalnie?**
- W Mailpit: `http://localhost:8025`.
