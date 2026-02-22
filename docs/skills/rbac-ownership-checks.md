# Skill: RBAC Ownership Checks

## Cel
Utrzymać brak regresji bezpieczeństwa w endpointach write poprzez cykliczny audyt RBAC (`user` vs `developer`) i ownership (zasoby własne vs cudze).

## Kiedy stosować
- Dodajesz/zmieniasz endpointy write.
- Modyfikujesz middleware auth/role.
- Naprawiasz błąd związany z uprawnieniami.

## Kroki (checklista)
- [ ] Sprawdź endpointy developer-only: `projects`, `settings`, `users`, `dev-tasks`.
- [ ] Sprawdź ownership ticketów: user nie modyfikuje cudzego zgłoszenia.
- [ ] Sprawdź komentarze internal/closure summary: user nie może ich ustawiać.
- [ ] Dodaj testy negatywne (`403/404/400`) i pozytywne (dozwolone akcje developera).
- [ ] Uruchom pełny zestaw testów + smoke E2E.

## Przykłady
Scenariusze:
- `POST /api/projects` jako user -> `403`.
- `PATCH /api/settings` jako user -> `403`.
- `PATCH /api/users/:id` jako user -> `403`.
- `PATCH /api/tickets/:id` przez obcego usera -> `403`.
- `POST /api/tickets/:id/comments { is_internal: true }` jako user -> `403`.

Komendy:
```bash
docker compose up --build -d
docker compose exec -T backend npm run lint
docker compose exec -T backend npm test
docker compose exec -T frontend yarn lint
docker compose exec -T frontend yarn test
docker compose exec -T frontend yarn build
```

## Definition of Done
- [ ] Jest dedykowany test audytu RBAC/ownership.
- [ ] Wszystkie endpointy write z audytu mają test negatywny.
- [ ] Brak regresji flow user/developer po zmianach.

## Najczęstsze błędy / pułapki
- Testowanie tylko ścieżki pozytywnej.
- Brak scenariusza „cudzy zasób” (ownership).
- Zwracanie 200 przy pominiętym middleware `requireRole`.
- Poleganie wyłącznie na walidacji frontendowej.

## Powiązane pliki w repo
- `backend/tests/rbac.ownership.audit.integration.test.js`
- `backend/middleware/auth.js`
- `backend/routes/tickets.js`
- `backend/routes/projects.js`
- `backend/routes/settings.js`
- `backend/routes/users.js`
- `docs/PROGRESS.md`

## Manual test UI/API
- Zaloguj się jako zwykły user i spróbuj wykonać akcję developer-only.
- Oczekiwany rezultat: błąd `403 forbidden`.
