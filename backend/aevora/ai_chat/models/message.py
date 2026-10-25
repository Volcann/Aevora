from django.db import models

from aevora.ai_chat.choices import MessageRole
from aevora.ai_chat.models.chat_session import ChatSession
from aevora.core.models import UUIDTimeStampedModel


class Message(UUIDTimeStampedModel):
    session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    model = models.ForeignKey(
        "ai_chat.AIModel",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="messages",
    )

    role = models.CharField(max_length=20, choices=MessageRole.choices)
    content = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.role} - {self.id}"
