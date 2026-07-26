from django.contrib.auth.models import AbstractUser
from django.db import models

from volcanai.core.models import UUIDTimeStampedModel


class User(AbstractUser, UUIDTimeStampedModel):
    email = models.EmailField(unique=True)

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self):
        return self.email or self.username
