from django.core.cache import cache
from django.core.management.base import BaseCommand

from aevora.ai_chat.models import ServerConfig
from aevora.ai_chat.utils import get_all_tools_for_gemini, get_available_tools_list


class Command(BaseCommand):
    help = "Create default local SSE ServerConfig entries and cache tools."

    def handle(self, *args, **options):
        ServerConfig.objects.exclude(name="local_mcp").update(is_active=False)

        server, created = ServerConfig.objects.update_or_create(
            name="local_mcp",
            defaults={
                "url": "http://host.docker.internal:8001",
                "description": "MCP Gateway (streamable-http)",
                "is_active": True,
            },
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created ServerConfig '{server.name}'."),
            )
        else:
            self.stdout.write(
                self.style.NOTICE(f"Updated ServerConfig '{server.name}'."),
            )

        cache.delete("mcp_tools_cache")
        cache.delete("mcp_tools_ui_cache")
        get_all_tools_for_gemini()
        ui_tools = get_available_tools_list()

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully cached {len(ui_tools)} tool(s) for Gemini chat.",
            ),
        )
        for tool in ui_tools:
            self.stdout.write(f"  - {tool['name']}")
