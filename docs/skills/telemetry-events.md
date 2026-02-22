# Skill: Telemetry Events

## Cel
Spójnie dodawać i weryfikować eventy telemetryczne bez regresji biznesowego flow.

## Kiedy stosować
- Dodajesz nowy event produktowy.
- Podpinasz telemetry pod istniejący endpoint/akcję.
- Potrzebujesz danych usage/activation do decyzji produktowych.

## Kroki (checklista)
- [ ] Zdefiniuj nazwę eventu i payload (minimalny, stabilny kontrakt).
- [ ] Dodaj zapis eventu w serwisie telemetry (best-effort, bez blokowania flow).
- [ ] Podłącz event tylko w miejscu biznesowego sukcesu (po udanej operacji).
- [ ] Dodaj test integracyjny potwierdzający zapis eventu.
- [ ] Sprawdź, że brak eventu nie psuje głównej akcji.
- [ ] Uzupełnij `docs/PROGRESS.md` o zakres telemetry i wyniki.

## Przykłady
Komendy:
```bash
docker compose exec -T backend npm test
docker compose exec -T backend npm run lint
```

Przykładowe eventy:
- `ticket.created`
- `ticket.closed`
- `board.drag`
- `devtodo.reorder`
- `closure_summary_added`

## Definition of Done
- [ ] Event zapisuje się w DB z poprawnym `event_name`, `user_id`, `ticket_id`.
- [ ] Payload jest znormalizowany (bez wartości nie-serializowalnych).
- [ ] Testy backendowe przechodzą.
- [ ] Brak regresji RBAC/ownership i flow ticketów.

## Najczęstsze błędy / pułapki
- Emisja eventu przed potwierdzonym sukcesem transakcji.
- Zbyt duży lub niestabilny payload eventu.
- Telemetria rzuca wyjątek i psuje główny endpoint.
- Brak testu weryfikującego eventy dla krytycznych statusów.

## Powiązane pliki w repo
- `backend/services/telemetry.js`
- `backend/routes/tickets.js`
- `backend/routes/devTasks.js`
- `backend/db.js`
- `backend/tests/api.integration.test.js`
- `docs/PROGRESS.md`

## Dodatkowy check UI (Kanban)
- Wykonaj drag ticketu między kolumnami na `/board`.
- Oczekiwany rezultat:
  - status ticketu się zmienia,
  - ticket pojawia się w nowej kolumnie po odświeżeniu.
- Po stronie backend telemetry powinno pojawić się `board.drag`.
