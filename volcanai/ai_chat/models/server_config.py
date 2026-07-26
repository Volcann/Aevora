from django.db import models

from volcanai.core.models import UUIDTimeStampedModel


class ServerConfig(UUIDTimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    command = models.CharField(max_length=255)

    args = models.JSONField(default=list)
    env_vars = models.JSONField(default=dict, blank=True)

    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name
