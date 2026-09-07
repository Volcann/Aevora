from django.db import models

from volcanai.ai_chat.choices import ToolCallStatus
from volcanai.ai_chat.models.message import Message
from volcanai.ai_chat.models.server_config import ServerConfig
from volcanai.core.models import UUIDTimeStampedModel


class ToolCall(UUIDTimeStampedModel):
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="tool_calls",
    )
    server = models.ForeignKey(
        ServerConfig,
        on_delete=models.SET_NULL,
        null=True,
        related_name="tool_calls",
    )

    tool_name = models.CharField(max_length=100)
    status = models.CharField(
        max_length=10,
        choices=ToolCallStatus.choices,
        default=ToolCallStatus.QUEUED,
        db_index=True,
    )

    input_arguments = models.JSONField(default=dict)
    output = models.JSONField(default=dict)

    queued_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.tool_name} - {self.status}"
