from django.contrib.auth.models import AbstractUser
from django.db import models

from aevora.core.models import UUIDTimeStampedModel


class User(AbstractUser, UUIDTimeStampedModel):
    email = models.EmailField(unique=True)
    theme_config = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.email or self.username
