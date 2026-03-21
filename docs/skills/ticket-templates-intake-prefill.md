# Skill: Ticket Templates Intake Prefill

## Cel
Podłączyć aktywne `ticket templates` do formularza `New Ticket`, tak aby użytkownik mógł szybko wypełnić rdzeń zgłoszenia bez naruszania istniejącego flow walidacji.

## Kiedy stosować
- Gdy rozwijasz formularz tworzenia zgłoszenia.
- Gdy template mają działać jako preset `title + description + category + urgency`.
- Gdy trzeba zachować fallback `project -> global`.

## Kroki
- [ ] Pobierz aktywne template przez `GET /api/ticket-templates`.
- [ ] Jeśli wybrano projekt, użyj `project_id` i opieraj się na backendowym fallbacku globalnym.
- [ ] Jeśli projekt nie jest wybrany, pokazuj tylko template globalne.
- [ ] Dodaj selector `template` w pierwszym kroku formularza.
- [ ] Po wyborze template uzupełnij:
- [ ] `title`
- [ ] `description`
- [ ] `category`
- [ ] `urgency_reporter`
- [ ] Checklistę wstaw do `description` jako czytelny blok tekstu.
- [ ] Wyczyść pola specyficzne dla kategorii, których template nie opisuje.
- [ ] Gdy zmienia się projekt, odśwież listę templatek i zresetuj niedostępny wybór.
- [ ] Dodaj test frontendu dla fallbacku i prefilla.

## Przykłady
Przykładowy opis po prefillu:
```txt
Customers lose context when the checkout response fails after payment step.

Checklist
- Capture order ID
- Attach payment provider timestamp
```

Przykładowe wywołania API:
```txt
GET /api/ticket-templates
GET /api/ticket-templates?project_id=<uuid>
```

## Definition of Done
- [ ] Użytkownik widzi globalne template bez wybranego projektu.
- [ ] Po wyborze projektu widzi template projektowe z fallbackiem globalnym.
- [ ] Wybór template uzupełnia pola bazowe formularza.
- [ ] Dotychczasowa walidacja kategorii nadal działa.
- [ ] Testy frontendowe, build i smoke przechodzą.

## Najczęstsze błędy / pułapki
- Nadpisanie projektu zgłoszenia przez template.
- Brak resetu niepasującego `selectedTemplateId` po zmianie projektu.
- Próba zapisu checklisty do osobnego modelu ticketu, mimo że flow używa tylko `description`.
- Ukryte stare wartości w polach specyficznych dla innej kategorii.

## Powiązane pliki w repo
- `frontend/src/pages/NewTicket.jsx`
- `frontend/src/api/ticketTemplates.js`
- `frontend/src/pages/__tests__/NewTicket.templates.test.jsx`
- `frontend/src/i18n/en.json`
- `frontend/src/i18n/pl.json`
