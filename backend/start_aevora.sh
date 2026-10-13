#!/bin/bash
set -euo pipefail

# Log output for debugging
exec > >(tee -a /tmp/aevora_autostart.log) 2>&1
echo "=== Aevora & Colima Autostart [$(date)] ==="

export PATH=$HOME/.local/bin:$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH

# Colima RAM and CPU allocation
COLIMA_RAM="${COLIMA_RAM:-8}"
COLIMA_CPU="${COLIMA_CPU:-4}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
UTILS_DIR="${HOME}/Documents/utils"

# 1. Start Colima if not running
if ! colima status >/dev/null 2>&1; then
    echo "[1/4] Starting Colima (${COLIMA_RAM}GiB RAM, ${COLIMA_CPU} CPUs)..."
    colima start --cpu "${COLIMA_CPU}" --memory "${COLIMA_RAM}"
else
    echo "[1/4] Colima is already running."
fi

# 2. Switch Docker context to Colima
echo "[2/4] Switching Docker context to colima..."
docker context use colima

# 3. Start Aevora Backend inside Colima (:8002)
echo "[3/4] Starting Aevora containers inside Colima..."
cd "${SCRIPT_DIR}"
docker compose up -d

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
    echo "      Warning: Backend health check timed out, proceeding anyway..."
fi

# Sync host Celery Tools Worker if available
if [ -d "${UTILS_DIR}" ]; then
    echo "      Ensuring Celery Tools Worker for utils..."
    if ! pgrep -f "celery -A app worker.*laptop\.tools" > /dev/null 2>&1; then
        cd "${UTILS_DIR}"
        nohup env PYTHONPATH=src uv run celery -A app worker -n tools_manager@%h -l info -Q laptop.tools,celery > /tmp/utils_celery.log 2>&1 &
        sleep 2
    fi
    docker exec aevora_django python manage.py reboot_tools 2>/dev/null || true
fi

# 4. Launch Aevora App
echo "[4/4] Launching Aevora App..."
if ! pgrep -f "/opt/Aevora/aevora-desktop" > /dev/null 2>&1; then
    nohup /usr/bin/aevora-desktop > /dev/null 2>&1 &
    echo "      Aevora App launched successfully."
else
    echo "      Aevora App is already running."
fi

echo "=== Aevora Stack Ready [$(date)] ==="
