#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/restore.sh --input PATH [--yes]

Options:
  --input PATH   Backup archive path (.tar.gz) created by scripts/backup.sh
  --yes          Confirm destructive restore (required).
  -h, --help     Show this help.
EOF
}

INPUT_PATH=""
CONFIRM="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)
      shift
      INPUT_PATH="${1:-}"
      ;;
    --yes)
      CONFIRM="1"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ -z "$INPUT_PATH" ]]; then
  echo "--input is required" >&2
  usage
  exit 1
fi

if [[ "$INPUT_PATH" != *.tar.gz ]]; then
  echo "Input path must end with .tar.gz" >&2
  exit 1
fi

if [[ ! -f "$INPUT_PATH" ]]; then
  echo "Backup file not found: $INPUT_PATH" >&2
  exit 1
fi

if [[ "$CONFIRM" != "1" ]]; then
  echo "Restore is destructive. Re-run with --yes to continue." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose is required" >&2
  exit 1
fi

running_services="$(docker compose ps --services --filter status=running || true)"
backend_running="0"
frontend_running="0"
if grep -qx "backend" <<<"$running_services"; then
  backend_running="1"
fi
if grep -qx "frontend" <<<"$running_services"; then
  frontend_running="1"
fi

if [[ "$backend_running" == "1" || "$frontend_running" == "1" ]]; then
  docker compose stop frontend backend >/dev/null
fi

restart_services() {
  if [[ "$backend_running" == "1" ]]; then
    docker compose up -d backend >/dev/null
  fi
  if [[ "$frontend_running" == "1" ]]; then
    docker compose up -d frontend >/dev/null
  fi
}
trap restart_services EXIT

# Clear persisted dirs first to avoid stale files from previous state.
cat "$INPUT_PATH" | docker compose run --rm -T backend sh -lc "rm -rf /app/data/* /app/uploads/* && tar -xzf - -C /app"

echo "Restore completed from: $INPUT_PATH"
