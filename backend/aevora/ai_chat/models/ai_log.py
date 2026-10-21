from django.db import models

from aevora.ai_chat.models.message import Message
from aevora.core.models import UUIDTimeStampedModel


class AILog(UUIDTimeStampedModel):
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name="logs",
    )
    text = models.TextField()

    class Meta:
        ordering = ("created_at",)
        verbose_name = "AI Log"
        verbose_name_plural = "AI Logs"

    def __str__(self):
        return f"AILog({self.id}) for Message {self.message_id}"
