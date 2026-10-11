#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="${HOME}/.local/bin:${HOME}/.cargo/bin:${PATH}"

# A manually managed/local backend can be used without Docker.
if command -v curl >/dev/null 2>&1 && curl --max-time 2 -fsS http://127.0.0.1:8002/api/v1/health/ >/dev/null 2>&1; then
  echo "Using the existing healthy Aevora backend on port 8002."
  exit 0
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "Install curl for the backend readiness check." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required by this launcher. Start Django manually or install Docker Compose." >&2
  exit 1
fi
if [[ ! -f "${SCRIPT_DIR}/.env" ]]; then
  echo "Missing backend/.env. Copy backend/.env.example to backend/.env and configure it first." >&2
  exit 1
fi
# The optional tool project is not necessary for microphone capture or speech.
if [[ -n "${AEVORA_TOOLS_DIR:-}" && -d "${AEVORA_TOOLS_DIR}" ]] && command -v uv >/dev/null 2>&1; then
  echo "Optional tools are configured; the Tauri launcher starts their worker."
fi
cd "${SCRIPT_DIR}"
docker compose up -d
healthy=false
for _ in $(seq 1 30); do
  if curl --max-time 2 -fsS http://127.0.0.1:8002/api/v1/health/ >/dev/null 2>&1; then healthy=true; break; fi
  sleep 1
done
if [[ "$healthy" != true ]]; then
  echo "Backend is not healthy. Inspect: cd backend && docker compose logs --tail=100 django" >&2
  exit 1
fi
docker compose exec -T django python manage.py reboot_tools || echo "Optional tools sync failed; chat and voice can still run."
echo "Aevora backend is ready on http://127.0.0.1:8002"
