---
name: edudoroit-frontend-react-i18n
description: Frontend implementation for EdudoroIT_SupportCenter using React, Vite, Router v6, i18next, and role-aware UX. Use when building or changing pages, route guards, form validation, Kanban/TODO drag-and-drop behavior, translation keys, or API integration patterns.
---

# EdudoroIT Frontend React i18n

## Goal
Build a role-aware and fully translated UI that maps exactly to backend capabilities and validation constraints.

## Workflow
1. Initialize app shell, routing, and auth context.
2. Implement login OTP flow with language switch and countdown.
3. Implement shared layout/navigation with role-based route protection.
4. Implement pages in this order:
   - Dashboard
   - NewTicket
   - MyTickets
   - TicketDetail
   - Overview
   - Board (developer)
   - DevTodo (developer)
   - Admin (developer)
5. Add i18n keys for all visible UI text and errors in PL/EN.
6. Add optimistic updates only where rollback behavior is clear.

## UX and Validation Rules
- Enforce minimum field lengths from spec before submit.
- Show explicit actionable validation messages.
- Hide internal comments/notes for non-developer users.
- Keep status and priority badges consistent across views.
- Keep ticket numbering and timestamps formatted consistently.

## Security and Robustness
- Attach JWT to API calls via centralized Axios instance.
- Handle `401/403` globally and redirect to login when needed.
- Do not trust client role only; treat server response as source of truth.
- Sanitize rich input rendering and avoid unsafe HTML injection.

## Definition of Done
- All required pages implemented and connected to API.
- PL/EN translations complete for navigation, statuses, priorities, forms, and feedback.
- Role-based access works for route visibility and actions.
- New ticket form enforces category-dependent fields and constraints.

## Reference
Read `references/view-contracts.md` before creating each page.
