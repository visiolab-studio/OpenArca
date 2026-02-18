# EdudoroIT_SupportCenter - TODO wykonawcze

## Status projektu
- [x] Rebranding specyfikacji: `TaskFlow` -> `EdudoroIT_SupportCenter` w `AGENT.md`.
- [x] Bootstrap kodu aplikacji (backend + frontend + kontenery).

## P0 - Fundament i bezpieczeństwo (blokujące)
- [x] Utworzyć strukturę repo zgodną z `AGENT.md` (`backend/`, `frontend/`, `uploads/`, i18n, routes).
- [x] Dodać `docker-compose.yml` dla `backend`, `frontend`, `mailpit`.
- [x] Dodać `backend/Dockerfile` i `frontend/Dockerfile` z uruchamianiem jako non-root.
- [x] Dodać `.env.example` z kompletem zmiennych (JWT, SMTP, URL-e, porty).
- [x] Dodać centralny mechanizm walidacji wejścia (body/query/params/files).
- [x] Dodać globalny middleware błędów (spójny format odpowiedzi, brak wycieku danych).
- [x] Dodać ograniczenia bezpieczeństwa: rate-limit dla OTP, limity uploadu, CORS, nagłówki HTTP.

Kryteria akceptacji P0:
- `docker compose up --build` uruchamia cały stack lokalny (przy zajętych portach Mailpit: `MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026`).
- Aplikacja nie działa na procesach root.
- Brak endpointów bez walidacji i bez autoryzacji tam, gdzie wymagane.

## P1 - Backend MVP zgodny ze specyfikacją
- [x] Zaimplementować `db.js` i inicjalizację wszystkich tabel + ustawień domyślnych.
- [x] Zaimplementować OTP auth flow (`request-otp`, `verify-otp`, `me`, `PATCH me`).
- [x] Zaimplementować RBAC middleware (`user`, `developer`) i ownership checks.
- [x] Zaimplementować endpointy ticketów, komentarzy, uploadów i historii zmian.
- [x] Zaimplementować endpointy `projects`, `dev-tasks`, `users`, `settings`.
- [x] Zaimplementować serwis email z fallbackiem dev (Mailpit/logi).

Kryteria akceptacji P1:
- Wszystkie endpointy z `AGENT.md` odpowiadają zgodnie z kontraktem.
- `ticket_history` zapisuje każdą zmianę pól śledzonych.
- Powiadomienia email wysyłane tylko dla triggerów z dokumentu.

## P2 - Frontend MVP i i18n
- [x] Zaimplementować shell aplikacji: routing, `AuthContext`, `LanguageContext`, axios instance.
- [x] Zaimplementować `Login` z OTP i przełącznikiem PL/EN.
- [x] Zaimplementować widoki: `Dashboard`, `NewTicket`, `MyTickets`, `TicketDetail`, `Overview`.
- [x] Zaimplementować walidacje formularza zgłoszenia zależne od kategorii.
- [x] Zaimplementować tłumaczenia `pl.json`, `en.json` dla pełnego UI.

Kryteria akceptacji P2:
- Brak brakujących kluczy i18n na głównych ścieżkach.
- User widzi tylko własne tickety i tylko publiczne komentarze.
- Formularz nie pozwala wysłać zbyt ubogiego zgłoszenia.

## P3 - Moduły developer
- [ ] Zaimplementować `Board` (Kanban) z drag-and-drop i zmianą statusu.
- [ ] Zaimplementować `DevTodo` z ręcznym reorderem i auto-sortowaniem.
- [ ] Zaimplementować `Admin` (ustawienia app, SMTP test, projekty, użytkownicy).
- [ ] Dodać alerty dashboardowe (przeterminowane, bez priorytetu, bez daty planu).

Kryteria akceptacji P3:
- Trasy developer-only są niedostępne dla `user`.
- Auto-sort TODO działa według priorytet + planned_date + status + blocked.

## P4 - Testy, jakość, gotowość release
- [ ] Dodać testy backend (auth, RBAC, ticket lifecycle, upload security).
- [ ] Dodać testy frontend (guardy, walidacje formularzy, widoczność elementów wg roli).
- [ ] Dodać smoke e2e dla głównego flow user->developer->user.
- [ ] Dodać CI quality gates: lint, test, build.
- [ ] Dodać checklistę release i rollback.

Kryteria akceptacji P4:
- Wszystkie quality gates przechodzą na czystym środowisku.
- Krytyczne flow jest pokryte testami automatycznymi.

## Rejestr decyzji technicznych (potwierdzone)
- [x] Biblioteka DnD: `@dnd-kit`.
- [x] Minimalna wersja Node.js: `20 LTS`.
- [x] CI od startu: `GitHub Actions`.
