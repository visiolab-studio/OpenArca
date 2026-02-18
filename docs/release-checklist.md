# EdudoroIT_SupportCenter - Release Checklist & Rollback

## Release Checklist

1. Zweryfikuj branch release:
   - `main` jest zmergowany i aktualny.
   - Brak niezatwierdzonych zmian (`git status` czyste).

2. Sprawdź quality gates lokalnie (Node 20 / kontener):
   - `docker compose exec -T backend npm run lint`
   - `docker compose exec -T backend npm test`
   - `docker compose exec -T frontend npm run lint`
   - `docker compose exec -T frontend npm test`
   - `docker compose exec -T frontend npm run build`

3. Zweryfikuj konfigurację środowiska:
   - Uzupełnione sekrety (`JWT_SECRET`, SMTP, URL-e).
   - Poprawne porty (`MAILPIT_SMTP_PORT`, `MAILPIT_UI_PORT`) dla środowiska lokalnego.

4. Manual smoke check po starcie stacka:
   - Logowanie OTP (user i developer).
   - Utworzenie ticketa + komentarz + zmiana statusu.
   - Dostępność `/health` oraz frontendu.

5. Oznacz release:
   - Tag semver (`vX.Y.Z`).
   - Notatka release z listą zmian i ewentualnych migracji.

## Rollback Plan

1. Identyfikuj ostatni stabilny tag:
   - `git tag --sort=-creatordate | head`

2. Przywróć stabilną wersję kodu:
   - `git checkout <stable-tag>`
   - `docker compose up --build -d`

3. Jeśli rollback wymaga przywrócenia danych:
   - Odtwórz snapshot wolumenów `backend_data` i `backend_uploads`.

4. Weryfikacja po rollbacku:
   - `/health` zwraca `status: ok`.
   - Krytyczny flow user -> developer -> user działa.

5. Post-incident:
   - Zapisz przyczynę, impact i akcje naprawcze.
