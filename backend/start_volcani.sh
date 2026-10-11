#!/bin/bash
set -e

# Log output for debugging
exec > >(tee -a /tmp/aevora_autostart.log) 2>&1
echo "=== Aevora Stack Autostart [$(date)] ==="

export PATH=$HOME/.local/bin:$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 1. Start Celery Tools Worker on host if not running
if ! pgrep -f "tools_manager" > /dev/null 2>&1; then
    echo "[1/4] Starting Celery Tools Worker for utils..."
    cd /home/folium/Documents/utils
    nohup env PYTHONPATH=src /home/folium/.local/bin/uv run celery -A app worker -l info -Q laptop.tools,celery > /tmp/utils_celery.log 2>&1 &
    sleep 2
else
    echo "[1/4] Celery Tools Worker already active."
fi

# 2. Start Aevora Backend inside Colima/Docker (:8002)
echo "[2/4] Starting backend containers..."
cd "${SCRIPT_DIR}"
docker compose up -d

# 3. Wait for Django backend to be ready on :8002
echo "[3/4] Waiting for backend health check on :8002..."
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:8002/api/v1/health/ > /dev/null 2>&1; then
        echo "      Aevora backend is healthy!"
        break
    fi
    sleep 1
done

# 4. Sync and cache Celery tools
echo "[4/4] Syncing Celery tools with backend..."
docker exec aevora_django python manage.py reboot_tools 2>/dev/null || "${SCRIPT_DIR}/.venv/bin/python" "${SCRIPT_DIR}/manage.py" reboot_tools || true

echo "=== Aevora Stack Ready ==="
echo "Django Backend: http://127.0.0.1:8002"
echo "Celery Tools:   Connected via Redis (:6382)"
