import logging

from aevora.ai_chat.services.celery_tool_client import celery_tool_client

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
