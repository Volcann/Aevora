import google.generativeai as genai
from django.core.cache import cache

from aevora.ai_chat.services.mcp_manager import CeleryToolClient
from aevora.ai_chat.utils.regex import extract_words
from aevora.ai_chat.utils.schema import _mcp_schema_to_gemini


def get_available_tools_list(cache_seconds: int = 300) -> list[dict]:
    cached = cache.get("mcp_tools_ui_cache")
    if cached:
        return cached

    ui_tools = []
    client = CeleryToolClient()
    try:
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
    except Exception as exc:  # noqa: BLE001
        print(f"[Celery] Could not fetch tool list from worker: {exc}")

    if ui_tools:
        cache.set("mcp_tools_ui_cache", ui_tools, cache_seconds)
    return ui_tools


def get_all_tools_for_gemini(cache_seconds: int = 300) -> tuple[list, dict, dict]:
    cached = cache.get("mcp_tools_cache")
    if cached and cached[0]:
        return cached

    gemini_tools = []
    tool_router = {}
    keyword_index = {}

    client = CeleryToolClient()
    try:
        tools = client.list_tools()
        for tool in tools:
            gemini_tools.append(
                genai.protos.Tool(
                    function_declarations=[
                        genai.protos.FunctionDeclaration(
                            name=tool["name"],
                            description=tool.get("description", ""),
                            parameters=_mcp_schema_to_gemini(tool.get("inputSchema", {})),
                        )
                    ]
                )
            )
            tool_router[tool["name"]] = "celery"
            raw = tool["name"] + " " + tool.get("description", "")
            keyword_index[tool["name"]] = extract_words(raw)
    except Exception as exc:  # noqa: BLE001
        print(f"[Celery] Could not fetch tool list from worker: {exc}")

    if gemini_tools:
        cache.set(
            "mcp_tools_cache",
            (gemini_tools, tool_router, keyword_index),
            cache_seconds,
        )
    return gemini_tools, tool_router, keyword_index
