import httpx

from volcanai.ai_chat.models import ServerConfig


class MCPClient:
    def __init__(self, server: ServerConfig, timeout: int = 30):
        self.server = server
        self.base_url = server.url.rstrip("/")
        self.timeout = timeout

    def _rpc(self, method: str, params: dict) -> dict:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(
                f"{self.base_url}/mcp",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                raise RuntimeError(f"MCP error: {data['error']}")
            return data.get("result", {})

    def list_tools(self) -> list[dict]:
        result = self._rpc("tools/list", {})
        return result.get("tools", [])

    def call_tool(self, name: str, arguments: dict) -> dict:
        result = self._rpc(
            "tools/call",
            {"name": name, "arguments": arguments},
        )
        return result
