# Skill: Tickets Route To Service

## Cel
Przenieść logikę endpointu listowania ticketów do service layer bez zmiany kontraktu API.

## Kiedy stosować
- Przy refaktorze route `GET /api/tickets`.
- Przy przygotowaniu override logic przez Open/Enterprise engine split.

## Kroki
- [ ] Dodaj `ticketsService.listTickets({ user, query })` w `backend/services/tickets.js`.
- [ ] W route zostaw tylko walidację + auth + wywołanie service + `res.json`.
- [ ] Zachowaj regułę RBAC:
  - user widzi tylko swoje,
  - developer globalnie, chyba że `my=1`.
- [ ] Utrzymaj parametry filtrów (`status`, `priority`, `category`, `project_id`).
- [ ] Dodaj testy unit service + zostaw testy integracyjne endpointu.

## Przykłady
```js
const rows = ticketsService.listTickets({
  user: req.user,
  query: req.query
});
return res.json(rows);
```

## Definition of Done
- [ ] Route jest cienki i nie trzyma logiki SQL.
- [ ] Payload endpointu nie zmienia się.
- [ ] Testy unit + integracyjne + smoke E2E przechodzą.

## Najczęstsze błędy / pułapki
- Utrata filtra `my=1` dla roli developer.
- Zmiana kolejności/warunków filtrów i rozjechanie wyników.
- Brak walidacji kontekstu użytkownika w service.

## Powiązane pliki w repo
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
