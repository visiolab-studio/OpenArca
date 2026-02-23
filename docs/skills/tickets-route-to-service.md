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
const payload = ticketsService.getTicketExternalReferences({
  ticketId: req.params.id,
  user: req.user
});
return res.json(payload);
```

```js
const payload = ticketsService.createTicketExternalReference({
  ticketId: req.params.id,
  user: req.user,
  payload: req.body
});
return res.status(201).json(payload);
```

```js
ticketsService.deleteTicketExternalReference({
  ticketId: req.params.id,
  refId: req.params.refId,
  user: req.user
});
return res.status(204).send();
```

```js
const payload = ticketsService.getTicketRelatedList({
  ticketId: req.params.id,
  user: req.user
});
return res.json(payload);
```

```js
const result = ticketsService.createTicketRelation({
  ticketId: req.params.id,
  user: req.user,
  payload: req.body
});
return res.status(result.created ? 201 : 200).json(result.items);
```

```js
ticketsService.deleteTicketRelation({
  ticketId: req.params.id,
  relatedTicketId: req.params.relatedId,
  user: req.user
});
return res.status(204).send();
```

```js
const payload = ticketsService.createTicketAttachments({
  ticketId: req.params.id,
  user: req.user,
  files: req.files,
  maxUploadBytesTotal: MAX_UPLOAD_BYTES_TOTAL
});
return res.status(201).json(payload);
```

```js
const result = ticketsService.createTicket({
  user: req.user,
  payload,
  files: req.files
});
return res.status(201).json(getTicket(result.ticketId));
```

```js
const result = ticketsService.createTicketComment({
  ticketId: req.params.id,
  user: req.user,
  payload: req.body
});
return res.status(201).json(result.comment);
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
- Brak walidacji roli `developer` przy write endpointach external references.
- Brak mapowania `external_reference_not_found` na 404 przy DELETE endpointu.
- Rozjechanie widoczności related tickets (developer globalnie, user tylko własne).
- Brak mapowania `related_ticket_not_found` i `ticket_relation_self_ref` przy POST endpointu related.
- Brak mapowania `ticket_relation_not_found` przy DELETE endpointu related.
- Brak ownership guard (`ticket_not_found`/`forbidden`) przy GET endpointu related.
- Brak walidacji `attachments_required`/`attachments_too_large` po migracji upload route.
- Brak walidacji `invalid_parent_comment` i `invalid_closure_summary_visibility` po migracji comments route.
- Brak mapowania `project_not_found` po migracji create ticket route.
- Rozjechanie widoczności komentarzy w detailu (developer wszystkie, user bez internal).
- Brak walidacji kontekstu użytkownika w service.

## Powiązane pliki w repo
- `backend/services/tickets.js`
- `backend/routes/tickets.js`
- `backend/tests/tickets.service.unit.test.js`
