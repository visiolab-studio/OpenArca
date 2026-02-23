# Skill: Related Tickets Linking

## Cel
Dodać bezpieczne powiązania między zgłoszeniami, aby łatwo nawigować po zależnych problemach.
Wersja MVP: relacja typu `related` z pełnym RBAC i filtrem widoczności.

## Kiedy stosować
- Wdrażasz funkcję `related tickets` w backendzie i UI.
- Rozszerzasz `TicketDetail` o kontekst powiązanych zgłoszeń.
- Naprawiasz błędy duplikacji, self-linków lub wycieku danych między reporterami.

## Kroki (checklista)
- [ ] Dodaj tabelę `ticket_relations` + indeks unikalny pary (`ticket_id_a`, `ticket_id_b`).
- [ ] Normalizuj parę relacji (zawsze ten sam porządek ID), by blokować duplikaty.
- [ ] Dodaj endpointy:
  - `GET /api/tickets/:id/related`
  - `POST /api/tickets/:id/related` (developer-only)
  - `DELETE /api/tickets/:id/related/:relatedId` (developer-only)
- [ ] Zablokuj self-link (`ticket_relation_self_ref`).
- [ ] Przy odczycie dla `user` filtruj tylko tickety, do których ma ownership.
- [ ] Rozszerz `GET /api/tickets/:id` o `related_tickets`.
- [ ] Dodaj UI sekcję w `TicketDetail` (lista + add/remove dla developera).

## Przykłady
Payload create:
```json
{ "related_ticket_number": 123 }
```

Komendy:
```bash
docker compose exec -T backend npm test
docker compose exec -T frontend yarn test
```

## Definition of Done
- [ ] Developer może dodać i usunąć relację.
- [ ] User nie może mutować relacji (`403`).
- [ ] User widzi tylko powiązania do ticketów, które może otworzyć.
- [ ] Brak duplikatów tej samej relacji i brak self-link.
- [ ] `TicketDetail` wyświetla aktualne relacje bez regresji UI.

## Najczęstsze błędy / pułapki
- Brak normalizacji pary relacji (`A-B` vs `B-A`) i duplikaty.
- Brak filtra ownership przy `GET related` dla usera.
- Przyjęcie obu pól naraz (`related_ticket_id` i `related_ticket_number`) bez walidacji.
- Niespójność między `GET /:id/related` a `GET /:id` (inne źródło danych).

## Powiązane pliki w repo
- `backend/db.js`
- `backend/routes/tickets.js`
- `backend/tests/api.integration.test.js`
- `frontend/src/api/tickets.js`
- `frontend/src/pages/TicketDetail.jsx`
- `frontend/src/i18n/pl.json`
- `frontend/src/i18n/en.json`
- `docs/PROGRESS.md`

## Manual test
- Wejdź na `TicketDetail` jako developer, dodaj relację po numerze ticketa i odśwież widok.
- Oczekiwany rezultat: relacja widoczna na liście, możliwa do otwarcia i usunięcia.
