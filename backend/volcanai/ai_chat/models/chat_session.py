from django.conf import settings
from django.db import models

from volcanai.core.models import UUIDTimeStampedModel


class ChatSession(UUIDTimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_sessions",
    )

    title = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user} — {self.title or str(self.id)}"
