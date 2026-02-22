# Skill: Ticket Closure Guard

## Cel
Wymusić bezpieczne i audytowalne zamykanie ticketów: status `closed` jest dozwolony tylko po dodaniu publicznego `closure summary`.

## Kiedy stosować
- Zmieniasz flow zamykania ticketu (`PATCH /api/tickets/:id`).
- Modyfikujesz logikę komentarzy i flagi `is_closure_summary`.
- Naprawiasz regresję, w której ticket zamyka się bez podsumowania.

## Kroki (checklista)
- [ ] Wykryj transition do `closed` (`old_status !== closed` i `new_status === closed`).
- [ ] Sprawdź istnienie komentarza:
- `is_closure_summary = 1`,
- `is_internal = 0`,
- dla bieżącego `ticket_id`.
- [ ] Jeśli brak komentarza: zwróć `400` + kod błędu `closure_summary_required`.
- [ ] Dodaj test integracyjny:
- próba zamknięcia bez summary -> `400`,
- po dodaniu summary -> `200`.
- [ ] Zabezpiecz testy regresyjne, które wcześniej zamykały ticket bez summary.

## Przykłady
Scenariusz API:
1. `PATCH /api/tickets/:id { status: "verified" }`
2. `PATCH /api/tickets/:id { status: "closed" }` -> `400 closure_summary_required`
3. `POST /api/tickets/:id/comments { content, is_closure_summary: true }`
4. `PATCH /api/tickets/:id { status: "closed" }` -> `200`

Komendy walidacyjne:
```bash
docker compose up --build -d
docker compose exec -T backend npm run lint
docker compose exec -T backend npm test
docker compose exec -T frontend yarn lint
docker compose exec -T frontend yarn test
docker compose exec -T frontend yarn build
```

## Definition of Done
- [ ] Nie można zamknąć ticketu bez closure summary.
- [ ] Można zamknąć ticket po dodaniu closure summary.
- [ ] Testy integracyjne i smoke E2E przechodzą.
- [ ] Brak regresji RBAC/ownership.

## Najczęstsze błędy / pułapki
- Sprawdzanie dowolnego komentarza zamiast `is_closure_summary`.
- Dopuszczenie `is_internal = 1` jako closure summary.
- Walidacja tylko w UI bez ochrony backendu.
- Brak aktualizacji istniejących testów lifecycle.

## Powiązane pliki w repo
- `backend/routes/tickets.js`
- `backend/tests/api.integration.test.js`
- `frontend/src/pages/DevTodo.jsx`
- `docs/PROGRESS.md`

## Manual test UI/API
- Jako developer spróbuj zamknąć ticket bez closure summary.
- Oczekiwany rezultat: backend zwraca `400` z `closure_summary_required`.
