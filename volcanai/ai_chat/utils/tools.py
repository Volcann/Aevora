import google.generativeai as genai
from django.core.cache import cache
from django.core.exceptions import ValidationError

from volcanai.ai_chat.models import ServerConfig
from volcanai.ai_chat.services.mcp_manager import MCPClient
from volcanai.ai_chat.utils.regex import extract_words
from volcanai.ai_chat.utils.schema import _mcp_schema_to_gemini


def _ensure_default_server_config():
    servers = ServerConfig.objects.filter(is_active=True)
    if not servers.exists():
        raise ValidationError(
            "No active ServerConfig found. Please run the management "
            "command 'python manage.py reboot_tools' to create one."
        )
    return servers


def get_available_tools_list(cache_seconds: int = 300) -> list[dict]:
    cached = cache.get("mcp_tools_ui_cache")
    if cached:
        return cached

    servers = _ensure_default_server_config()
    ui_tools = []

    for server in servers:
        try:
            client = MCPClient(server)
            tools = client.list_tools()

            for tool in tools:
                input_schema = tool.get("inputSchema", {})
                ui_tools.append(
                    {
                        "name": tool["name"],
                        "description": tool.get("description", ""),
                        "parameters": {
                            "properties": input_schema.get("properties", {}),
                            "required": input_schema.get("required", []),
                        },
                    }
                )
        except Exception as exc:
            print(f"[MCP] Could not reach server '{server.name}': {exc}")

    if ui_tools:
        cache.set("mcp_tools_ui_cache", ui_tools, cache_seconds)
    return ui_tools


def get_all_tools_for_gemini(cache_seconds: int = 300) -> tuple[list, dict, dict]:
    cached = cache.get("mcp_tools_cache")
    if cached and cached[0]:
        return cached

    servers = _ensure_default_server_config()

    gemini_tools = []
    tool_router = {}
    keyword_index = {}

    for server in servers:
        try:
            client = MCPClient(server)
            tools = client.list_tools()

            for tool in tools:
                gemini_tools.append(
                    genai.protos.Tool(
                        function_declarations=[
                            genai.protos.FunctionDeclaration(
                                name=tool["name"],
                                description=tool.get("description", ""),
                                parameters=_mcp_schema_to_gemini(
                                    tool.get("inputSchema", {})
                                ),
                            )
                        ]
                    )
                )
                tool_router[tool["name"]] = server
                raw = tool["name"] + " " + tool.get("description", "")
                keyword_index[tool["name"]] = extract_words(raw)
        except Exception as exc:
            print(f"[MCP] Could not reach server '{server.name}': {exc}")

    if gemini_tools:
        cache.set(
            "mcp_tools_cache",
            (gemini_tools, tool_router, keyword_index),
            cache_seconds,
        )
    return gemini_tools, tool_router, keyword_index
