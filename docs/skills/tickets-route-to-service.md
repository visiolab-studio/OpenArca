# Skill: Tickets Route To Service

## Cel
Przenieść logikę endpointów ticketowych do service layer bez zmiany kontraktu API.

## Kiedy stosować
- Przy refaktorze route `GET /api/tickets`.
- Przy refaktorze route `GET /api/tickets/board`.
- Przy refaktorze route `GET /api/tickets/workload`.
- Przy refaktorze route `GET /api/tickets/stats/overview`.
- Przy refaktorze route `GET /api/tickets/stats/activation`.
- Przy refaktorze route `GET /api/tickets/stats/usage`.
- Przy refaktorze route `GET /api/tickets/closure-summaries/index-feed`.
- Przy refaktorze route `GET /api/tickets/:id/external-references`.
- Przy refaktorze route `GET /api/tickets/:id/related`.
- Przy refaktorze route `GET /api/tickets/:id` (szczegóły zgłoszenia).
- Przy przygotowaniu override logic przez Open/Enterprise engine split.

## Kroki
- [ ] Dodaj `ticketsService.listTickets({ user, query })` w `backend/services/tickets.js`.
- [ ] Dodaj dedykowaną metodę service dla endpointu (np. `listTickets`, `getWorkload`).
- [ ] W route zostaw tylko walidację + auth + wywołanie service + `res.json`.
- [ ] Zachowaj regułę RBAC:
  - user widzi tylko swoje,
  - developer globalnie, chyba że `my=1`.
- [ ] Utrzymaj parametry filtrów oraz pola payloadu endpointu.
- [ ] Dodaj testy unit service + zostaw testy integracyjne endpointu.

## Przykłady
```js
const rows = ticketsService.listTickets({
  user: req.user,
  query: req.query
});
return res.json(rows);
```

```js
const payload = ticketsService.getBoard();
return res.json(payload);
```

```js
const payload = ticketsService.getWorkload({
  user: req.user
});
return res.json(payload);
```

```js
const payload = ticketsService.getOverviewStats();
return res.json(payload);
```

```js
const payload = ticketsService.getActivationStats();
return res.json(payload);
```

```js
const payload = ticketsService.getUsageStats();
return res.json(payload);
```

```js
const payload = ticketsService.getClosureSummaryIndexFeed({
  limit: req.query.limit ?? 200,
  updatedSince: req.query.updated_since || null
});
return res.json(payload);
```

```js
const ticket = ticketsService.getTicketById({ ticketId: req.params.id });
ensureTicketAccess(ticket, req.user);
return res.json(ticketsService.getExternalReferences({ ticketId: req.params.id }));
```

```js
const ticket = ticketsService.getTicketById({ ticketId: req.params.id });
ensureTicketAccess(ticket, req.user);
return res.json(ticketsService.getRelatedTickets({ ticketId: req.params.id, user: req.user }));
```

```js
const payload = ticketsService.getTicketDetail({
  ticketId: req.params.id,
  user: req.user
});
return res.json(payload);
```

## Definition of Done
- [ ] Route jest cienki i nie trzyma logiki SQL.
- [ ] Payload endpointu nie zmienia się.
- [ ] Testy unit + integracyjne + smoke E2E przechodzą.

## Najczęstsze błędy / pułapki
- Utrata filtra `my=1` dla roli developer.
- Utrata bucketów Kanban lub błędne `_stats` dla board.
- Zmiana kolejności/warunków filtrów i rozjechanie wyników.
- Utrata mapowania kolejek workload (`in_progress`, `queue`, `blocked`, `submitted`).
- Rozjechanie licznika `closed_today` lub brak fallbacku zer dla statystyk overview.
- Rozjechanie wyliczeń activation metrics (pierwszy ticket / pierwsze przypisanie / <=30m).
- Rozjechanie metryk usage (coverage 30d + timeline 14d).
- Rozjechanie mapowania feedu closure summary (publiczne podsumowania + updated_since).
- Rozjechanie listy external references lub utrata ownership check przed odczytem.
- Rozjechanie widoczności related tickets (developer globalnie, user tylko własne).
- Rozjechanie widoczności komentarzy w detailu (developer wszystkie, user bez internal).
- Brak walidacji kontekstu użytkownika w service.

## Powiązane pliki w repo
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
