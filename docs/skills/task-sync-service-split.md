# Skill: Task Sync Service Split

## Cel
Wydzielić logikę synchronizacji `ticket <-> dev_tasks` z route handlerów do dedykowanego serwisu, aby utrzymać czysty podział `route -> service -> response`.

## Kiedy stosować
- Gdy modyfikujesz flow przypisania/reassign ticketów.
- Gdy zmieniasz zasady tworzenia i finalizacji zadań deweloperskich.
- Gdy porządkujesz warstwę usług w P6A (engine split).

## Kroki (checklista)
- [ ] Dodaj/aktualizuj `backend/services/task-sync.js`:
  - `ensureDevTaskForAcceptedTicket(...)`
  - `normalizeLinkedDevTasksForTicket(...)`
- [ ] Usuń duplikaty helperów z route (`backend/routes/tickets.js`).
- [ ] Utrzymaj kontrakt API route bez zmian.
- [ ] Dodaj testy unit `backend/tests/task-sync.service.unit.test.js`.
- [ ] Zweryfikuj sync przez smoke flow (status change + DevTodo).

## Przykłady
```js
const { taskSyncService } = require("../services/task-sync");

taskSyncService.normalizeLinkedDevTasksForTicket({
  ticketId: req.params.id,
  assigneeId: nextAssigneeId
});

taskSyncService.ensureDevTaskForAcceptedTicket({
  ticketId: req.params.id,
  userId: nextAssigneeId,
  ticket: nextTicketState
});
```

## Definition of Done
- [ ] Route używa wyłącznie serwisu do sync logic (bez lokalnych helperów sync).
- [ ] Testy unit serwisu pokrywają co najmniej:
  - update istniejącego zadania,
  - create nowego zadania,
  - normalize przy braku assignee,
  - transfer zadania przy reassignment.
- [ ] `npm test`, lint, build i smoke flow przechodzą.

## Najczęstsze błędy / pułapki
- Pominięcie statusu `waiting/closed` jako `done` po stronie `dev_tasks`.
- Brak usuwania duplikatów aktywnych zadań po reassignment.
- Zostawienie logiki sync jednocześnie w route i service (podwójne wykonanie).

## Powiązane pliki w repo
- `backend/services/task-sync.js`
- `backend/routes/tickets.js`
- `backend/tests/task-sync.service.unit.test.js`
- `docs/PROGRESS.md`
