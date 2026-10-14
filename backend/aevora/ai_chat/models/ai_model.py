from decimal import Decimal

from django.db import models

from aevora.core.models import UUIDTimeStampedModel


class AIModel(UUIDTimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    quota = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        verbose_name = "AI Model"
        verbose_name_plural = "AI Models"
        ordering = ("name",)

    def __str__(self):
        return f"{self.name} (quota: {self.quota})"
