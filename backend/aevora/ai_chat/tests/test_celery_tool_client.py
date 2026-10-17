from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from aevora.ai_chat.services import CeleryToolClient
from aevora.ai_chat.services.celery_tool_client import (
    CeleryToolClient as CeleryToolClientFromModule,
)


class CeleryToolClientTestCase(SimpleTestCase):
    def test_imports_match(self):
        self.assertIs(CeleryToolClient, CeleryToolClientFromModule)

    def test_queue_name(self):
        client = CeleryToolClient()
        self.assertEqual(client.QUEUE, "laptop.tools")

    @patch("aevora.ai_chat.services.celery_tool_client.app.send_task")
    def test_list_tools_dispatches_task_and_returns_result(self, mock_send_task):
        mock_job = MagicMock()
        expected_tools = [
            {
                "name": "setup_project",
                "description": "Setup project",
                "inputSchema": {"type": "object"},
            },
            {
                "name": "review_pr",
                "description": "Review PR",
                "inputSchema": {"type": "object"},
            },
        ]
        mock_job.get.return_value = expected_tools
        mock_send_task.return_value = mock_job

        client = CeleryToolClient()
        tools = client.list_tools()

        mock_send_task.assert_called_once_with("tools.list_tools", queue="laptop.tools")
        mock_job.get.assert_called_once_with(timeout=10)
        self.assertEqual(tools, expected_tools)

    @patch("aevora.ai_chat.services.celery_tool_client.app.send_task")
    def test_call_tool_async_dispatches_task_with_kwargs(self, mock_send_task):
        mock_job = MagicMock()
        mock_send_task.return_value = mock_job

        client = CeleryToolClient()
        job = client.call_tool_async("review_pr", {"pr_number": 42})

        mock_send_task.assert_called_once_with(
            "tools.review_pr",
            kwargs={"pr_number": 42},
            queue="laptop.tools",
        )
        self.assertEqual(job, mock_job)

    @patch("aevora.ai_chat.services.celery_tool_client.app.send_task")
    def test_call_tool_async_with_function_call_object(self, mock_send_task):
        mock_job = MagicMock()
        mock_send_task.return_value = mock_job

        mock_fc = MagicMock()
        mock_fc.name = "get_weather"
        mock_fc.args = {"city": "Tokyo"}

        client = CeleryToolClient()
        job = client.call_tool_async(mock_fc)

        mock_send_task.assert_called_once_with(
            "tools.get_weather",
            kwargs={"city": "Tokyo"},
            queue="laptop.tools",
        )
        self.assertEqual(job, mock_job)
