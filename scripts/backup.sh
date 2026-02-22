#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/backup.sh [--output PATH] [--force] [--hot]

Options:
  --output PATH   Output archive path (.tar.gz). Default: backups/edudoroit-backup-<timestamp>.tar.gz
  --force         Overwrite output file if it already exists.
  --hot           Do not stop backend/frontend before backup (faster, less consistent).
  -h, --help      Show this help.
EOF
}

OUTPUT_PATH=""
FORCE="0"
HOT_MODE="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      shift
      OUTPUT_PATH="${1:-}"
      ;;
    --force)
      FORCE="1"
      ;;
    --hot)
      HOT_MODE="1"
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

if [[ -z "$OUTPUT_PATH" ]]; then
  timestamp="$(date +%Y%m%d-%H%M%S)"
  OUTPUT_PATH="backups/edudoroit-backup-${timestamp}.tar.gz"
fi

if [[ "$OUTPUT_PATH" != *.tar.gz ]]; then
  echo "Output path must end with .tar.gz" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"

if [[ -f "$OUTPUT_PATH" && "$FORCE" != "1" ]]; then
  echo "Output file already exists: $OUTPUT_PATH (use --force to overwrite)" >&2
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

stopped_for_consistency="0"
if [[ "$HOT_MODE" != "1" ]]; then
  if [[ "$backend_running" == "1" || "$frontend_running" == "1" ]]; then
    docker compose stop frontend backend >/dev/null
    stopped_for_consistency="1"
  fi
fi

tmp_path="${OUTPUT_PATH}.tmp.$$"
cleanup() {
  rm -f "$tmp_path"
  if [[ "$stopped_for_consistency" == "1" ]]; then
    if [[ "$backend_running" == "1" ]]; then
      docker compose up -d backend >/dev/null
    fi
    if [[ "$frontend_running" == "1" ]]; then
      docker compose up -d frontend >/dev/null
    fi
  fi
}
trap cleanup EXIT

# Run backup in one-off container using the same project volumes.
docker compose run --rm -T backend sh -lc "tar -czf - -C /app data uploads" >"$tmp_path"
mv "$tmp_path" "$OUTPUT_PATH"

echo "Backup created: $OUTPUT_PATH"
