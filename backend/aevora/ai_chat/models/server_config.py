from django.db import models

from aevora.core.models import UUIDTimeStampedModel


class ServerConfig(UUIDTimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    url = models.URLField(
        blank=True,
        help_text="SSE endpoint URL, e.g. http://host.docker.internal:8080/sse",
    )

    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name
