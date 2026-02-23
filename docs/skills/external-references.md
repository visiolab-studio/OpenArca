# Skill: Ticket External References

## Cel
Dodać do zgłoszeń linki operacyjne (PR, deployment, monitoring), które wspierają realizację i debug.

## Kiedy stosować
- Wdrażasz `external references` w TicketDetail.
- Chcesz powiązać ticket z PR-em, wdrożeniem lub monitoringiem.
- Naprawiasz bugi RBAC/ownership dla linków zewnętrznych.

## Kroki (checklista)
- [ ] Dodaj tabelę `ticket_external_references` (`ticket_id`, `ref_type`, `url`, `title`, `created_by`).
- [ ] Dodaj endpointy:
  - `GET /api/tickets/:id/external-references`
  - `POST /api/tickets/:id/external-references` (developer-only)
  - `DELETE /api/tickets/:id/external-references/:refId` (developer-only)
- [ ] Waliduj `ref_type` (`git_pr`, `deployment`, `monitoring`, `other`).
- [ ] Waliduj URL: tylko `http://` i `https://`.
- [ ] Rozszerz `GET /api/tickets/:id` o `external_references`.
- [ ] Dodaj sekcję UI z listą + formularzem add/remove w `TicketDetail`.
- [ ] Dodaj tłumaczenia błędów i etykiet.

## Przykłady
Payload create:
```json
{
  "ref_type": "git_pr",
  "url": "https://github.com/org/repo/pull/123",
  "title": "PR #123"
}
```

Komendy:
```bash
docker compose exec -T backend npm test
docker compose exec -T frontend yarn build
```

## Definition of Done
- [ ] Developer może dodać/usunąć referencję.
- [ ] User nie może mutować referencji (`403`).
- [ ] User może odczytać referencje tylko dla dostępnych ticketów.
- [ ] `TicketDetail` pokazuje listę referencji i poprawnie otwiera linki.
- [ ] Testy integracyjne + smoke E2E przechodzą.

## Najczęstsze błędy / pułapki
- Brak walidacji protokołu URL (np. `ftp://`).
- Brak RBAC na endpointach write.
- Brak filtrowania ownership przy odczycie dla usera.
- Niespójność danych między endpointem szczegółu ticketu i osobnym endpointem references.

## Powiązane pliki w repo
- `backend/db.js`
- `backend/routes/tickets.js`
- `backend/tests/api.integration.test.js`
- `frontend/src/pages/TicketDetail.jsx`
- `frontend/src/api/tickets.js`
- `frontend/src/i18n/pl.json`
- `frontend/src/i18n/en.json`
- `docs/PROGRESS.md`

## Manual test
- Jako developer dodaj referencję `git_pr` w `TicketDetail`, odśwież stronę, kliknij link i usuń referencję.
- Oczekiwany rezultat: link działa, a po usunięciu znika z listy bez błędów.
