import logging

import google.generativeai as genai
from django.core.cache import cache

from aevora.ai_chat.services.celery_tool_client import celery_tool_client
from aevora.ai_chat.utils.schema import schema_to_gemini

logger = logging.getLogger(__name__)


def format_tools(tools: list) -> list:
    formatted_tools = []
    for tool in tools:
        if isinstance(tool, dict):
            tool_data = dict(tool)
            if "parameters" not in tool_data and "inputSchema" in tool_data:
                tool_data["parameters"] = tool_data["inputSchema"]
            elif "inputSchema" not in tool_data and "parameters" in tool_data:
                tool_data["inputSchema"] = tool_data["parameters"]
            formatted_tools.append(tool_data)
        else:
            formatted_tools.append(tool)
    return formatted_tools


def get_tool_list(tools: list | None = None) -> list:
    if tools is None:
        try:
            tools = celery_tool_client.list_tools()
            if not isinstance(tools, list):
                tools = []
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to fetch tools from Celery worker: %s", exc)
            tools = []

    return format_tools(tools)


def get_gemini_tools() -> list:
    if (cached := cache.get("gemini_tools_cache")) is not None:
        return cached

    fds = [
        genai.protos.FunctionDeclaration(
            name=tool.get("name"),
            description=tool.get("description", ""),
            parameters=schema_to_gemini(tool.get("inputSchema", {})),
        )
        for tool in get_tool_list()
        if isinstance(tool, dict)
    ]
    gemini_tools = [genai.protos.Tool(function_declarations=fds)] if fds else []
    if gemini_tools:
        cache.set("gemini_tools_cache", gemini_tools, 60)
    return gemini_tools
