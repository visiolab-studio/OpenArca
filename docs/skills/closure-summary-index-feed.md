# Skill: Closure Summary Index Feed

## Cel
Udostępnić stabilny feed closure summaries pod indexowanie AI/search bez naruszania RBAC i prywatności.

## Kiedy stosować
- Budujesz integrację AI recall lub wyszukiwarkę podobnych incydentów.
- Potrzebujesz eksportu najnowszych podsumowań zamknięcia na ticket.
- Chcesz walidować jakość danych przed pipeline indexing.

## Kroki (checklista)
- [ ] Dodaj endpoint: `GET /api/tickets/closure-summaries/index-feed` (developer-only).
- [ ] Zwracaj tylko publiczne closure summaries (`is_closure_summary=1`, `is_internal=0`).
- [ ] Dla każdego ticketa zwracaj tylko najnowsze closure summary.
- [ ] Dodaj query: `limit` (1..500), `updated_since` (ISO datetime).
- [ ] Dodaj metadane dokumentu: `index_key`, `ticket_*`, `summary_*`.
- [ ] Dodaj test RBAC (user -> 403) i test poprawności payloadu.
- [ ] Dodaj test filtra `updated_since`.

## Przykłady
Zapytanie:
```bash
curl -H "Authorization: Bearer <DEV_TOKEN>" \
  "http://localhost:4000/api/tickets/closure-summaries/index-feed?limit=200&updated_since=2026-02-01T00:00:00Z"
```

Przykładowy rekord:
```json
{
  "index_key": "ticket:<ticket_id>:summary:<comment_id>",
  "summary_content": "...",
  "ticket_status": "closed"
}
```

## Definition of Done
- [ ] Endpoint działa tylko dla roli `developer`.
- [ ] Feed nie zawiera komentarzy internal.
- [ ] Feed zwraca najnowsze closure summary per ticket.
- [ ] `limit` i `updated_since` działają poprawnie.
- [ ] Testy backend + smoke E2E przechodzą.

## Najczęstsze błędy / pułapki
- Pobieranie wszystkich summary zamiast najnowszego na ticket.
- Brak filtra `is_internal = 0`.
- Brak stabilnego `index_key` do idempotentnego indeksowania.
- Brak limitu i ryzyko zbyt ciężkiego zapytania.

## Powiązane pliki w repo
- `backend/routes/tickets.js`
- `backend/tests/closure.summary.feed.integration.test.js`
- `docs/PROGRESS.md`

## Manual test
- Wywołaj endpoint feedu jako developer i sprawdź, czy rekordy zawierają `index_key` oraz `summary_content`.
- Oczekiwany rezultat: listę można bezpośrednio podać do pipeline indeksowania.
