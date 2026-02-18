# Schema and Endpoints Checklist

## Core Tables
- `users`, `otp_codes`, `projects`, `tickets`, `ticket_history`, `comments`, `attachments`, `dev_tasks`, `settings`

## Auth Endpoints
- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `GET /api/auth/me`
- `PATCH /api/auth/me`

## Ticket Endpoints
- `GET /api/tickets`
- `GET /api/tickets/board`
- `GET /api/tickets/stats/overview`
- `GET /api/tickets/:id`
- `POST /api/tickets`
- `PATCH /api/tickets/:id`
- `POST /api/tickets/:id/comments`
- `POST /api/tickets/:id/attachments`

## Developer Endpoints
- `GET/POST/PATCH/DELETE /api/dev-tasks`
- `POST /api/dev-tasks/reorder`
- `GET/POST/PATCH/DELETE /api/projects`
- `GET/PATCH /api/users`
- `GET/PATCH /api/settings`

## Notification Triggers
- Send email to reporter on status changes: `verified`, `in_progress`, `blocked`, `closed`.
- Send email on new non-internal developer comment.
- Suppress email when actor equals reporter.
