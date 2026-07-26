import json
import logging
import os
import subprocess
import threading

logger = logging.getLogger(__name__)


class MCPProcess:
    def __init__(self, name, command, args, env_vars=None):
        self.name = name
        self._id_counter = 0
        self._id_lock = threading.Lock()
        self._lock = threading.Lock()

        env = os.environ.copy()
        if env_vars:
            env.update(env_vars)

        self._process = subprocess.Popen(
            [command, *args],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            env=env,
            text=True,
            bufsize=1,
        )
        self._initialize()

    def _next_id(self):
        with self._id_lock:
            self._id_counter += 1
            return self._id_counter

    def _write(self, payload):
        self._process.stdin.write(json.dumps(payload) + "\n")
        self._process.stdin.flush()

    def _read_response(self, request_id):
        while True:
            line = self._process.stdout.readline()
            if not line:
                raise RuntimeError(f"MCP server '{self.name}' closed stdout unexpectedly")
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if "id" not in msg:
                continue
            if msg["id"] == request_id:
                return msg

    def _request(self, method, params=None):
        rid = self._next_id()
        payload = {"jsonrpc": "2.0", "id": rid, "method": method}
        if params is not None:
            payload["params"] = params
        self._write(payload)
        return self._read_response(rid)

    def _notify(self, method, params=None):
        payload = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            payload["params"] = params
        self._write(payload)

    def _initialize(self):
        response = self._request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "volcani", "version": "1.0.0"},
        })
        if "error" in response:
            raise RuntimeError(f"Init failed for '{self.name}': {response['error']}")
        self._notify("notifications/initialized")

    def list_tools(self):
        response = self._request("tools/list")
        if "error" in response:
            raise RuntimeError(f"tools/list failed for '{self.name}': {response['error']}")
        return response.get("result", {}).get("tools", [])

    def call_tool(self, tool_name, arguments):
        response = self._request("tools/call", {"name": tool_name, "arguments": arguments})
        if "error" in response:
            raise RuntimeError(response["error"].get("message", "Tool call failed"))
        return response.get("result", {})

    @property
    def lock(self):
        return self._lock

    def is_alive(self):
        return self._process.poll() is None

    def terminate(self):
        try:
            self._process.terminate()
            self._process.wait(timeout=5)
        except Exception:
            self._process.kill()


class MCPClientManager:
    def __init__(self):
        self._processes = {}
        self._manager_lock = threading.Lock()

    def start_server(self, server_config):
        with self._manager_lock:
            existing = self._processes.get(server_config.name)
            if existing and existing.is_alive():
                return existing
            proc = MCPProcess(
                name=server_config.name,
                command=server_config.command,
                args=server_config.args,
                env_vars=getattr(server_config, "env_vars", None) or {},
            )
            self._processes[server_config.name] = proc
            return proc

    def get_process(self, server_name):
        return self._processes.get(server_name)

    def shutdown_all(self):
        with self._manager_lock:
            for proc in self._processes.values():
                proc.terminate()
            self._processes.clear()


mcp_manager = MCPClientManager()
