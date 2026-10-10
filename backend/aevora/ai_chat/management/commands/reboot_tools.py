from django.core.cache import cache
from django.core.management.base import BaseCommand

from aevora.ai_chat.utils import get_all_tools_for_gemini, get_available_tools_list


class Command(BaseCommand):
    help = "Warm the Celery tool cache."

    def handle(self, *args, **options):
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
