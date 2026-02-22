# Skill: Feature Usage Metrics

## Cel
Utrzymać spójny standard wdrażania metryk użycia funkcji na bazie telemetry events, tak aby decyzje produktowe były oparte o dane 14/30 dni.

## Kiedy stosować
- Dodajesz nowy endpoint usage analytics.
- Rozszerzasz telemetry events o nowe akcje produktowe.
- Potrzebujesz potwierdzić adopcję funkcji po wdrożeniu.

## Kroki (checklista)
- [ ] Zdefiniuj listę eventów objętych metryką i stabilne klucze odpowiedzi API.
- [ ] Dodaj endpoint developer-only (`requireRole("developer")`).
- [ ] Zwracaj komplet danych także dla zerowych wyników (stały kontrakt JSON).
- [ ] Dodaj agregację 30 dni: count/unique users/active days.
- [ ] Dodaj agregację 14 dni: daily breakdown.
- [ ] Dodaj test integracyjny RBAC (`user` -> 403).
- [ ] Dodaj test poprawności agregacji (zasięg czasowy + liczniki).
- [ ] Zaktualizuj `docs/PROGRESS.md` i podlinkuj skill.

## Przykłady
Endpoint:
- `GET /api/tickets/stats/usage`

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
- [ ] Endpoint zwraca metryki dla każdego eventu (również przy 0 zdarzeń).
- [ ] RBAC jest poprawny i przetestowany.
- [ ] Testy backend/frontend/build przechodzą.
- [ ] Smoke E2E baseline działa bez regresji.

## Najczęstsze błędy / pułapki
- Brak filtrowania okna czasowego (`-30 days`, `-14 days`).
- Niestabilny kształt odpowiedzi (brak klucza przy zerach).
- Liczenie coverage bez uwzględnienia zdarzeń spoza listy eventów.
- Brak obsługi `NULL user_id` przy `COUNT(DISTINCT user_id)`.

## Powiązane pliki w repo
- `backend/routes/tickets.js`
- `backend/services/telemetry.js`
- `backend/tests/usage.stats.integration.test.js`
- `docs/PROGRESS.md`

## Manual test UI/API
- Zaloguj się jako developer i wywołaj `GET /api/tickets/stats/usage`.
- Oczekiwany rezultat: status `200`.
- Oczekiwany rezultat: pola `events`, `totals`, `daily_breakdown_14d`, `known_events_coverage_30d`.
