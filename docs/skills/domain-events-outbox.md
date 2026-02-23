# Skill: Domain Events + Outbox

## Cel
Wprowadzić trwały backbone eventów domenowych z outboxem, tak aby zdarzenia były niezależne od HTTP i gotowe do bezpiecznego przetwarzania przez worker.

## Kiedy stosować
- Przy wdrażaniu P6B (event backbone).
- Gdy dodajesz nowe zdarzenie domenowe (`ticket.*`, `task.*`).
- Gdy potrzebujesz gwarancji zapisu zdarzenia przed asynchronicznym przetwarzaniem.

## Kroki (checklista)
- [ ] Dodaj/utrzymaj tabele:
  - `domain_events`
  - `event_outbox`
- [ ] W serwisie publikacji zapisuj event i outbox w jednej transakcji.
- [ ] Waliduj minimalny kontrakt eventu:
  - `event_name`
  - `aggregate_type`
  - `aggregate_id`
- [ ] Dodaj endpoint diagnostyczny tylko dla deva (read-only), np. podgląd outbox.
- [ ] Dodaj testy:
  - unit publish,
  - unit walidacji,
  - integration RBAC + read endpoint.

## Przykłady
```js
const result = domainEventsService.publishDomainEvent({
  eventName: "ticket.created",
  aggregateType: "ticket",
  aggregateId: ticketId,
  actorUserId: user.id,
  payload: { status: "submitted" }
});
```

```js
const outbox = domainEventsService.getOutboxEntries({ status: "pending", limit: 100 });
```

## Definition of Done
- [ ] Event i outbox zapisują się atomowo.
- [ ] Endpoint podglądu outbox ma RBAC (`developer` only).
- [ ] Testy backend i smoke E2E przechodzą.
- [ ] Brak regresji istniejących flow ticketów.

## Najczęstsze błędy / pułapki
- Zapis eventu bez outbox (lub odwrotnie) poza transakcją.
- Brak walidacji `event_name`/aggregate reference.
- Brak indeksu po `status,next_attempt_at` dla outbox.
- Endpoint diagnostyczny dostępny dla zwykłego usera.

## Powiązane pliki w repo
- `backend/services/domain-events.js`
- `backend/db.js`
- `backend/routes/settings.js`
- `backend/tests/domain.events.service.unit.test.js`
- `backend/tests/domain.events.outbox.integration.test.js`
