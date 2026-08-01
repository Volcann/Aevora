import asyncio
import logging
import os

from django.apps import AppConfig
from django.db import DatabaseError, OperationalError, ProgrammingError

from volcanai.ai_chat.services.mcp_manager import mcp_manager
from volcanai.ai_chat.services.tool_registry import tool_registry

logger = logging.getLogger(__name__)


class AiChatConfig(AppConfig):
    name = "volcanai.ai_chat"

    def ready(self):
        run_main = os.environ.get("RUN_MAIN")
        if run_main is None or run_main == "true":
            self._schedule_mcp_boot()

    def _schedule_mcp_boot(self):
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(asyncio.to_thread(self._boot_mcp_servers))
        except RuntimeError:
            self._boot_mcp_servers()

    def _boot_mcp_servers(self):
        from volcanai.ai_chat.models.server_config import ServerConfig

        try:
            configs = list(ServerConfig.objects.filter(is_active=True))
        except (DatabaseError, OperationalError, ProgrammingError) as e:
            logger.warning("Could not query ServerConfig (migrations pending?): %s", e)
            return

        for config in configs:
            try:
                proc = mcp_manager.start_server(config)
                tools = proc.list_tools()
                tool_registry.register(config.name, tools)
                logger.info("MCP '%s' started — %d tools loaded", config.name, len(tools))
            except Exception as e:  # noqa: BLE001
                logger.error("Failed to start MCP server '%s': %s", config.name, e)
