# Skill: E2E Browser Baseline

## Cel
Powtarzalnie wykonać bazowy flow użytkownika i developera po każdej zmianie funkcjonalnej.

## Kiedy stosować
- Każdy krok roadmapy (feature/fix/refactor).
- Zmiany dotykające ticket lifecycle, Kanban, DevTodo, auth.
- Przed commitem kroku oznaczanego jako gotowy do review.

## Kroki (checklista)
- [ ] Uruchom stack: `docker compose up --build -d`.
- [ ] Zweryfikuj health usług (`docker compose ps`, `/health`, frontend route).
- [ ] Wykonaj flow user:
  - OTP login
  - create ticket
  - my tickets
  - ticket detail
- [ ] Wykonaj flow developer:
  - OTP login
  - overview/board
  - move status
  - check DevTodo sync
- [ ] Zapisz wynik (pass/fail + obserwacje) w `docs/PROGRESS.md`.

## Przykłady
Komendy pomocnicze:
```bash
docker compose up --build -d
docker compose ps
curl -s http://localhost:4000/health
curl -sI http://localhost:3000/login
```

Jeśli brak Playwright/Cypress:
- wykonaj manual scripted flow i opisz kroki/rezultat w `docs/PROGRESS.md`.

## Definition of Done
- [ ] Stack startuje poprawnie.
- [ ] User i developer przechodzą bazowy flow bez błędów krytycznych.
- [ ] Statusy i widoki są spójne po zmianie.
- [ ] Wynik jest wpisany do `docs/PROGRESS.md`.

## Najczęstsze błędy / pułapki
- Testy przechodzą, ale flow UI ma regresję.
- Brak walidacji synchronizacji Kanban <-> DevTodo.
- Nieaktualne dane sesji/test users między krokami.

## Powiązane pliki w repo
- `docker-compose.yml`
- `backend/tests/api.integration.test.js`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Board.jsx`
- `frontend/src/pages/DevTodo.jsx`
- `docs/PROGRESS.md`
