import threading


class ToolRegistry:
    def __init__(self):
        self._tool_to_server = {}
        self._schemas = {}
        self._lock = threading.Lock()

    def register(self, server_name, tools):
        with self._lock:
            for tool in tools:
                name = tool["name"]
                self._tool_to_server[name] = server_name
                self._schemas[name] = {
                    "name": name,
                    "description": tool.get("description", ""),
                    "parameters": tool.get("inputSchema", {"type": "object", "properties": {}}),
                }

    def get_server(self, tool_name):
        return self._tool_to_server.get(tool_name)

    def get_gemini_declarations(self):
        with self._lock:
            return list(self._schemas.values())

    def clear(self):
        with self._lock:
            self._tool_to_server.clear()
            self._schemas.clear()


tool_registry = ToolRegistry()
