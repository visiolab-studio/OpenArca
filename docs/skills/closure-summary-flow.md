# Skill: Closure Summary Flow

## Cel
Zapewnić spójne domknięcie zadania/ticketu z komentarzem podsumowującym oraz poprawnym śladem telemetrycznym.

## Kiedy stosować
- Rozwijasz flow finalizacji zadań developerskich.
- Dodajesz analitykę jakości zamknięcia zgłoszeń.
- Wymagasz danych pod future AI knowledge recall.

## Kroki (checklista)
- [ ] Oznacz komentarz finalizacyjny jako `is_closure_summary=true`.
- [ ] Wymuś ograniczenia roli (tylko developer może ustawić flagę).
- [ ] Zablokuj wewnętrzne closure summary (`is_internal=true` niepoprawne).
- [ ] Zapisz flagę przy komentarzu w DB.
- [ ] Emituj telemetry event `closure_summary_added`.
- [ ] Pokryj testami: pozytywny flow + negatywny RBAC.

## Przykłady
Request:
```json
POST /api/tickets/:id/comments
{
  "content": "Podsumowanie realizacji...",
  "is_closure_summary": true
}
```

Spodziewany event:
- `closure_summary_added`
- `ticket_id`
- `user_id`
- `properties.comment_id`

## Definition of Done
- [ ] Developer może dodać closure summary.
- [ ] User nie może dodać closure summary (403).
- [ ] Event `closure_summary_added` istnieje po akcji.
- [ ] Flow zamknięcia ticketu działa bez regresji.

## Najczęstsze błędy / pułapki
- Brak walidacji roli dla flagi closure summary.
- Event telemetry emitowany bez zapisanego komentarza.
- Brak rozróżnienia komentarza zwykłego i closure summary.

## Powiązane pliki w repo
- `backend/routes/tickets.js`
- `backend/db.js`
- `backend/tests/api.integration.test.js`
- `frontend/src/pages/DevTodo.jsx`
- `backend/services/telemetry.js`
- `docs/PROGRESS.md`
