# Service Contracts

## Ports
- Frontend: `3000`
- Backend API: `4000`
- Mailpit SMTP: `1025`
- Mailpit UI: `8025`

## Environment Variables
- Backend:
  - `PORT=4000`
  - `JWT_SECRET=...`
  - `APP_URL=http://localhost:3000`
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Frontend:
  - `VITE_API_URL=http://localhost:4000`

## Persistent Paths
- `backend/data.sqlite`
- `backend/uploads/`

## Runtime Notes
- SMTP can default to Mailpit in local development.
- Uploaded files must be served only through authenticated API endpoint.
