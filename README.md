# EdudoroIT_SupportCenter

Lokalny bootstrap projektu (P0): backend Express + SQLite, frontend React/Vite, Mailpit, Docker Compose.

## Szybki start

1. Skopiuj wartości środowiskowe:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. Uruchom kontenery:
```bash
docker compose up --build
```

3. Sprawdź usługi:
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:4000/health`
- Mailpit UI: `http://localhost:8025`

Jeśli porty Mailpit są zajęte, uruchom z nadpisaniem:
```bash
MAILPIT_SMTP_PORT=1026 MAILPIT_UI_PORT=8026 docker compose up --build
```

## Uruchomienie bez Dockera

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```
