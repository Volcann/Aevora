from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class ToolListViewTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="tooltestuser",
            email="tooltest@example.com",
            password="password123",
        )
        self.url = reverse("ai_chat:tools")

    def test_reverse_url(self):
        self.assertEqual(self.url, "/api/v1/chat/tools/")

    def test_unauthenticated_request_fails(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch("aevora.ai_chat.utils.tools.celery_tool_client.list_tools")
    def test_list_tools_success(self, mock_list_tools):
        self.client.force_authenticate(user=self.user)
        mock_tools = [
            {
                "name": "setup_project",
                "description": "Setup project workspace",
                "inputSchema": {
                    "type": "object",
                    "properties": {"project_name": {"type": "string"}},
                    "required": ["project_name"],
                },
            },
            {
                "name": "review_pr",
                "description": "Review PR",
                "parameters": {
                    "properties": {"pr_number": {"type": "integer"}},
                    "required": ["pr_number"],
                },
            },
        ]
        mock_list_tools.return_value = mock_tools

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("tools", data)
        self.assertEqual(len(data["tools"]), 2)

        # Check tool with inputSchema has parameters populated
        tool1 = data["tools"][0]
        self.assertEqual(tool1["name"], "setup_project")
        self.assertEqual(tool1["parameters"], mock_tools[0]["inputSchema"])
        self.assertEqual(tool1["inputSchema"], mock_tools[0]["inputSchema"])

        # Check tool with parameters has inputSchema populated
        tool2 = data["tools"][1]
        self.assertEqual(tool2["name"], "review_pr")
        self.assertEqual(tool2["parameters"], mock_tools[1]["parameters"])
        self.assertEqual(tool2["inputSchema"], mock_tools[1]["parameters"])

        mock_list_tools.assert_called_once()

    @patch("aevora.ai_chat.utils.tools.celery_tool_client.list_tools")
    def test_list_tools_worker_error_returns_empty_list(self, mock_list_tools):
        self.client.force_authenticate(user=self.user)
        mock_list_tools.side_effect = TimeoutError("Celery task timed out")

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("tools", data)
        self.assertEqual(data["tools"], [])

    @patch("aevora.ai_chat.services.celery_tool_client.app.send_task")
    def test_list_tools_end_to_end_celery_task(self, mock_send_task):
        self.client.force_authenticate(user=self.user)
        mock_job = MagicMock()
        mock_job.get.return_value = [
            {"name": "report_status", "description": "Generate report", "inputSchema": {}}
        ]
        mock_send_task.return_value = mock_job

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data["tools"]), 1)
        self.assertEqual(data["tools"][0]["name"], "report_status")

        mock_send_task.assert_called_once_with("tools.list_tools", queue="laptop.tools")
        mock_job.get.assert_called_once_with(timeout=10)


class ToolUtilsTestCase(SimpleTestCase):
    def test_format_tools_normalizes_schemas(self):
        from aevora.ai_chat.utils.tools import format_tools

        raw_tools = [
            {"name": "t1", "inputSchema": {"type": "object"}},
            {"name": "t2", "parameters": {"type": "object"}},
            "non-dict-tool",
        ]
        formatted = format_tools(raw_tools)
        self.assertEqual(formatted[0]["parameters"], {"type": "object"})
        self.assertEqual(formatted[0]["inputSchema"], {"type": "object"})
        self.assertEqual(formatted[1]["parameters"], {"type": "object"})
        self.assertEqual(formatted[1]["inputSchema"], {"type": "object"})
        self.assertEqual(formatted[2], "non-dict-tool")

    @patch("aevora.ai_chat.utils.tools.celery_tool_client.list_tools")
    def test_get_tool_list_fetches_and_formats(self, mock_list_tools):
        from aevora.ai_chat.utils.tools import get_tool_list

        mock_list_tools.return_value = [{"name": "test_tool", "inputSchema": {"type": "object"}}]
        tools = get_tool_list()
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["parameters"], {"type": "object"})

    @patch("aevora.ai_chat.utils.tools.celery_tool_client.list_tools")
    def test_get_tool_list_handles_exception(self, mock_list_tools):
        from aevora.ai_chat.utils.tools import get_tool_list

        mock_list_tools.side_effect = Exception("Celery unreachable")
        tools = get_tool_list()
        self.assertEqual(tools, [])

    def test_schema_to_gemini_invalid_or_non_object(self):
        from aevora.ai_chat.utils.schema import schema_to_gemini

        self.assertIsNone(schema_to_gemini({}))
        self.assertIsNone(schema_to_gemini({"type": "string"}))

    def test_schema_to_gemini_valid_object(self):
        import google.generativeai as genai

        from aevora.ai_chat.utils.schema import schema_to_gemini

        raw_schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "User name"},
                "age": {"type": "integer"},
                "scores": {"type": "array"},
                "active": {"type": "boolean"},
            },
            "required": ["name"],
        }
        converted = schema_to_gemini(raw_schema)
        self.assertEqual(converted.type, genai.protos.Type.OBJECT)
        self.assertEqual(converted.properties["name"].type, genai.protos.Type.STRING)
        self.assertEqual(converted.properties["name"].description, "User name")
        self.assertEqual(converted.properties["age"].type, genai.protos.Type.INTEGER)
        self.assertEqual(converted.properties["scores"].type, genai.protos.Type.ARRAY)
        self.assertEqual(converted.properties["active"].type, genai.protos.Type.BOOLEAN)
        self.assertEqual(list(converted.required), ["name"])

    @patch("aevora.ai_chat.utils.tools.cache")
    def test_get_gemini_tools_cache_hit(self, mock_cache):
        from aevora.ai_chat.utils.tools import get_gemini_tools

        sentinel = [object()]
        mock_cache.get.return_value = sentinel

        result = get_gemini_tools()
        self.assertEqual(result, sentinel)
        mock_cache.get.assert_called_once_with("gemini_tools_cache")

    @patch("aevora.ai_chat.utils.tools.celery_tool_client.list_tools")
    @patch("aevora.ai_chat.utils.tools.cache")
    def test_get_gemini_tools_cache_miss_builds_and_caches(self, mock_cache, mock_list_tools):
        from aevora.ai_chat.utils.tools import get_gemini_tools

        mock_cache.get.return_value = None
        mock_list_tools.return_value = [
            {
                "name": "calc",
                "description": "Calculate expression",
                "inputSchema": {
                    "type": "object",
                    "properties": {"expr": {"type": "string"}},
                    "required": ["expr"],
                },
            }
        ]

        tools = get_gemini_tools()
        self.assertEqual(len(tools), 1)
        self.assertEqual(len(tools[0].function_declarations), 1)
        self.assertEqual(tools[0].function_declarations[0].name, "calc")
        self.assertEqual(tools[0].function_declarations[0].description, "Calculate expression")
        mock_cache.set.assert_called_once_with("gemini_tools_cache", tools, 60)

    @patch("aevora.ai_chat.utils.tools.celery_tool_client.list_tools")
    @patch("aevora.ai_chat.utils.tools.cache")
    def test_get_gemini_tools_handles_exception(self, mock_cache, mock_list_tools):
        from aevora.ai_chat.utils.tools import get_gemini_tools

        mock_cache.get.return_value = None
        mock_list_tools.side_effect = Exception("Celery failed")

        tools = get_gemini_tools()
        self.assertEqual(tools, [])
