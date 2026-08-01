from django.core.management.base import BaseCommand, CommandError

from volcanai.ai_chat.models import ServerConfig
from volcanai.ai_chat.services.mcp_manager import mcp_manager


class Command(BaseCommand):
    help = "Test and run an MCP stdio server from ServerConfig"

    def add_arguments(self, parser):
        parser.add_argument(
            "server_name",
            type=str,
            help="Name of the ServerConfig entry to start",
        )

    def handle(self, *args, **options):
        server_name = options["server_name"]

        # 1. Fetch config from database
        try:
            config = ServerConfig.objects.get(name=server_name, is_active=True)
        except ServerConfig.DoesNotExist:
            raise CommandError(
                f"ServerConfig '{server_name}' does not exist or is inactive.",
            )

        self.stdout.write(
            self.style.NOTICE(f"Starting MCP server process: {config.name}..."),
        )

        # 2. Spawn process via MCP Manager
        try:
            proc = mcp_manager.start_server(config)
        except Exception as e:
            raise CommandError(f"Failed to start MCP process: {e}") from e

        self.stdout.write(self.style.SUCCESS(f"Connected to '{config.name}'!"))

        # 3. List available tools from the server
        try:
            tools = proc.list_tools()
            self.stdout.write(self.style.SUCCESS(f"Discovered {len(tools)} tool(s):"))
            for tool in tools:
                self.stdout.write(f"  - {tool.get('name')}: {tool.get('description')}")
        except Exception as e:  # noqa: BLE001
            self.stderr.write(self.style.ERROR(f"Error fetching tools: {e}"))

        self.stdout.write(
            self.style.WARNING("\nPress Ctrl+C to stop the process monitoring."),
        )

        # Keep running to monitor process health
        try:
            import time

            while proc.is_alive():
                time.sleep(1)
            self.stdout.write(self.style.ERROR("Process terminated unexpectedly."))
        except KeyboardInterrupt:
            mcp_manager.shutdown_all()
            self.stdout.write(self.style.SUCCESS("Process stopped gracefully."))
