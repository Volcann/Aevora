#!/bin/bash
set -e

# Log output for debugging
exec > >(tee -a /tmp/aevora_autostart.log) 2>&1
echo "=== Aevora Stack Autostart [$(date)] ==="

export PATH=$HOME/.local/bin:$HOME/.cargo/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# 1. Start MCP Gateway on host (:8001) if not running
if ! curl -sf http://127.0.0.1:8001/mcp > /dev/null 2>&1 && ! curl -sf http://127.0.0.1:8001 > /dev/null 2>&1; then
    echo "[1/4] Starting MCP Gateway on :8001..."
    cd /home/folium/Documents/utils
    nohup /home/folium/.local/bin/uv run --package mcp-gateway gateway > /tmp/mcp-gateway.log 2>&1 &
    sleep 2
else
    echo "[1/4] MCP Gateway already active on :8001."
fi

# 2. Start Aevora Backend inside Colima (:8002)
echo "[2/4] Starting backend containers in Colima..."
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

# 4. Sync and cache MCP tools
echo "[4/4] Syncing MCP tools with backend..."
docker exec aevora_django python manage.py reboot_tools || true

echo "=== Aevora Stack Ready ==="
echo "Django Backend: http://127.0.0.1:8002"
echo "MCP Gateway:    http://127.0.0.1:8001"
