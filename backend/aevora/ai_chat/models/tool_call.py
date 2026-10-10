from django.db import models

from aevora.ai_chat.choices import ToolCallStatus
from aevora.ai_chat.models.message import Message
from aevora.core.models import UUIDTimeStampedModel


class ToolCall(UUIDTimeStampedModel):
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="tool_calls",
    )
    celery_task_id = models.CharField(max_length=255, null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)

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
