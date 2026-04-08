# Email Notification Preferences

## Cel
Dodać i utrzymać bezpieczne preferencje mailowe per user dla zdarzeń niekrytycznych, przy stałej regule: OTP/logowanie zawsze aktywne.

## Kiedy stosować
- Gdy dodajesz nowe maile produktowe (statusy, komentarze, digesty) i mają być opcjonalne.
- Gdy rozszerzasz profil użytkownika o ustawienia powiadomień.
- Gdy zmieniasz logikę wysyłki w `notifications.js`.

## Kroki (checklista)
- Dodać kolumny preferencji do `users` z domyślną wartością `1`.
- Dodać migrację `ALTER TABLE` dla istniejących baz.
- Rozszerzyć `GET /api/auth/me` o flagi jako `boolean`.
- Rozszerzyć `PATCH /api/auth/me` o walidację i zapis flag.
- W `backend/services/notifications.js` sprawdzać flagę usera przed `sendEmail`.
- Nie dodawać żadnej flagi dla OTP.
- Dodać test integracyjny API dla odczytu/zapisu preferencji.

## Przykłady
```json
PATCH /api/auth/me
{
  "email_notify_ticket_status": false,
  "email_notify_developer_comment": true
}
```

```js
if (!reporter.email_notify_ticket_status) {
  return { sent: false, reason: "ticket_status_disabled_by_user" };
}
```

## Definition of Done
- `GET /api/auth/me` zwraca oba pola preferencji jako `true/false`.
- `PATCH /api/auth/me` poprawnie zapisuje flagi.
- Wysyłka status/comment respektuje flagi użytkownika.
- OTP działa bez zmian i nie ma opcji wyłączenia.
- Testy backend + frontend + build przechodzą.

## Najczęstsze błędy / pułapki
- Zwracanie `0/1` zamiast `boolean` w API.
- Dodanie opcji wyłączenia OTP przez pomyłkę.
- Pominięcie migracji dla istniejących baz.
- Brak sprawdzenia flags w jednym z kanałów mailowych.

## Powiązane pliki w repo
- `backend/db.js`
- `backend/routes/auth.js`
- `backend/services/notifications.js`
- `backend/tests/api.integration.test.js`
- `frontend/src/pages/Profile.jsx`
