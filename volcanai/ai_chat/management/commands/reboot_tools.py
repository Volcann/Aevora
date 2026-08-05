from django.core.cache import cache
from django.core.management.base import BaseCommand

from volcanai.ai_chat.models import ServerConfig
from volcanai.ai_chat.utils import get_all_tools_for_gemini


class Command(BaseCommand):
    help = "Create default local SSE ServerConfig entries and cache tools."

    def handle(self, *args, **options):
        server, created = ServerConfig.objects.get_or_create(
            name="local_mcp",
            defaults={
                "url": "http://host.docker.internal:8080/sse",
                "description": "Local SSE MCP Server",
                "is_active": True,
            },
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created default ServerConfig '{server.name}'."),
            )
        else:
            self.stdout.write(
                self.style.NOTICE(f"ServerConfig '{server.name}' already exists."),
            )

        cache.delete("mcp_tools_cache")
        _, tool_router = get_all_tools_for_gemini()

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully cached {len(tool_router)} tool(s) for Gemini chat.",
            ),
        )
        for tool_name in tool_router:
            self.stdout.write(f"  - {tool_name}")
