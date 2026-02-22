# EdudoroIT_SupportCenter

EdudoroIT_SupportCenter to system obsługi zgłoszeń IT z podziałem na role zgłaszającego i developera, z widokiem obłożenia, tablicą Kanban, listą TODO developera oraz panelem ustawień aplikacji.

## Zakres funkcjonalny

### 1. Użytkownik (zgłaszający)
- Logowanie bez hasła przez OTP (8 cyfr, kod ważny 10 minut).
- Dodawanie zgłoszeń przez wieloetapowy formularz (kategorie, priorytet, szczegóły, załączniki).
- Wgląd we własne zgłoszenia z filtrami (`/my-tickets`).
- Widok szczegółów zgłoszenia: opis, status, historia zmian, komentarze, załączniki.
- Edycja zgłoszenia do czasu rozpoczęcia pracy po stronie IT (status `submitted`).

### 2. Developer / IT
- Dashboard z metrykami, alertami i skrótami.
- Globalny widok obłożenia (`/overview`): `in_progress`, kolejka (`verified` + `waiting`), `blocked`, `submitted`.
- Kanban (`/board`) z DnD i szybkim podglądem/edycją zgłoszenia.
- Lista TODO developera (`/dev-todo`) powiązana ze zgłoszeniami:
  - zadania aktywne i zakończone,
  - filtrowanie, sortowanie, reorder DnD,
  - przejęcie/akceptacja zgłoszeń z kolejki.
- Finalizacja zadania z komentarzem i wyborem wyniku (`closed` albo `waiting` do weryfikacji zgłaszającego).

### 3. Admin (w ramach roli `developer`)
- Ustawienia aplikacji: nazwa, URL, domeny do logowania, lista maili developerów.
- Branding: upload logo aplikacji.
- Email provider: wybór `SMTP` albo `AWS SES`, zapis konfiguracji i test wysyłki.
- Zarządzanie projektami.
- Zarządzanie użytkownikami i rolami (`user` / `developer`).

### 4. Profil użytkownika
- Edycja imienia i nazwiska.
- Podgląd emaila (read-only).
- Upload avatara.
- Wejście do profilu przez klikalny blok użytkownika w stopce sidebara.

## Statusy zgłoszeń i flow

- `submitted` - nowe zgłoszenie, czeka na weryfikację.
- `verified` - zweryfikowane, gotowe do realizacji.
- `in_progress` - w realizacji.
- `waiting` - oczekuje na informację/weryfikację po stronie zgłaszającego.
- `blocked` - zablokowane, wymagane dodatkowe dane/decyzja.
- `closed` - zamknięte.

Logika automatyczna:
- Akceptacja/planowanie zgłoszenia przez developera może automatycznie przełączyć `submitted -> verified`.
- Dla zaakceptowanych/przypisanych zgłoszeń tworzony/aktualizowany jest powiązany task developerski.
- Ponowne otwarcie zgłoszenia na Kanbanie synchronizuje status powiązanego taska TODO.

## Stack technologiczny

- Frontend: React 18, Vite, React Router, i18n, dnd-kit.
- Backend: Node.js 20, Express, SQLite (`better-sqlite3`), Zod, JWT.
- Uploady: `multer` (pliki i avatary/logo).
- Email: `nodemailer` (SMTP) lub AWS SDK (SES).
- Uruchomienie lokalne: Docker Compose + Mailpit.

## Wymagania

- Docker + Docker Compose (zalecane)  
lub
- Node.js 20+ i npm.

## Instalacja i uruchomienie (Docker)

1. Skopiuj pliki środowiskowe:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. Uruchom stack:
```bash
docker compose up --build
```

3. Adresy lokalne:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:4000/health`
- Mailpit UI (podgląd OTP/maili): `http://localhost:8025`

Jeśli porty Mailpit są zajęte:
```bash
MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose up --build
```

## Pierwsze uruchomienie (ważne)

Domyślnie baza startuje z:
- `allowed_domains = ["example.com"]`
- `developer_emails = []`

To oznacza, że przed pierwszym logowaniem warto ustawić własną domenę i pierwszy email developera:

```bash
docker compose exec -T backend node -e "const db=require('./db'); db.prepare(\"UPDATE settings SET value = ? WHERE key = 'allowed_domains'\").run(JSON.stringify(['example.com','zlotynauczyciel.pl'])); db.prepare(\"UPDATE settings SET value = ? WHERE key = 'developer_emails'\").run(JSON.stringify(['piotr@zlotynauczyciel.pl'])); console.log('settings updated');"
```

Weryfikacja:
```bash
docker compose exec -T backend node -e "const db=require('./db'); console.log(db.prepare(\"SELECT key,value FROM settings WHERE key IN ('allowed_domains','developer_emails') ORDER BY key\").all());"
```

## Jak korzystać (skrót)

1. Wejdź na `http://localhost:3000/login`.
2. Podaj email z dozwolonej domeny.
3. Odczytaj kod OTP z Mailpit (`http://localhost:8025`) i zaloguj się.
4. Użytkownik zgłasza ticket przez `Nowe zgłoszenie`.
5. Developer obsługuje zgłoszenia przez `Kanban`, `Lista TODO`, `Obłożenie`.
6. Ustawienia organizacyjne i email skonfigurujesz w `Ustawienia`.

## Uruchomienie bez Dockera

Wymagane: lokalny Node.js 20+ i dostępny backend SMTP (np. Mailpit).

```bash
# terminal 1
cd backend
npm install
npm run dev

# terminal 2
cd frontend
npm install
npm run dev
```

Domyślne adresy:
- Frontend: `http://localhost:3000`
- API: `http://localhost:4000`

## Quality Gates

Lokalnie w kontenerach:

```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm test
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm test
docker compose exec -T frontend npm run build
```

CI: `.github/workflows/ci.yml` (GitHub Actions, Node 20, lint + test + build).

## Bezpieczeństwo (zaimplementowane)

- `helmet` + CORS na backendzie.
- JWT Bearer auth i RBAC (`user`, `developer`).
- Walidacja requestów przez Zod.
- Rate limiting:
  - OTP: 3 żądania / 10 min / email.
  - Endpointy zapisu: limit na minutę.
- Bezpieczne uploady:
  - whitelist MIME,
  - limit pliku i limit sumaryczny,
  - walidacja ścieżek i uprawnień dostępu do załączników/avatarów/logo.

## Dane i reset środowiska

Dane SQLite i uploady są trzymane na wolumenach Dockera (`backend_data`, `backend_uploads`).

Pełny reset lokalnego środowiska (usuwa dane):

```bash
docker compose down -v
```

## Release i rollback

Checklista release/rollback: `docs/release-checklist.md`.
