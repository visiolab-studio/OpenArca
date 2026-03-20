# Skill: Ticket Templates Backend

## Cel
Dodać backendowy fundament dla szablonów zgłoszeń (`ticket templates`) z RBAC, fallbackiem globalnym/projektowym i kontraktem gotowym pod panel admina oraz formularz `New Ticket`.

## Kiedy stosować
- Gdy wdrażasz szablony intake dla zgłoszeń.
- Gdy potrzebujesz endpointów konfiguracyjnych dostępnych dla developera, ale czytelnych dla zwykłego użytkownika.
- Gdy dochodzi fallback: template projektowy + template globalny.

## Kroki
- [ ] Dodaj tabelę `ticket_templates` w `backend/db.js` z polami payloadu i `updated_at`.
- [ ] Trzymaj checklistę jako JSON (`checklist_json`) i mapuj ją na tablicę `checklist_items` w API.
- [ ] Zapewnij RBAC:
- [ ] `GET` dla zalogowanego użytkownika.
- [ ] `POST/PATCH/DELETE` tylko dla developera.
- [ ] Waliduj `project_id` przed zapisem i filtrowaniem listy.
- [ ] Dla `GET ?project_id=...` zwracaj:
- [ ] najpierw template projektowe,
- [ ] potem globalne (`project_id IS NULL`).
- [ ] Ukrywaj `is_active = 0` przed zwykłym użytkownikiem.
- [ ] Dodaj testy integracyjne:
- [ ] CRUD,
- [ ] RBAC,
- [ ] fallback projektu/globalnych,
- [ ] walidacja brakującego projektu.

## Przykłady
Endpointy:
```txt
GET    /api/ticket-templates
GET    /api/ticket-templates?project_id=<uuid>
GET    /api/ticket-templates/:id
POST   /api/ticket-templates
PATCH  /api/ticket-templates/:id
DELETE /api/ticket-templates/:id
```

Przykładowy payload:
```json
{
  "name": "Checkout incident",
  "project_id": "7b3d9d7c-63e3-438f-99ed-3f6b7d741234",
  "category": "bug",
  "urgency_reporter": "high",
  "title_template": "Checkout error in production",
  "description_template": "Describe the issue, affected users and visible impact.",
  "checklist_items": ["Collect error message", "Attach screenshots"],
  "is_active": true
}
```

## Definition of Done
- [ ] Migracja działa na pustej i istniejącej bazie SQLite.
- [ ] Developer może tworzyć, edytować i usuwać template.
- [ ] Użytkownik może czytać tylko aktywne template.
- [ ] `GET ?project_id=...` zwraca template projektowe + globalne.
- [ ] Testy integracyjne przechodzą.

## Najczęstsze błędy / pułapki
- Przepuszczenie nieistniejącego `project_id`.
- Brak ukrycia nieaktywnych templatek dla zwykłego użytkownika.
- Traktowanie checklisty jako surowego stringa zamiast listy.
- Mieszanie etapu backend foundation z renderowaniem prefillu w formularzu.

## Powiązane pliki w repo
- `backend/db.js`
- `backend/routes/ticketTemplates.js`
- `backend/app.js`
- `backend/tests/api.integration.test.js`
