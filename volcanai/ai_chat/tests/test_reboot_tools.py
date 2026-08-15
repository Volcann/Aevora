from unittest.mock import patch

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase

from volcanai.ai_chat.models import ServerConfig
from volcanai.ai_chat.utils import get_all_tools_for_gemini


class RebootToolsTestCase(TestCase):
    def setUp(self):
        cache.clear()

    def test_reboot_tools_command_creates_server_and_caches_tools(self):
        with patch("volcanai.ai_chat.services.mcp_manager.MCPClient.list_tools") as mock_list_tools:
            mock_list_tools.return_value = [
                {
                    "name": "test_tool",
                    "description": "A test tool",
                    "inputSchema": {"type": "object"},
                }
            ]

            call_command("reboot_tools")

            self.assertTrue(ServerConfig.objects.filter(name="local_mcp").exists())

            cached = cache.get("mcp_tools_cache")
            self.assertIsNotNone(cached)
            gemini_tools, tool_router, _ = cached
            self.assertEqual(len(gemini_tools), 1)
            self.assertIn("test_tool", tool_router)

    def test_get_all_tools_for_gemini_caching(self):
        ServerConfig.objects.create(
            name="test_server",
            url="http://localhost:8080/sse",
            is_active=True,
        )

        with patch("volcanai.ai_chat.services.mcp_manager.MCPClient.list_tools") as mock_list_tools:
            mock_list_tools.return_value = [
                {
                    "name": "t1",
                    "description": "desc",
                    "inputSchema": {"type": "object"},
                }
            ]

            tools1, router1, _ = get_all_tools_for_gemini()
            self.assertEqual(mock_list_tools.call_count, 1)

            tools2, router2, _ = get_all_tools_for_gemini()
            self.assertEqual(mock_list_tools.call_count, 1)
            self.assertEqual(tools1, tools2)
            self.assertEqual(router1, router2)

    def test_get_available_tools_list_caching(self):
        ServerConfig.objects.create(
            name="test_server",
            url="http://localhost:8080/sse",
            is_active=True,
        )

        with patch("volcanai.ai_chat.services.mcp_manager.MCPClient.list_tools") as mock_list_tools:
            mock_list_tools.return_value = [
                {
                    "name": "sample_tool",
                    "description": "Sample description",
                    "inputSchema": {
                        "type": "object",
                        "properties": {"arg": {"type": "string"}},
                        "required": ["arg"],
                    },
                }
            ]

            from volcanai.ai_chat.utils import get_available_tools_list

            tools1 = get_available_tools_list()
            self.assertEqual(mock_list_tools.call_count, 1)
            self.assertEqual(len(tools1), 1)
            self.assertEqual(tools1[0]["name"], "sample_tool")

            tools2 = get_available_tools_list()
            self.assertEqual(mock_list_tools.call_count, 1)
            self.assertEqual(tools1, tools2)

    def test_select_tools_for_prompt_cold_cache(self):
        ServerConfig.objects.create(
            name="test_server",
            url="http://localhost:8080/sse",
            is_active=True,
        )

        with patch("volcanai.ai_chat.services.mcp_manager.MCPClient.list_tools") as mock_list_tools:
            mock_list_tools.return_value = [
                {
                    "name": "lazy_reviewer__review_pr",
                    "description": "review pr",
                    "inputSchema": {"type": "object"},
                },
                {
                    "name": "environment__setup_project",
                    "description": "setup project workspace",
                    "inputSchema": {"type": "object"},
                },
            ]

            from volcanai.ai_chat.utils import select_tools_for_prompt

            cache.clear()
            selected_tools, router = select_tools_for_prompt("setup project #1")
            names = [t.function_declarations[0].name for t in selected_tools]
            self.assertEqual(names, ["environment__setup_project"])
            self.assertEqual(list(router.keys()), ["environment__setup_project"])

            cache.clear()
            selected_tools, router = select_tools_for_prompt("setu- #22")
            names = [t.function_declarations[0].name for t in selected_tools]
            self.assertEqual(names, ["environment__setup_project"])
            self.assertEqual(list(router.keys()), ["environment__setup_project"])
