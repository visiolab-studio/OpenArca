# EdudoroIT_SupportCenter — Specyfikacja Techniczna Systemu Zgłoszeń
**Wersja:** 1.0  
**Dokument przeznaczony dla:** Agenta AI implementującego aplikację  
**Język aplikacji:** Polski i Angielski (i18n, przełączane przez użytkownika)

---

## 1. Przegląd systemu

EdudoroIT_SupportCenter to wewnętrzny system zarządzania zgłoszeniami (ticketami) dla małego zespołu. Użytkownicy firmy zgłaszają błędy i zadania przez formularz. Developer(zy) zarządzają zgłoszeniami, zmieniają statusy, komunikują się z autorami i planują pracę przez własną listę TODO.

### 1.1 Stack technologiczny

**Backend:**
- Node.js + Express.js
- SQLite (better-sqlite3)
- Nodemailer (wysyłka e-maili)
- JSON Web Tokens (autoryzacja)
- Multer (upload plików)
- `uuid` do generowania ID

**Frontend:**
- React (Vite)
- React Router v6
- Axios (HTTP)
- i18next (tłumaczenia PL/EN)
- react-beautiful-dnd lub @dnd-kit (drag-and-drop dla Kanban i TODO)
- date-fns (formatowanie dat)

**Struktura katalogów:**
```
/
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── middleware/auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── tickets.js
│   │   ├── devTasks.js
│   │   ├── projects.js
│   │   ├── users.js
│   │   └── settings.js
│   ├── services/
│   │   └── email.js
│   └── uploads/
├── frontend/
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api/           (axios instances)
│       ├── contexts/      (AuthContext, LanguageContext)
│       ├── hooks/
│       ├── i18n/          (pl.json, en.json)
│       ├── components/    (shared UI)
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── NewTicket.jsx
│           ├── MyTickets.jsx
│           ├── TicketDetail.jsx
│           ├── Board.jsx           (Kanban — widok dla developera)
│           ├── DevTodo.jsx         (Lista TODO — tylko developer)
│           ├── Admin.jsx           (Ustawienia — tylko developer)
│           └── Overview.jsx        (Obłożenie — widoczne dla wszystkich)
└── .env.example
```

---

## 2. Baza danych (SQLite)

### 2.1 Tabele

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',     -- 'developer' | 'user'
  language TEXT NOT NULL DEFAULT 'pl',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE otp_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,                    -- 8-cyfrowy kod
  expires_at TEXT NOT NULL,             -- +10 minut od created_at
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6B7280',          -- hex kolor dla UI
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,        -- autoincrement counter z settings
  title TEXT NOT NULL,                   -- min. 10 znaków
  description TEXT NOT NULL,            -- min. 50 znaków
  steps_to_reproduce TEXT,              -- opcjonalne dla bugów
  expected_result TEXT,
  actual_result TEXT,
  environment TEXT,                      -- np. "prod / Chrome 121 / Windows 11"
  urgency_reporter TEXT NOT NULL DEFAULT 'normal',  -- priorytet wg zgłaszającego
  priority TEXT NOT NULL DEFAULT 'normal',          -- priorytet ustawiony przez developera
  -- Priorytety: 'critical' | 'high' | 'normal' | 'low'
  status TEXT NOT NULL DEFAULT 'submitted',
  -- Statusy: 'submitted' | 'verified' | 'in_progress' | 'waiting' | 'blocked' | 'closed'
  category TEXT NOT NULL DEFAULT 'other',
  -- Kategorie: 'bug' | 'feature' | 'improvement' | 'question' | 'other'
  project_id TEXT REFERENCES projects(id),
  reporter_id TEXT NOT NULL REFERENCES users(id),
  assignee_id TEXT REFERENCES users(id),
  estimated_hours REAL,                  -- szacowany czas realizacji (h)
  planned_date TEXT,                     -- planowana data zakończenia (ISO date)
  order_index INTEGER NOT NULL DEFAULT 0,
  internal_note TEXT,                    -- notatka wewnętrzna, niewidoczna dla zgłaszającego
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE TABLE ticket_history (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  user_id TEXT REFERENCES users(id),
  field TEXT NOT NULL,                   -- nazwa zmienionego pola
  old_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  user_id TEXT REFERENCES users(id),
  content TEXT NOT NULL,
  is_developer INTEGER NOT NULL DEFAULT 0,    -- 1 = napisał developer
  is_internal INTEGER NOT NULL DEFAULT 0,     -- 1 = niewidoczne dla zgłaszającego
  type TEXT NOT NULL DEFAULT 'comment',       -- 'comment' | 'question' | 'answer'
  parent_id TEXT REFERENCES comments(id),     -- dla odpowiedzi na pytania
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  filename TEXT NOT NULL,               -- nazwa na dysku
  original_name TEXT NOT NULL,         -- oryginalna nazwa pliku
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,               -- w bajtach
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE dev_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',     -- 'critical' | 'high' | 'normal' | 'low'
  estimated_hours REAL,
  planned_date TEXT,
  status TEXT NOT NULL DEFAULT 'todo',         -- 'todo' | 'in_progress' | 'done'
  order_index INTEGER NOT NULL DEFAULT 0,      -- ręczna kolejność
  ticket_id TEXT REFERENCES tickets(id),       -- powiązane zgłoszenie (opcjonalne)
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Domyślne wartości settings:
INSERT OR IGNORE INTO settings VALUES ('allowed_domains', '["example.com"]');
INSERT OR IGNORE INTO settings VALUES ('developer_emails', '[]');
INSERT OR IGNORE INTO settings VALUES ('app_name', 'EdudoroIT_SupportCenter');
INSERT OR IGNORE INTO settings VALUES ('ticket_counter', '0');
INSERT OR IGNORE INTO settings VALUES ('smtp_host', '');
INSERT OR IGNORE INTO settings VALUES ('smtp_port', '587');
INSERT OR IGNORE INTO settings VALUES ('smtp_user', '');
INSERT OR IGNORE INTO settings VALUES ('smtp_pass', '');
INSERT OR IGNORE INTO settings VALUES ('smtp_from', '');
INSERT OR IGNORE INTO settings VALUES ('app_url', 'http://localhost:3000');
```

---

## 3. Autoryzacja — logowanie przez OTP

### 3.1 Zasady

- Logowanie **wyłącznie przez e-mail** — brak haseł
- Weryfikacja domeny emaila na liście `allowed_domains` z tabeli `settings`
- Kod OTP: **8 cyfr**, ważny **10 minut**
- Max 3 kody per email w oknie 10 minut (rate limiting)
- **Pierwsze logowanie:** automatycznie tworzy konto użytkownika
- Rola użytkownika: jeśli email jest na liście `developer_emails` → rola `developer`, w przeciwnym razie `user`
- Token JWT, ważność 30 dni, przechowywany w localStorage

### 3.2 Flow logowania

```
1. Użytkownik wpisuje email
2. Frontend sprawdza domenę (opcjonalna walidacja kliencka)
3. POST /api/auth/request-otp → backend sprawdza domenę i wysyła kod emailem
4. Użytkownik wpisuje 8-cyfrowy kod
5. POST /api/auth/verify-otp → zwraca token JWT + dane usera
6. Frontend zapisuje token, przekierowuje do Dashboard
```

### 3.3 Endpointy autoryzacji

```
POST /api/auth/request-otp
  Body: { email: string, lang: 'pl'|'en' }
  Response: { success: true } | { error: string }

POST /api/auth/verify-otp
  Body: { email: string, code: string }
  Response: { token: string, user: UserObject }

GET /api/auth/me
  Auth: Bearer token
  Response: UserObject

PATCH /api/auth/me
  Auth: Bearer token
  Body: { name?: string, language?: 'pl'|'en' }
  Response: UserObject
```

---

## 4. API Endpointy

### 4.1 Tickety

```
GET    /api/tickets
  Query: status, priority, category, project_id, my=1 (tylko moje)
  Auth: wymagane
  Widoczność: developer widzi wszystkie; user widzi tylko swoje

GET    /api/tickets/board
  Auth: wymagane
  Response: { submitted: [], verified: [], in_progress: [], waiting: [], blocked: [], closed: [], _stats: {} }

GET    /api/tickets/stats/overview
  Auth: wymagane
  Response: { in_progress: N, waiting: N, submitted: N, verified: N, blocked: N, closed_today: N }

GET    /api/tickets/:id
  Auth: wymagane; user może widzieć tylko swoje
  Response: ticket + comments (bez is_internal dla usera) + attachments + history

POST   /api/tickets
  Auth: wymagane
  Body: FormData (bo mogą być załączniki)
    title: string (min 10 znaków)
    description: string (min 50 znaków)
    steps_to_reproduce?: string
    expected_result?: string
    actual_result?: string
    environment?: string
    urgency_reporter?: 'critical'|'high'|'normal'|'low'
    category: 'bug'|'feature'|'improvement'|'question'|'other'
    project_id?: string
    attachments?: File[] (max 10 plików, max 20MB łącznie)

PATCH  /api/tickets/:id
  Auth: wymagane
  Developer może zmieniać: status, priority, planned_date, estimated_hours,
    internal_note, assignee_id, order_index, category, project_id, title, description
  User może zmieniać: title, description, steps_to_reproduce, expected_result, 
    actual_result, environment (tylko gdy status = 'submitted')

POST   /api/tickets/:id/comments
  Auth: wymagane
  Body: { content: string, is_internal?: boolean, type?: 'comment'|'question', parent_id?: string }
  Notatki wewnętrzne (is_internal=true) tylko developer może dodawać

POST   /api/tickets/:id/attachments
  Auth: wymagane
  Body: FormData z plikami
```

### 4.2 Dev Tasks

```
GET    /api/dev-tasks
  Auth: developer only
  Response: { active: DevTask[], done: DevTask[] }
  Sortowanie active: priorytet → planned_date → order_index

POST   /api/dev-tasks
  Auth: developer only
  Body: { title, description?, priority?, estimated_hours?, planned_date?, ticket_id? }

PATCH  /api/dev-tasks/:id
  Auth: developer only
  Body: { title?, description?, priority?, estimated_hours?, planned_date?, status?, order_index? }

DELETE /api/dev-tasks/:id
  Auth: developer only

POST   /api/dev-tasks/reorder
  Auth: developer only
  Body: { order: [{id, order_index}] }
```

### 4.3 Projekty

```
GET    /api/projects        Auth: wymagane
POST   /api/projects        Auth: developer only; Body: { name, description?, color? }
PATCH  /api/projects/:id    Auth: developer only
DELETE /api/projects/:id    Auth: developer only
```

### 4.4 Użytkownicy i Ustawienia

```
GET    /api/users           Auth: developer only; lista wszystkich użytkowników
PATCH  /api/users/:id       Auth: developer only; Body: { role?, name? }

GET    /api/settings        Auth: developer only
PATCH  /api/settings        Auth: developer only
  Body: {
    allowed_domains?: string[],
    developer_emails?: string[],
    app_name?: string,
    smtp_host?: string, smtp_port?: number,
    smtp_user?: string, smtp_pass?: string,
    smtp_from?: string, app_url?: string
  }
```

---

## 5. Powiadomienia Email

### 5.1 Kiedy wysyłać do zgłaszającego

Powiadomienia wysyłane są **wyłącznie do autora zgłoszenia** w następujących przypadkach:

| Zdarzenie | Trigger |
|-----------|---------|
| Zgłoszenie zweryfikowane | zmiana statusu na `verified` |
| Przyjęte do realizacji | zmiana statusu na `in_progress` |
| Zablokowane | zmiana statusu na `blocked` |
| Zamknięte | zmiana statusu na `closed` |
| Nowy komentarz od developera | POST /tickets/:id/comments przez developera, gdy `is_internal = false` |

**Nie wysyłamy:** powiadomień o zmianie priorytetu, zmianie daty, komentarzach od innych userów, wewnętrznych notatkach.

### 5.2 Treść emaila

Email w języku użytkownika (z pola `users.language`).  
Zawiera: tytuł ticketu, numer (#NNN), opis zdarzenia, ewentualną treść komentarza (zacytowaną), link do ticketu.

### 5.3 Konfiguracja SMTP

Dane SMTP pobierane z tabeli `settings`. Jeśli SMTP nie jest skonfigurowane, logi wysyłki trafiają tylko do konsoli (tryb dev).

---

## 6. Widoki Frontend

### 6.1 Strona logowania (`/login`)

- Pole email
- Przycisk "Wyślij kod"
- Po sukcesie: formularz na 8-cyfrowy kod (najlepiej 8 oddzielnych inputów lub jedno pole z auto-formatowaniem)
- Informacja o czasie ważności kodu (10 minut, odliczanie)
- Obsługa błędów: niedozwolona domena, zły kod, wygasły kod
- Przełącznik języka PL/EN widoczny na tej stronie

### 6.2 Dashboard (`/`) — po zalogowaniu

**Dla obu ról:**
- Kafelki z obłożeniem: Zgłoszone (do weryfikacji), Zweryfikowane, W realizacji, Oczekujące, Zablokowane
- Ostatnie aktywności (ostatnie 5–10 zdarzeń w systemie)
- Szybkie linki do formularza i "Moich zgłoszeń"

**Dodatkowo dla developera:**
- Kafelek z liczbą zadań TODO
- Najbliższe planowane daty
- Alerty: tickety przeterminowane, tickety bez priorytetu

### 6.3 Nowe zgłoszenie (`/new-ticket`)

**Formularz musi wymuszać szczegóły — kluczowe wymagania:**

Formularz podzielony na kroki lub sekcje z wyraźnymi instrukcjami:

```
Krok 1: Podstawowe informacje
  - Projekt (select, wymagane jeśli istnieje >0 projektów)
  - Kategoria problemu (bug / nowa funkcja / usprawnienie / pytanie / inne)
    → wybór kategorii zmienia dalsze pola i instrukcje!
  - Tytuł (wymagane, min 10 znaków)
    Instrukcja: "Napisz precyzyjny tytuł. Zamiast 'Nie działa' napisz 
    'Błąd zapisu formularza zamówienia przy kliknięciu Zatwierdź'"
    Walidacja live z licznikiem znaków

Krok 2: Opis szczegółowy (zależy od kategorii)
  Dla kategorii 'bug':
    - Opis problemu (wymagane, min 100 znaków)
      Instrukcja: "Opisz dokładnie co się dzieje. Kiedy? Jak często? Co widzisz?"
    - Kroki do odtworzenia (wymagane dla bugów, min 30 znaków)
      Instrukcja: "Wpisz kolejne kroki: 1. Wejdź na stronę X  2. Kliknij Y  3. ..."
    - Oczekiwany rezultat (wymagane)
    - Faktyczny rezultat (wymagane)
    - Środowisko (wymagane: przeglądarka, system, adres URL, środowisko prod/test)
      → placeholder: "np. Chrome 121, Windows 11, https://app.example.com, środowisko produkcyjne"

  Dla kategorii 'feature' / 'improvement':
    - Opis (wymagane, min 100 znaków)
      Instrukcja: "Opisz funkcję: co ma robić, kto będzie korzystać, jaki problem rozwiązuje?"
    - Cel biznesowy (wymagane, min 30 znaków)
      Instrukcja: "Dlaczego to jest potrzebne? Jaki jest zysk dla firmy/użytkownika?"

  Dla kategorii 'question':
    - Pytanie (wymagane, min 50 znaków)
    - Kontekst (wymagane, min 30 znaków)

Krok 3: Dodatkowe informacje
  - Ważność z Twojej perspektywy (critical / high / normal / low) + opis co oznacza każdy poziom
  - Załączniki (screenshoty, logi, nagrania — max 10 plików, 20MB łącznie)
    Instrukcja: "Wgraj screenshoty błędu, nagranie ekranu lub logi z konsoli. 
    Im więcej materiałów, tym szybciej rozwiążemy problem."

Krok 4: Podgląd i wysłanie
  - Podsumowanie przed wysłaniem
  - Checkbox: "Sprawdziłem, że podałem wszystkie niezbędne informacje"
  - Przycisk Wyślij
```

**Walidacja frontend:**
- Blokada wysłania jeśli nie spełnione minimalne długości
- Czerwone podkreślenia z konkretnymi komunikatami (`"Za krótki opis — dodaj min. 50 znaków"`)
- Progress bar formularza (krok 1 z 4)

### 6.4 Moje zgłoszenia (`/my-tickets`)

Dostępne dla wszystkich zalogowanych.

- Lista wszystkich zgłoszeń zalogowanego użytkownika
- Filtry: status, kategoria, projekt, zakres dat
- Sortowanie: data zgłoszenia, ostatnia aktywność, priorytet
- Kolumny: # | Tytuł | Projekt | Kategoria | Priorytet (developer's) | Status | Data zgłoszenia | Planowana data | Ostatnia aktywność
- Kliknięcie → szczegóły ticketu
- Status wizualnie jako kolorowe badge

### 6.5 Obłożenie (`/overview`)

Dostępne dla wszystkich zalogowanych.

- 5 dużych kafelków ze statusami i liczbami: Zgłoszone, Zweryfikowane, W realizacji, Oczekujące, Zablokowane
- Lista ticketów "W realizacji" z planowanymi datami i priorytetami
- Lista "Oczekujące" — czekające na odpowiedź/odblokowanie
- **Nie pokazujemy:** Zamkniętych (osobna zakładka historii, opcjonalnie)

### 6.6 Szczegóły ticketu (`/ticket/:id`)

**Widoczne dla zgłaszającego:**
- Nagłówek: # | Tytuł | Status (badge) | Priorytet (developer's) | Kategoria | Projekt
- Szczegóły zgłoszenia (opis, kroki, środowisko itd.)
- Planowana data realizacji i szacowany czas (jeśli ustawione)
- Historia statusów (timeline)
- Wątek komentarzy (bez is_internal)
  - Wyraźne oznaczenie: kto napisał (Developer 🔧 vs. Użytkownik)
  - Pytania od developera (type='question') wyróżnione — możliwość odpowiedzi
- Formularz odpowiedzi dla zgłaszającego
- Załączniki

**Widoczne tylko dla developera (dodatkowo):**
- Edycja wszystkich pól (status, priorytet, planowana data, szacowany czas, assignee, kategoria)
- Notatka wewnętrzna (żółte tło, ikona kłódki)
- Przycisk "Dodaj pytanie" (wysyła comment z type='question')
- Przycisk "Dodaj notatkę wewnętrzną"
- Historia wszystkich zmian ze szczegółami
- Powiązane dev_task (jeśli istnieje)
- Przycisk "Dodaj do TODO"

### 6.7 Kanban Board (`/board`) — tylko developer

- Kolumny: Zgłoszone | Zweryfikowane | W realizacji | Oczekujące | Zablokowane | Zamknięte
- Drag & drop ticketów między kolumnami (zmienia status)
- Karta ticketu: #NNN | Tytuł | Projekt (badge z kolorem) | Priorytet (kolor obramowania karty) | Zgłaszający | Planowana data
- Filtry nad boardem: projekt, kategoria, priorytet
- Kliknięcie karty → panel boczny ze szczegółami lub redirect do `/ticket/:id`
- Kolumna "Zamknięte" zwinięta domyślnie

### 6.8 Lista TODO Developera (`/dev-todo`) — tylko developer

**Wymagania:**

- Lista aktywnych zadań (todo + in_progress) z możliwością ręcznego przeciągania (drag & drop) do zmiany kolejności
- **Automatyczne sortowanie jako domyślna sugestia:** krytyczne → high → normal → low, a w obrębie priorytetu: najpierw te z najbliższą `planned_date`, potem bez daty
- Przycisk "Zastosuj automatyczne sortowanie" obok ręcznego drag & drop
- Kolumny listy: Priorytet | Tytuł | Powiązany ticket (#) | Szacowany czas | Planowana data | Status | Akcje
- Badge statusu: Do zrobienia / W realizacji
- Filtr: status, priorytet
- Zakładka "Ukończone" — ostatnie 20 done

**Dodawanie nowego zadania własnego:**
- Inline formularz lub modal: Tytuł (wymagane), Opis, Priorytet, Szacowany czas (w h), Planowana data
- Opcja powiązania z istniejącym ticketem (select z wyszukiwaniem)

**Akcje na zadaniu:**
- Edycja inline (kliknięcie w pole)
- Zmiana statusu (przycisk "Zacznij" / "Ukończ")
- Usuń
- Przejdź do powiązanego ticketu (link)

**Podsumowanie na górze:**
- Łączny szacowany czas zadań aktywnych
- Liczba zadań per priorytet
- Tickety bez planowanej daty (alert jeśli > 0)

### 6.9 Panel Admina (`/admin`) — tylko developer

**Zakładki:**

1. **Ustawienia aplikacji**
   - Nazwa aplikacji
   - URL aplikacji (do linków w emailach)
   - Dozwolone domeny (lista, edytowalna — dodaj/usuń domenę)
   - Emaile developerów (lista — użytkownicy z tych emaili mają rolę developer przy tworzeniu konta)

2. **Konfiguracja SMTP**
   - Host, Port, User, Password, From address
   - Przycisk "Test SMTP" — wysyła testowy email

3. **Projekty**
   - Lista projektów z możliwością dodania, edycji, usunięcia
   - Kolory projektów

4. **Użytkownicy**
   - Lista wszystkich użytkowników: email, imię, rola, data rejestracji, ostatnie logowanie
   - Zmiana roli (user ↔ developer)
   - Edycja imienia

---

## 7. Role i uprawnienia

| Akcja | User | Developer |
|-------|------|-----------|
| Zgłoszenie nowego ticketu | ✅ | ✅ |
| Podgląd własnych ticketów | ✅ | ✅ |
| Podgląd wszystkich ticketów | ❌ | ✅ |
| Edycja własnego ticketu (gdy submitted) | ✅ | ✅ |
| Zmiana statusu ticketu | ❌ | ✅ |
| Zmiana priorytetu (developer's) | ❌ | ✅ |
| Ustawienie planowanej daty | ❌ | ✅ |
| Notatka wewnętrzna | ❌ | ✅ |
| Komentarz publiczny | ✅ | ✅ |
| Odpowiedź na pytanie | ✅ | ✅ |
| Widok Kanban Board | ❌ | ✅ |
| Drag & drop Kanban | ❌ | ✅ |
| Lista TODO | ❌ | ✅ |
| Panel Admin | ❌ | ✅ |
| Widok Obłożenie | ✅ | ✅ |
| Moje zgłoszenia | ✅ | ✅ |

---

## 8. Statusy i priorytety — słownik

### Statusy ticketu

| Status | Klucz | Opis | Kolor UI |
|--------|-------|------|----------|
| Zgłoszone | `submitted` | Nowe, czeka na weryfikację | szary |
| Zweryfikowane | `verified` | Zaakceptowane, w kolejce | niebieski |
| W realizacji | `in_progress` | Aktywnie realizowane | zielony |
| Oczekujące | `waiting` | Czeka na coś (odpowiedź, zasoby) | żółty |
| Zablokowane | `blocked` | Nie może być realizowane | czerwony |
| Zamknięte | `closed` | Ukończone lub odrzucone | ciemnoszary |

### Priorytety

| Priorytet | Klucz | Opis |
|-----------|-------|------|
| Krytyczny | `critical` | System nie działa, blokuje pracę wszystkich |
| Wysoki | `high` | Poważny problem, wpływa na kluczowe procesy |
| Normalny | `normal` | Standardowe zgłoszenie |
| Niski | `low` | Drobne usprawnienie, gdy będzie czas |

---

## 9. Internacjonalizacja (i18n)

- Biblioteka: `i18next` + `react-i18next`
- Pliki: `src/i18n/pl.json` i `src/i18n/en.json`
- Domyślny język: `pl`
- Zapis preferencji języka: na koncie użytkownika (pole `language` w DB) i w localStorage
- Przełącznik języka widoczny w górnym pasku nawigacyjnym
- **Wszystkie** komunikaty UI, etykiety, instrukcje formularza, treści emaili — przetłumaczone

Klucze do przetłumaczenia (przykłady):
```json
{
  "nav.myTickets": "Moje zgłoszenia",
  "nav.newTicket": "Nowe zgłoszenie",
  "nav.overview": "Obłożenie",
  "nav.board": "Kanban",
  "nav.todo": "Lista TODO",
  "nav.admin": "Ustawienia",
  "status.submitted": "Zgłoszone",
  "status.verified": "Zweryfikowane",
  "status.in_progress": "W realizacji",
  "status.waiting": "Oczekujące",
  "status.blocked": "Zablokowane",
  "status.closed": "Zamknięte",
  "priority.critical": "Krytyczny",
  "priority.high": "Wysoki",
  "priority.normal": "Normalny",
  "priority.low": "Niski",
  "category.bug": "Błąd",
  "category.feature": "Nowa funkcja",
  "category.improvement": "Usprawnienie",
  "category.question": "Pytanie",
  "category.other": "Inne"
}
```

---

## 10. Wymagania niefunkcjonalne

### Bezpieczeństwo
- JWT token weryfikowany przy każdym żądaniu
- Walidacja uprawnień po stronie serwera (nie ufać frontendowi)
- Pliki uploadowane serwowane przez osobny endpoint z autoryzacją
- Hashe kodów OTP nie są potrzebne (kody jednorazowe z TTL 10 min są wystarczające), ale kody w DB nie powinny być eksponowane przez API
- Sanityzacja wejść

### Środowisko
- Plik `.env` z konfiguracją:
  ```env
  PORT=4000
  JWT_SECRET=zmien-na-bezpieczny-klucz
  APP_URL=http://localhost:3000
  # SMTP (alternatywnie konfiguracja przez panel admin)
  SMTP_HOST=
  SMTP_PORT=587
  SMTP_USER=
  SMTP_PASS=
  SMTP_FROM=
  ```
- Frontend `VITE_API_URL=http://localhost:4000`

### Uruchomienie
```bash
# Backend
cd backend && npm install && npm start

# Frontend
cd frontend && npm install && npm run dev
```

### Pliki statyczne i upload
- Pliki uploadowane do `backend/uploads/`
- Dostępne przez `GET /api/uploads/:filename` (z autoryzacją JWT)

---

## 11. Dodatkowe szczegóły implementacyjne

### 11.1 Automatyczne sortowanie TODO

Algorytm sugerowanej kolejności zadań developera:

```
1. Priorytet: critical (0) > high (1) > normal (2) > low (3)
2. W ramach priorytetu: najpierw zadania z planned_date (rosnąco), potem bez daty
3. W ramach tego samego dnia: in_progress przed todo
4. Zadania powiązane z ticketami zablokowanymi → traktuj jak wyższy priorytet
```

### 11.2 Historia ticketu

Każda zmiana pola przez `PATCH /api/tickets/:id` powinna zapisywać wiersz w `ticket_history` z:
- `ticket_id`, `user_id`, `field` (nazwa pola), `old_value`, `new_value`, `created_at`

Na frontendzie: wyświetlaj jako timeline — "Jan Kowalski zmienił status z Zgłoszone na Zweryfikowane · 2 godz. temu"

### 11.3 Kolejność kolumn Kanban

Drag & drop między kolumnami zmienia pole `status` ticketu i zapisuje zmianę przez API. Kolejność kart wewnątrz kolumny nie musi być persystowana (opcjonalnie przez `order_index`).

### 11.4 Licznik ticketów

Globalny licznik w tabeli `settings` (klucz `ticket_counter`). Inkrementowany atomowo przy tworzeniu każdego ticketu. Numer wyświetlany jako `#001`, `#002` itd.

### 11.5 Walidacja domeny przy logowaniu

```javascript
// Przykład walidacji domenowej
const domain = email.split('@')[1]?.toLowerCase();
const allowed = JSON.parse(settings.allowed_domains).map(d => d.toLowerCase());
if (!allowed.includes(domain)) {
  return res.status(403).json({ error: 'domain_not_allowed' });
}
```

### 11.6 Formularz zgłoszenia — minimalne długości

| Pole | Min. znaków | Wymagane |
|------|------------|----------|
| title | 10 | ✅ zawsze |
| description | 50 (bug: 100) | ✅ zawsze |
| steps_to_reproduce | 30 | ✅ dla bug |
| expected_result | 20 | ✅ dla bug |
| actual_result | 20 | ✅ dla bug |
| environment | 10 | ✅ dla bug |
| cel_biznesowy | 30 | ✅ dla feature/improvement |
| context (question) | 30 | ✅ dla question |

### 11.7 Notyfikacje — szczegóły

Nie wysyłaj powiadomień jeśli:
- Autor zgłoszenia jest tym samym co developer (np. developer zgłasza własne tickety)
- Zmiana pochodzi od samego zgłaszającego

Treść emaila powinna być w języku przypisanym do konta odbiorcy (`users.language`).

---

## 12. Estetyka UI (wytyczne)

- **Motyw:** ciemny (dark), industrialny, profesjonalne narzędzie developerskie
- **Paleta:** ciemne tła (#0F1117, #1A1D26), akcenty w kolorach statusów, biały/szary tekst
- **Typografia:** czytelna, techniczna — np. JetBrains Mono dla numerów ticketów/kodów, system font lub DM Sans dla treści
- **Statusy:** wyraźne badge z kolorami (szary, niebieski, zielony, żółty, czerwony, ciemnoszary)
- **Priorytety:** kolorowe obramowanie lub wskaźnik (czerwony=critical, pomarańczowy=high, niebieski=normal, szary=low)
- **Kanban:** kompaktowe karty, widoczny priorytet i projekt
- **Responsywność:** minimum tablet (768px+); mobile dla widoku "Moje zgłoszenia" i szczegółów ticketu

---

## 13. Uruchomienie i wdrożenie

### Development
```bash
# Backend (port 4000)
cd backend
npm install
node server.js

# Frontend (port 3000)
cd frontend
npm install
npm run dev
```

### Produkcja
- Frontend: `npm run build` → serwuj jako statyczne pliki (np. przez nginx lub `serve`)
- Backend: `node server.js` lub PM2
- Rekomendowane: nginx jako reverse proxy (/ → frontend, /api → backend:4000)
- SQLite plik danych: regularne backupy `backend/data.sqlite`

### Przykładowy `nginx.conf`
```nginx
server {
  listen 80;
  server_name edudoroit-supportcenter.example.com;

  location /api/ {
    proxy_pass http://localhost:4000;
    client_max_body_size 25M;
  }

  location / {
    root /var/www/edudoroit-supportcenter;
    try_files $uri /index.html;
  }
}
```

---

*Specyfikacja kompletna. Agent implementujący powinien zacząć od backendu (db.js → middleware → routes → server.js), następnie frontend (AuthContext → routing → strona logowania → kolejne widoki w porządku: Dashboard → NewTicket → MyTickets → TicketDetail → Overview → Board → DevTodo → Admin).*
