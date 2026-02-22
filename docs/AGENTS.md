# EdudoroIT_SupportCenter — Agent Playbook

## How to work in this repo
- Pracuj krokami, jeden feature na raz.
- Każdy krok musi kończyć się: testy + smoke E2E + wpis do `docs/PROGRESS.md`.
- Nie obchodź bezpieczeństwa: RBAC, ownership, walidacja, limity uploadu/rate-limit są nienaruszalne.
- Zmiany architektoniczne najpierw dokumentuj w skillach (`docs/skills/`), potem implementuj.

## Standard commitów
- Format:
  - `feat(scope): ...`
  - `fix(scope): ...`
  - `chore(scope): ...`
- Jeden commit na jeden zamknięty krok.
- W treści/zakresie commita dodawaj referencję kroku, np. `P5-telemetry-01`.

## Standard testów
- Backend:
  - `docker compose exec -T backend npm run lint`
  - `docker compose exec -T backend npm test`
- Frontend:
  - `docker compose exec -T frontend yarn lint`
  - `docker compose exec -T frontend yarn test`
  - `docker compose exec -T frontend yarn build`
- Stack smoke:
  - `docker compose up --build -d`
  - `docker compose ps`

## Standard E2E browser flow
1. OTP login (user).
2. Create ticket.
3. My tickets.
4. Ticket detail.
5. OTP login (developer).
6. Overview + Board.
7. Status move (Kanban DnD lub status action).
8. DevTodo sync.
9. Close ticket z closure summary (gdy funkcja dostępna).

Szczegółowa checklista: `docs/skills/e2e-browser-baseline.md`.

## Mapa folderów i odpowiedzialności
- `backend/routes/*`: endpointy HTTP + autoryzacja + walidacja request/response mapping.
- `backend/services/*`: logika domenowa i integracje (email, telemetry itp.).
- `backend/tests/*`: testy integracyjne i smoke backendu.
- `frontend/src/pages/*`: widoki aplikacji.
- `frontend/src/components/*`: komponenty współdzielone.
- `frontend/src/contexts/*`: auth/language state.
- `docs/*`: roadmapy, checklisty release, progres prac agentów.

## Skills
- `docs/skills/e2e-browser-baseline.md`
- `docs/skills/telemetry-events.md`
- `docs/skills/closure-summary-flow.md`
- `docs/skills/activation-metrics.md`
- `docs/skills/feature-usage-metrics.md`
- `docs/skills/ticket-closure-guard.md`
