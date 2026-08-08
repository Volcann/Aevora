import httpx

from aevora.ai_chat.models import ServerConfig

_MCP_PATH = "/mcp"


class MCPClient:
    def __init__(self, server: ServerConfig, timeout: int = 30):
        self.base_url = server.url.rstrip("/")
        self.timeout = timeout

    def _endpoint(self) -> str:
        return f"{self.base_url}{_MCP_PATH}"

    def _post(self, method: str, params: dict) -> dict:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(
                self._endpoint(),
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                raise RuntimeError(f"MCP error: {data['error']}")
            return data.get("result", {})

    def list_tools(self) -> list[dict]:
        return self._post("tools/list", {}).get("tools", [])

    def call_tool(self, name: str, arguments: dict) -> dict:
        return self._post("tools/call", {"name": name, "arguments": arguments})
