.PHONY: up down logs ps build backend-install frontend-install

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps

build:
	docker compose build

backend-install:
	cd backend && npm install

frontend-install:
	cd frontend && npm install
