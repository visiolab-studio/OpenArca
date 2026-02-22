.PHONY: up down logs ps build backend-install frontend-install backup restore

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

backup:
	./scripts/backup.sh

restore:
	@echo "Usage: make restore BACKUP=backups/<file>.tar.gz"
	@test -n "$(BACKUP)" || (echo "Missing BACKUP path" && exit 1)
	./scripts/restore.sh --input "$(BACKUP)" --yes
