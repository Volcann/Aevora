#!/bin/bash
set -euo pipefail

# Ensure PATH includes common tool locations
export PATH=$HOME/.local/bin:$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH

# Always use Colima docker context by default
export DOCKER_CONTEXT="${DOCKER_CONTEXT:-colima}"

COLIMA_RAM="${COLIMA_RAM:-8}"
COLIMA_CPU="${COLIMA_CPU:-4}"

# Resolve backend directory even when called via symlink
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
    DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
    SOURCE="$(readlink "$SOURCE")"
    [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
BACKEND_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"

# 1. Start Colima if not running
if ! colima status >/dev/null 2>&1; then
    echo "[1/3] Starting Colima (${COLIMA_RAM}GiB RAM, ${COLIMA_CPU} CPUs)..."
    colima start --cpu "${COLIMA_CPU}" --memory "${COLIMA_RAM}"
else
    echo "[1/3] Colima is running."
fi

# 2. Switch Docker context to Colima
echo "[2/3] Ensuring Docker context is colima..."
docker context use colima >/dev/null 2>&1 || true

# 3. Restart Django Backend
echo "[3/3] Restarting Aevora Django backend container inside Colima..."
cd "${BACKEND_DIR}"
docker compose restart django

echo "      Waiting for backend health check on :8002..."
healthy=false
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:8002/api/v1/health/ > /dev/null 2>&1; then
        echo "      Aevora backend is healthy!"
        healthy=true
        break
    fi
    sleep 1
done

if [ "$healthy" != "true" ]; then
    echo "      Warning: Backend health check timed out. Inspect logs with: cd ${BACKEND_DIR} && docker compose logs --tail=50 django" >&2
    exit 1
fi

echo "=== Aevora Django Backend Restart Complete [$(date)] ==="
