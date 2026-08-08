#!/bin/bash

# Log output for debugging
exec > >(tee -a /tmp/aevora_autostart.log) 2>&1
echo "=== Script started at $(date) ==="

export PATH=$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin

echo "Waiting for service on port 8002..."
while ! timeout 1 bash -c "cat < /dev/null > /dev/tcp/localhost/8002" 2>/dev/null; do
    sleep 2
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_DIR}"

if [ -f "${PROJECT_DIR}/.venv/bin/activate" ]; then
    source "${PROJECT_DIR}/.venv/bin/activate"
elif [ -f "${SCRIPT_DIR}/.venv/bin/activate" ]; then
    source "${SCRIPT_DIR}/.venv/bin/activate"
fi

echo "Port 8002 active! Launching MCP tools in detached background mode..."
make clean

# Run make tools detached in background & redirect output
nohup make tools > /tmp/aevora_mcp.log 2>&1 &
echo "MCP tools server started in background (PID: $!). Log: /tmp/aevora_mcp.log"
