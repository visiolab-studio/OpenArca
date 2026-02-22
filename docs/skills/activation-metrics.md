# Skill: Activation Metrics

## Cel
Wdrożyć i zweryfikować metryki aktywacji produktu, które pomagają mierzyć szybkość wejścia użytkownika w realny flow pracy z IT.

## Kiedy stosować
- Dodajesz endpoint/metryki dla aktywacji (`time-to-first-*`).
- Potrzebujesz danych do KPI z roadmapy (`<15 min`, milestone `<30 min`).
- Weryfikujesz regresję RBAC dla danych analitycznych.

## Kroki (checklista)
- [ ] Ustal definicje metryk i source of truth (tabele + pola czasu).
- [ ] Dodaj endpoint read-only dla developera (`requireRole("developer")`).
- [ ] Licz metryki null-safe (braki danych nie mogą wywalać endpointu).
- [ ] Dodaj test integracyjny: RBAC + poprawny kształt odpowiedzi + wartości.
- [ ] Zaktualizuj `docs/PROGRESS.md` o wynik i zakres.

## Przykłady
Komendy:
```bash
docker compose exec -T backend npm run lint
docker compose exec -T backend npm test
```

Przykładowy endpoint:
- `GET /api/tickets/stats/activation` (developer-only)

## Definition of Done
- [ ] Endpoint zwraca stabilny JSON z metrykami aktywacji.
- [ ] Brak dostępu dla roli `user` (403).
- [ ] Metryki mają poprawne próbki (`sample_size`) i wartości liczbowe lub `null`.
- [ ] Testy backend/frontend/build przechodzą.

## Najczęstsze błędy / pułapki
- Mieszanie stref czasowych i błędne różnice minut.
- Liczenie metryk na niezweryfikowanych danych (np. puste `assignee_id`).
- Brak ochrony RBAC dla endpointu analitycznego.
- Dzielenie przez 0 przy pustych próbkach.

## Powiązane pliki w repo
- `backend/routes/tickets.js`
- `backend/tests/activation.stats.integration.test.js`
- `docs/PROGRESS.md`

## Test bezpieczeństwa (RBAC)
- Wywołaj endpoint jako `user`: oczekiwane `403 forbidden`.
- Wywołaj endpoint jako `developer`: oczekiwane `200` i poprawne metryki.
