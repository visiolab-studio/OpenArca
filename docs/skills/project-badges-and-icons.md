# Skill: Project Badges And Icons

## Cel
Zapewnić spójne oznaczenie projektu dla ticketów i zadań: kolor + ikona + nazwa projektu, z bezpiecznym uploadem ikony przez panel admina.

## Kiedy stosować
- Gdy ticket ma `project_id` i trzeba pokazać kontekst projektu w wielu widokach.
- Gdy dodajesz/zmieniasz endpointy uploadu plików dla encji domenowych.
- Gdy rozszerzasz filtrowanie list operacyjnych o projekt.

## Kroki (checklista)
- [ ] Rozszerz model `projects` o pola ikony (`icon_filename`, `icon_updated_at`) z migracją kompatybilną wstecz.
- [ ] Dodaj endpointy projektu:
  - `POST /api/projects/:id/icon` (upload),
  - `GET /api/projects/:id/icon` (asset),
  - `DELETE /api/projects/:id/icon` (reset do domyślnej).
- [ ] Ogranicz MIME do obrazów (`png/jpg/webp`) i czyść stare pliki po podmianie/usunięciu.
- [ ] Propaguj `project_name`, `project_color`, `project_icon_url` w payloadach ticketów (`list`, `detail`, `board`).
- [ ] Użyj wspólnego komponentu UI (`ProjectBadge`) z fallbackiem na domyślną ikonę.
- [ ] Dodaj widoczność projektu w krytycznych widokach (Kanban, TODO, My Tickets, Ticket Detail).
- [ ] Dodaj osobne filtry projektu tam, gdzie listy mają inny cel operacyjny (np. TODO vs kolejka).
- [ ] Pokryj RBAC i integrację testami backend.

## Przykłady
```http
POST /api/projects/:id/icon
Content-Type: multipart/form-data
field: icon=<image/png>
```

```http
DELETE /api/projects/:id/icon
Authorization: Bearer <developer-token>
```

```js
// frontend: badge fallback
<ProjectBadge
  name={ticket.project_name}
  color={ticket.project_color}
  iconUrl={ticket.project_icon_url}
  showEmpty
/>
```

## Definition of Done
- [ ] Upload ikony projektu działa tylko dla developera (RBAC).
- [ ] Użytkownik bez uprawnień dostaje `403` na upload/delete ikony.
- [ ] Widoki ticketów pokazują poprawny badge projektu lub fallback.
- [ ] Filtry projektu działają zgodnie z zakresem sekcji.
- [ ] Po usunięciu ikony wraca domyślny wygląd.
- [ ] Testy backend + frontend + build przechodzą.

## Najczęstsze błędy / pułapki
- Brak cleanup starych plików ikon po uploadzie (wycieki storage).
- Pokazywanie samego `project_id` zamiast `name/color/icon`.
- Jedno wspólne filtrowanie dla różnych list o innym znaczeniu operacyjnym.
- Endpoint assetu bez walidacji nazwy pliku (ryzyko path traversal).

## Powiązane pliki w repo
- `backend/db.js`
- `backend/routes/projects.js`
- `backend/services/tickets.js`
- `backend/tests/api.integration.test.js`
- `backend/tests/rbac.ownership.audit.integration.test.js`
- `frontend/src/components/ProjectBadge.jsx`
- `frontend/src/pages/Board.jsx`
- `frontend/src/pages/DevTodo.jsx`
- `frontend/src/pages/TicketDetail.jsx`
- `frontend/src/pages/MyTickets.jsx`
- `frontend/src/pages/Admin.jsx`
- `frontend/src/styles.css`
