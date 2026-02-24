# Contributing to OpenArca

**Language:** [EN](#english) | [PL](#polski)

---

## English

**Language:** [EN](#english) | [PL](#polski)

### 1) Scope
OpenArca is an Open Core project. Contributions in this repository target the Open Core layer.

Non-negotiable security baseline:
- RBAC and ownership checks must stay intact.
- Input validation must stay strict.
- Upload and rate-limit protections must not be weakened.

### 2) Before you start
- Read `README.md` for local setup and product scope.
- Read `SECURITY.md` for vulnerability disclosure.
- For AI/agent-assisted work, follow `docs/AGENTS.md`.

### First contribution? Start here
If you are new to OpenArca:

- Look for issues labeled `good first issue` or `help wanted`.
- Pick small, focused changes first.
- Ask questions in the issue before implementing if something is unclear.

Small improvements (docs, tests, UI polish, DX) are highly appreciated.

### 3) Contributor quickstart (Docker)
Prerequisites:
- Docker + Docker Compose

```bash
git clone https://github.com/visiolab-studio/OpenArca.git
cd OpenArca
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build -d
docker compose ps
```

Service URLs:
- App: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- Mailpit: `http://localhost:8025`

### 4) Contribution workflow
1. Open an issue (bug/feature/proposal) with context and expected outcome.
2. Create a focused branch (`one change = one branch`).
3. Implement in small, reviewable commits.
4. Add/update tests for every behavioral change.
5. Run quality gates locally.
6. Open a PR with: scope, risks, test evidence, and docs impact.

### AI-assisted contributions
AI-assisted development is welcome.

If you use AI tools:
- verify generated code,
- run all quality gates,
- keep changes focused and reviewable.

The contributor remains responsible for code quality and security.

### 5) Quality gates (required before PR)
```bash
docker compose up --build -d
docker compose ps
docker compose exec -T backend npm run lint
docker compose exec -T backend npm test
docker compose exec -T frontend yarn lint
docker compose exec -T frontend yarn test
docker compose exec -T frontend yarn build
docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js
```

### 6) E2E browser flow baseline
This repository currently uses a manual scripted browser baseline (no Playwright/Cypress yet):
1. OTP login as `user`
2. Create ticket
3. Open `My tickets`
4. Open ticket detail
5. OTP login as `developer`
6. Open `Overview` and `Board`
7. Move ticket status
8. Verify DevTodo sync
9. Close ticket with closure summary (when feature is available)

### 7) Coding and architecture rules
- Keep API changes backward-compatible unless explicitly documented.
- Avoid unrelated refactors in the same PR.
- Preserve Open Core / Enterprise boundaries.
- If behavior changes, update docs (`README`, `ROADMAP`, `docs/*` when relevant).

### 8) Commit and PR standards
Commit format:
- `feat(scope): short summary`
- `fix(scope): short summary`
- `chore(scope): short summary`

PR checklist:
- [ ] Scope is focused and justified.
- [ ] Security baseline is preserved (RBAC/ownership/validation/limits).
- [ ] Backend lint/tests pass.
- [ ] Frontend lint/tests/build pass.
- [ ] Smoke flow is verified.
- [ ] Docs are updated when behavior changed.

### 9) Security issues
Do not publish vulnerabilities in public issues.
Use coordinated disclosure via `SECURITY.md` (prefer GitHub Security Advisories).

### Maintainer promise
We aim to keep reviews constructive, respectful, and reasonably fast.
Clear, focused PRs are usually reviewed quicker.

---

## Polski

**Language:** [EN](#english) | [PL](#polski)

### 1) Zakres
OpenArca jest projektem Open Core. Wkład w tym repo dotyczy warstwy Open Core.

Nienaruszalne minimum bezpieczeństwa:
- RBAC i kontrola ownership muszą pozostać bez osłabiania.
- Walidacja danych wejściowych musi pozostać rygorystyczna.
- Ochrona uploadu i rate-limit nie może być osłabiona.

### 2) Zanim zaczniesz
- Przeczytaj `README.md` (setup lokalny i zakres produktu).
- Przeczytaj `SECURITY.md` (zgłaszanie podatności).
- Dla pracy wspieranej agentami AI trzymaj się `docs/AGENTS.md`.

### Pierwszy contribution? Zacznij tutaj
Jeśli to Twój pierwszy wkład w OpenArca:

- Szukaj issue oznaczonych `good first issue` lub `help wanted`.
- Zacznij od małych, konkretnych zmian.
- Jeśli coś jest niejasne — zapytaj w issue przed implementacją.

Małe ulepszenia (docs, testy, UI, DX) są bardzo mile widziane.

### 3) Szybki start kontrybutora (Docker)
Wymagania:
- Docker + Docker Compose

```bash
git clone https://github.com/visiolab-studio/OpenArca.git
cd OpenArca
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build -d
docker compose ps
```

Adresy usług:
- Aplikacja: `http://localhost:3000`
- Health API: `http://localhost:4000/health`
- Mailpit: `http://localhost:8025`

### 4) Workflow pracy
1. Otwórz issue (bug/feature/propozycja) z kontekstem i oczekiwanym wynikiem.
2. Utwórz wąski branch (`jedna zmiana = jeden branch`).
3. Implementuj małymi, reviewowalnymi commitami.
4. Dodaj/zaktualizuj testy przy każdej zmianie zachowania.
5. Uruchom quality gates lokalnie.
6. Otwórz PR z: zakresem, ryzykami, wynikami testów i wpływem na dokumentację.

### Contributions wspierane AI
Contributions tworzone z pomocą AI są mile widziane.

Jeśli używasz narzędzi AI:
- zweryfikuj wygenerowany kod,
- uruchom wszystkie quality gates,
- utrzymuj zmiany małe i reviewowalne.

Odpowiedzialność za jakość i bezpieczeństwo kodu nadal spoczywa na kontrybutorze.

### 5) Quality gates (wymagane przed PR)
```bash
docker compose up --build -d
docker compose ps
docker compose exec -T backend npm run lint
docker compose exec -T backend npm test
docker compose exec -T frontend yarn lint
docker compose exec -T frontend yarn test
docker compose exec -T frontend yarn build
docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js
```

### 6) Bazowy flow E2E w przeglądarce
Repo aktualnie używa manualnego smoke baseline (bez Playwright/Cypress):
1. Logowanie OTP jako `user`
2. Utworzenie zgłoszenia
3. Wejście w `Moje zgłoszenia`
4. Wejście w szczegóły zgłoszenia
5. Logowanie OTP jako `developer`
6. Wejście w `Obłożenie` i `Kanban`
7. Zmiana statusu zgłoszenia
8. Weryfikacja synchronizacji DevTodo
9. Zamknięcie zgłoszenia z closure summary (jeśli funkcja dostępna)

### 7) Zasady kodowania i architektury
- Zmiany API utrzymuj jako kompatybilne wstecz, jeśli nie są jawnie udokumentowane.
- Nie mieszaj niepowiązanych refaktorów w jednym PR.
- Zachowuj granicę Open Core / Enterprise.
- Gdy zmienia się zachowanie, aktualizuj dokumentację (`README`, `ROADMAP`, `docs/*`).

### 8) Standard commitów i PR
Format commitów:
- `feat(scope): short summary`
- `fix(scope): short summary`
- `chore(scope): short summary`

Checklista PR:
- [ ] Zakres jest wąski i uzasadniony.
- [ ] Baseline bezpieczeństwa jest zachowany (RBAC/ownership/walidacja/limity).
- [ ] Backend lint/testy przechodzą.
- [ ] Frontend lint/testy/build przechodzą.
- [ ] Smoke flow jest zweryfikowany.
- [ ] Dokumentacja jest zaktualizowana przy zmianie zachowania.

### 9) Zgłaszanie podatności
Nie publikuj podatności w publicznych issue.
Użyj coordinated disclosure wg `SECURITY.md` (preferowany kanał: GitHub Security Advisories).

### Obietnica maintainera
Staramy się utrzymywać review konstruktywne, przyjazne i możliwie szybkie.
Jasne i wąskie PR-y są zazwyczaj sprawdzane szybciej.
