#!/bin/bash

# Log output for debugging
exec > >(tee -a /tmp/volcani_autostart.log) 2>&1
echo "=== Script started at $(date) ==="

export PATH=$PATH:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin

echo "Waiting for service on port 8002..."
while ! timeout 1 bash -c "cat < /dev/null > /dev/tcp/localhost/8002" 2>/dev/null; do
    sleep 2
done

echo "Port 8002 active! Launching MCP tools in detached background mode..."
cd /home/folium/Documents/volcani
source /home/folium/Documents/volcani/.venv/bin/activate
make clean

# Run make tools detached in background & redirect output
nohup make tools > /tmp/volcani_mcp.log 2>&1 &
echo "MCP tools server started in background (PID: $!). Log: /tmp/volcani_mcp.log"
