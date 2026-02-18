# View Contracts

## Public Routes
- `/login`

## Authenticated Routes
- `/`
- `/new-ticket`
- `/my-tickets`
- `/ticket/:id`
- `/overview`

## Developer-only Routes
- `/board`
- `/dev-todo`
- `/admin`

## Key UI Contracts
- Status keys: `submitted`, `verified`, `in_progress`, `waiting`, `blocked`, `closed`
- Priority keys: `critical`, `high`, `normal`, `low`
- Category keys: `bug`, `feature`, `improvement`, `question`, `other`
- New ticket form must enforce category-specific required fields.

## i18n Contracts
- Default language: `pl`
- Persist language in user profile and local storage.
- Keep key naming stable (`status.*`, `priority.*`, `category.*`, `nav.*`).
