# Skill: DevTodo Ticket Sync

## Cel
Zapewnić spójność `Ticket <-> Kanban <-> DevTodo` przy zmianach statusu i przypisania.
Dla jednego ticketu ma istnieć tylko jedno aktywne linked TODO (`todo`/`in_progress`) u aktualnie przypisanego developera.

## Kiedy stosować
- Przy zmianach w `PATCH /api/tickets/:id` dotyczących `status` i `assignee_id`.
- Przy bugach typu „ticket jest przypisany gdzie indziej, ale w TODO dalej widnieje u poprzedniej osoby”.
- Przy refaktorze sync logiki pomiędzy tablicą Kanban i listą TODO.

## Kroki (checklista)
- [ ] W patchu ticketu wylicz `nextAssigneeId` oraz czy wystąpiła zmiana statusu/przypisania.
- [ ] Przed tworzeniem/aktualizacją linked taska uruchom normalizację aktywnych tasków dla ticketu.
- [ ] Jeśli ticket jest bez przypisanego deva: usuń aktywne linked taski (`todo`, `in_progress`) dla tego ticketu.
- [ ] Jeśli ticket jest przypisany: zostaw tylko jeden aktywny linked task dla aktualnego assignee.
- [ ] Gdy brak taska dla aktualnego assignee: przenieś najnowszy aktywny task do niego albo utwórz nowy.
- [ ] Utrzymaj mapowanie statusów ticket -> task (`closed -> done`, `in_progress -> in_progress`, reszta -> `todo`).
- [ ] Dodaj test regresyjny dla reassign + unassign i potwierdź brak duplikatów aktywnych linked tasków.

## Przykłady
Endpoint:
- `PATCH /api/tickets/:id` z payloadem:
  - `{ "assignee_id": "<devB>" }` (reassign)
  - `{ "assignee_id": null }` (unassign)
  - `{ "status": "in_progress", "assignee_id": "<devA>" }`

Komendy:
```bash
docker compose exec -T backend npm test
docker compose exec -T backend node --test --test-concurrency=1 tests/smoke.flow.test.js
```

## Definition of Done
- [ ] Reassign nie zostawia aktywnego linked taska u poprzedniego deva.
- [ ] Unassign usuwa aktywny linked task dla ticketu.
- [ ] W aktywnych linked taskach istnieje maksymalnie jeden task na ticket.
- [ ] `backend/tests/api.integration.test.js` zawiera test regresyjny dla reassign/unassign.
- [ ] Smoke flow przechodzi bez regresji.

## Najczęstsze błędy / pułapki
- Aktualizacja tylko nowego assignee bez czyszczenia starego taska.
- Pozostawienie wielu aktywnych linked tasków dla jednego ticketu.
- Brak synchronizacji po przejściu ticketu na `closed` lub po ponownym otwarciu.
- Liczenie queue w UI bez uwzględnienia linked tasków pozostawionych po unassign.

## Powiązane pliki w repo
- `backend/routes/tickets.js`
- `backend/routes/devTasks.js`
- `backend/tests/api.integration.test.js`
- `frontend/src/pages/DevTodo.jsx`
- `frontend/src/pages/Board.jsx`
- `docs/PROGRESS.md`

## Manual test
- Zaloguj deva A i zaakceptuj ticket (`verified`), potem zaloguj deva B i przypisz ticket do siebie.
- Oczekiwany rezultat: ticket znika z aktywnego TODO deva A i pojawia się tylko u deva B.
