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

    role = models.CharField(max_length=20, choices=MessageRole.choices)
    content = models.TextField()
    token_count = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.role} - {self.id}"
