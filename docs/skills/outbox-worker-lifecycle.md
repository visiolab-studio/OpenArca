# Outbox Worker Lifecycle

## Cel
Uruchamiać i weryfikować worker `event_outbox` w sposób bezpieczny: polling, retry, dead-letter i obserwowalność bez regresji RBAC/API.

## Kiedy stosować
- Dodajesz lub zmieniasz logikę dostarczania eventów domenowych.
- Potrzebujesz potwierdzić retry policy i przejścia `pending -> processing -> sent/failed`.
- Diagnozujesz zalegające eventy w outbox.

## Kroki
- [ ] Upewnij się, że feature jest kontrolowany przez ENV:
  - `OUTBOX_WORKER_ENABLED`
  - `OUTBOX_WORKER_POLL_MS`
  - `OUTBOX_WORKER_BATCH_SIZE`
  - `OUTBOX_WORKER_MAX_ATTEMPTS`
  - `OUTBOX_WORKER_PROCESSING_TIMEOUT_MS`
  - `OUTBOX_WORKER_RETRY_BASE_MS`
  - `OUTBOX_WORKER_RETRY_MAX_MS`
- [ ] Zaimplementuj logikę workera jako osobny serwis (`createOutboxWorkerService`), bez logiki HTTP w środku.
- [ ] Obsłuż przebieg:
  - claim due entries (`status='pending'` i `next_attempt_at <= now`)
  - lock `processing`
  - recover stuck `processing` (po timeout) -> `pending`
  - success -> `sent`
  - error transient -> `pending` + `attempts + 1` + `next_attempt_at`
  - error terminal (`attempts >= max`) -> `failed` (dead-letter)
- [ ] Dodaj metryki runtime (`ticks_total`, `processed_total`, `retried_total`, `dead_letter_total`, `last_error`).
- [ ] Wystaw endpoint obserwowalności tylko dla developerów.
- [ ] Dodaj endpoint manualnego ticka workera (`runOnce`) tylko dla developerów.
- [ ] Dodaj testy unit (success/retry/dead-letter/stats) i integration (RBAC + kształt payloadu endpointu).

## Przykłady
```bash
docker compose exec -T backend npm test -- tests/outbox.worker.service.unit.test.js
docker compose exec -T backend npm test -- tests/domain.events.outbox.integration.test.js
```

```bash
curl -s -H "Authorization: Bearer <TOKEN_DEV>" \
  "http://localhost:4000/api/settings/events/outbox/stats"
```

```bash
curl -s -X POST -H "Authorization: Bearer <TOKEN_DEV>" \
  "http://localhost:4000/api/settings/events/outbox/run-once"
```

Oczekiwane pola:
- `generated_at`
- `queue.{total,due_now,oldest_pending_age_seconds,stuck_processing,pending,processing,sent,failed}`
- `runtime.{is_running,ticks_total,processed_total,retried_total,dead_letter_total,recovered_stuck_total,last_error}`
- `config.{poll_ms,batch_size,max_attempts,processing_timeout_ms,retry_base_ms,retry_max_ms}`

## Definition of Done
- [ ] Worker jest domyślnie wyłączony (brak regresji istniejących flow).
- [ ] Recovery stale `processing` działa deterministycznie w testach unit.
- [ ] Retry i dead-letter działają deterministycznie w testach unit.
- [ ] Endpoint statystyk jest chroniony (`401` bez tokena, `403` dla user, `200` dla developer).
- [ ] Endpoint manualnego ticka jest chroniony (`401`/`403`/`200`) i zwraca `summary`.
- [ ] Pełne quality gates przechodzą:
  - backend lint + test
  - frontend lint + test + build
  - smoke flow backend

## Najczęstsze błędy / pułapki
- Worker uruchomiony domyślnie i “czyści” outbox, przez co testy oczekujące `pending` stają się flaky.
- Brak atomowego locka przy claimowaniu (duplikacja przetwarzania).
- Brak recovery dla stale `processing` po restarcie procesu.
- Niekontrolowany wzrost retry delay lub brak limitu prób.
- Brak normalizacji `last_error` (zbyt długie payloady błędu).
- Brak RBAC na endpointach obserwowalności.

## Powiązane pliki w repo
- `backend/services/outbox-worker.js`
- `backend/services/domain-events.js`
- `backend/routes/settings.js`
- `backend/server.js`
- `backend/tests/outbox.worker.service.unit.test.js`
- `backend/tests/domain.events.outbox.integration.test.js`
- `backend/config.js`
